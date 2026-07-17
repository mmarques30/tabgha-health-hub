import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, UserPlus, Users, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { PermissionPicker } from "@/components/PermissionPicker";
import { CredentialsDialog, type AccessCredentials } from "@/components/usuarios/CredentialsDialog";
import { ProvisionalPasswordField } from "@/components/usuarios/ProvisionalPasswordField";
import { createUserWithRole } from "@/functions/usuarios/createUserWithRole.functions";
import { updateMemberAccess } from "@/functions/usuarios/updateMemberAccess.functions";
import { summarizePermissions } from "@/lib/permissions";
import { provisionalPassword } from "@/lib/provisional-password";
import { useAuth } from "@/lib/auth";
import { useClientesOptions } from "@/hooks/useClientesOptions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosPage,
  head: () => ({ meta: [{ title: "Usuários & acessos — Tabgha Admin" }] }),
});

type TeamMember = {
  id: string;
  nome: string | null;
  email: string | null;
  role: string | null;
  permissoes: string[];
  cliente_id: string | null;
  cliente_nome: string | null;
};

/** Fetch rápido: profiles + roles + mapa de clientes em paralelo (sem join aninhado). */
async function fetchTeam(): Promise<TeamMember[]> {
  const [profilesRes, rolesRes, clientesRes] = await Promise.all([
    supabase.from("profiles").select("id, nome, email, permissoes, cliente_id").order("nome"),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("clientes").select("id, nome"),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (rolesRes.error) throw new Error(rolesRes.error.message);

  const roleByUser = new Map((rolesRes.data ?? []).map((r) => [r.user_id, r.role as string]));
  const nomeByCliente = new Map((clientesRes.data ?? []).map((c) => [c.id, c.nome]));

  return (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    email: p.email,
    role: roleByUser.get(p.id) ?? null,
    permissoes: p.permissoes ?? [],
    cliente_id: p.cliente_id,
    cliente_nome: p.cliente_id ? (nomeByCliente.get(p.cliente_id) ?? null) : null,
  }));
}

const addUserSchema = z.object({
  nome: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("Email inválido"),
  role: z.enum(["admin", "cliente"]),
  cliente_id: z.string().nullable().default(null),
});

type AddUserForm = {
  nome: string;
  email: string;
  role: "admin" | "cliente";
  cliente_id: string | null;
};

function initials(nome: string | null, email: string | null): string {
  if (nome)
    return nome
      .split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

function AddUserDialog({
  open,
  onClose,
  onCredentials,
}: {
  open: boolean;
  onClose: () => void;
  onCredentials: (c: AccessCredentials) => void;
}) {
  const [permissoes, setPermissoes] = useState<string[]>(["*"]);
  const [formError, setFormError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { data: clientes = [] } = useClientesOptions();

  const form = useForm<AddUserForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(addUserSchema) as any,
    defaultValues: { nome: "", email: "", role: "cliente", cliente_id: null },
  });

  const role = form.watch("role");

  const mutation = useMutation({
    mutationFn: (data: AddUserForm) =>
      createUserWithRole({
        data: {
          ...data,
          cliente_id: data.role === "cliente" ? data.cliente_id : null,
          permissoes,
        },
      }),
    onSuccess: (result) => {
      setFormError(null);
      toast.success(
        result.reused_existing
          ? `Senha redefinida para ${result.temporary_password}.`
          : `Acesso criado. Senha: ${result.temporary_password}`,
      );
      onCredentials({
        email: result.email,
        temporary_password: result.temporary_password || provisionalPassword(),
        reused_existing: result.reused_existing,
        role: result.role,
      });
      void queryClient.invalidateQueries({ queryKey: ["admin", "team"] });
      onClose();
      form.reset({ nome: "", email: "", role: "cliente", cliente_id: null });
      setPermissoes(["*"]);
    },
    onError: (err: Error) => {
      setFormError(err.message);
      toast.error(err.message);
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setFormError(null);
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar membro</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((d) => {
            setFormError(null);
            if (d.role === "cliente" && !d.cliente_id) {
              setFormError("Selecione o consultório vinculado.");
              return;
            }
            if (permissoes.length === 0) {
              setFormError("Selecione ao menos uma permissão.");
              return;
            }
            mutation.mutate(d as AddUserForm);
          })}
          className="space-y-4 py-2"
        >
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            Isso cria o <strong>login</strong> (email + senha provisória{" "}
            <strong>{provisionalPassword()}</strong>). O cadastro de consultório fica em Clientes.
          </p>

          {formError ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {formError}
            </div>
          ) : null}

          <div className="space-y-1">
            <Label>Nome</Label>
            <Input placeholder="Nome completo" {...form.register("nome")} />
            {form.formState.errors.nome && (
              <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Email de login</Label>
            <Input type="email" placeholder="email@exemplo.com" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

          <ProvisionalPasswordField />

          <div className="space-y-1">
            <Label>Perfil</Label>
            <Select
              value={role}
              onValueChange={(v) => {
                form.setValue("role", v as "admin" | "cliente");
                if (v === "admin") form.setValue("cliente_id", null);
                setPermissoes(["*"]);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Cliente — portal do médico</SelectItem>
                <SelectItem value="admin">Admin — equipe Tabgha</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === "cliente" && (
            <div className="space-y-1">
              <Label>Consultório vinculado</Label>
              <Select
                value={form.watch("cliente_id") ?? ""}
                onValueChange={(v) => form.setValue("cliente_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente…" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Telas liberadas ({role === "cliente" ? "portal" : "admin"})</Label>
            <PermissionPicker
              value={permissoes}
              onChange={setPermissoes}
              variant={role === "cliente" ? "cliente" : "admin"}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar acesso
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAccessDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { user, refresh } = useAuth();
  const { data: clientes = [] } = useClientesOptions();
  const [nome, setNome] = useState(member.nome ?? "");
  const [clienteId, setClienteId] = useState<string | null>(member.cliente_id);
  const [permissoes, setPermissoes] = useState<string[]>(
    member.permissoes.length ? member.permissoes : ["*"],
  );

  const mutation = useMutation({
    mutationFn: () => {
      if (member.role === "cliente" && !clienteId) {
        throw new Error("Selecione o consultório vinculado.");
      }
      if (permissoes.length === 0) throw new Error("Selecione ao menos uma permissão.");
      return updateMemberAccess({
        data: {
          id: member.id,
          nome: nome.trim() || null,
          cliente_id: member.role === "cliente" ? clienteId : null,
          permissoes,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Acessos atualizados. O usuário precisa recarregar a página (ou relogar).");
      void queryClient.invalidateQueries({ queryKey: ["admin", "team"] });
      if (user?.id === member.id) await refresh();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar acessos</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
            <p className="text-sm font-medium">{member.email}</p>
            <p className="text-[11px] text-muted-foreground">
              Perfil: {member.role === "admin" ? "Admin" : "Cliente (portal)"}
            </p>
          </div>

          <div className="space-y-1">
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>

          {member.role === "cliente" && (
            <div className="space-y-1">
              <Label>Consultório vinculado</Label>
              <Select value={clienteId ?? ""} onValueChange={(v) => setClienteId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Telas liberadas</Label>
            <PermissionPicker
              value={permissoes}
              onChange={setPermissoes}
              variant={member.role === "cliente" ? "cliente" : "admin"}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UsuariosPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [credentials, setCredentials] = useState<AccessCredentials | null>(null);

  const {
    data: team = [],
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["admin", "team"],
    queryFn: fetchTeam,
    staleTime: 15_000,
  });

  const admins = team.filter((m) => m.role === "admin");
  const clientesMembers = team.filter((m) => m.role === "cliente");

  return (
    <div className="px-6 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-600 mb-2">
            Configurações
          </span>
          <h1 className="text-xl font-bold tracking-tight">Usuários & acessos</h1>
          <p className="mt-0.5 text-xs text-muted-foreground max-w-xl">
            Aqui ficam os <strong>logins</strong>. Criar um consultório em Clientes não libera
            portal — é preciso gerar o acesso (email + senha) e vincular ao consultório.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Adicionar membro
        </Button>
      </div>

      {!isLoading && team.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[
            { label: "Total de membros", value: team.length, color: "text-slate-700" },
            { label: "Admins", value: admins.length, color: "text-primary" },
            { label: "Portais cliente", value: clientesMembers.length, color: "text-sky-700" },
          ].map((kpi, i) => (
            <div
              key={kpi.label}
              className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]"
              style={{ animationDelay: i * 75 + "ms" }}
            >
              <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
                {kpi.label}
              </p>
              <p className={`mt-1 text-3xl font-extrabold tracking-tight ${kpi.color}`}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <p className="text-sm text-destructive">Erro ao carregar: {(error as Error).message}</p>
      ) : null}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : team.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nenhum login cadastrado"
          description="Crie o primeiro acesso (admin ou portal do médico)."
          action={{ label: "Adicionar membro", onClick: () => setShowAdd(true) }}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Membros {isFetching ? "· atualizando…" : ""}
            </p>
          </div>
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {team.map((member, i) => (
              <div
                key={member.id}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
              >
                <span className="w-5 shrink-0 text-[10px] font-black tabular-nums text-muted-foreground/30">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Avatar>
                  <AvatarFallback className="bg-slate-100 text-xs text-slate-700">
                    {initials(member.nome, member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{member.nome ?? "—"}</p>
                  <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                  {member.role === "cliente" && (
                    <p className="mt-0.5 truncate text-[11px] text-sky-700">
                      {member.cliente_nome
                        ? `Portal: ${member.cliente_nome}`
                        : "Sem consultório vinculado"}
                    </p>
                  )}
                </div>
                <div className="hidden max-w-[200px] flex-col items-end gap-1 sm:flex">
                  <span
                    className={
                      member.role === "admin"
                        ? "rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700"
                        : "rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700"
                    }
                  >
                    {member.role === "admin" ? "Admin" : "Cliente"}
                  </span>
                  <Badge variant="outline" className="max-w-full truncate text-[10px] font-normal">
                    {summarizePermissions(member.permissoes, member.role)}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setEditing(member)}
                  aria-label={`Editar ${member.email ?? ""}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <AddUserDialog
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCredentials={setCredentials}
      />
      {editing && (
        <EditAccessDialog key={editing.id} member={editing} onClose={() => setEditing(null)} />
      )}
      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}
