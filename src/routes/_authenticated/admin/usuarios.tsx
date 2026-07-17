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
import { createUserWithRole } from "@/functions/usuarios/createUserWithRole.functions";
import { updateMemberAccess } from "@/functions/usuarios/updateMemberAccess.functions";
import { summarizePermissions } from "@/lib/permissions";
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

async function fetchTeam(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, email, permissoes, cliente_id, clientes(nome), user_roles(role)")
    .order("nome");

  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => {
    const clienteJoin = p.clientes as unknown as { nome: string } | null;
    return {
      id: p.id,
      nome: p.nome,
      email: p.email,
      role: (p.user_roles as unknown as { role: string }[] | null)?.[0]?.role ?? null,
      permissoes: p.permissoes ?? [],
      cliente_id: p.cliente_id,
      cliente_nome: clienteJoin?.nome ?? null,
    };
  });
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

function AddUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [permissoes, setPermissoes] = useState<string[]>(["*"]);
  const queryClient = useQueryClient();
  const { data: clientes = [] } = useClientesOptions();

  const form = useForm<AddUserForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(addUserSchema) as any,
    defaultValues: { nome: "", email: "", role: "admin", cliente_id: null },
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
      if (result.reused_existing) {
        toast.success("Email já existia — perfil atualizado.");
      } else {
        toast.success("Usuário criado.");
      }
      if (result.temporary_password) {
        toast.message("Senha temporária (copie agora)", {
          description: result.temporary_password,
          duration: 20_000,
        });
      }
      if (result.recovery_link) {
        toast.message("Link de recuperação", {
          description: result.recovery_link,
          duration: 20_000,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["admin", "team"] });
      onClose();
      form.reset();
      setPermissoes(["*"]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Adicionar membro</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((d) => {
            if (d.role === "cliente" && !d.cliente_id) {
              toast.error("Selecione o cliente para o acesso ao portal.");
              return;
            }
            if (permissoes.length === 0) {
              toast.error("Selecione ao menos uma permissão.");
              return;
            }
            mutation.mutate(d as AddUserForm);
          })}
          className="space-y-4 py-2"
        >
          <div className="space-y-1">
            <Label>Nome</Label>
            <Input placeholder="Nome completo" {...form.register("nome")} />
            {form.formState.errors.nome && (
              <p className="text-xs text-destructive">{form.formState.errors.nome.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" placeholder="email@tabgha.com.br" {...form.register("email")} />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>

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
                <SelectItem value="admin">Admin — equipe interna</SelectItem>
                <SelectItem value="cliente">Cliente — médico (portal)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {role === "cliente" && (
            <div className="space-y-1">
              <Label>Cliente vinculado</Label>
              <Select
                value={form.watch("cliente_id") ?? ""}
                onValueChange={(v) => form.setValue("cliente_id", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o consultório…" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Sem esse vínculo, o portal do médico fica vazio.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>Permissões {role === "cliente" ? "do portal" : "do admin"}</Label>
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
              Criar usuário
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditAccessDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: clientes = [] } = useClientesOptions();
  const [nome, setNome] = useState(member.nome ?? "");
  const [clienteId, setClienteId] = useState<string | null>(member.cliente_id);
  const [permissoes, setPermissoes] = useState<string[]>(
    member.permissoes.length ? member.permissoes : ["*"],
  );

  const mutation = useMutation({
    mutationFn: () => {
      if (member.role === "cliente" && !clienteId) {
        throw new Error("Selecione o cliente vinculado.");
      }
      if (permissoes.length === 0) {
        throw new Error("Selecione ao menos uma permissão.");
      }
      return updateMemberAccess({
        data: {
          id: member.id,
          nome: nome.trim() || null,
          cliente_id: member.role === "cliente" ? clienteId : null,
          permissoes,
        },
      });
    },
    onSuccess: () => {
      toast.success("Acessos atualizados.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "team"] });
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
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
            />
          </div>

          {member.role === "cliente" && (
            <div className="space-y-1">
              <Label>Cliente vinculado</Label>
              <Select value={clienteId ?? ""} onValueChange={(v) => setClienteId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o consultório…" />
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
            <Label>Permissões {member.role === "cliente" ? "do portal" : "do admin"}</Label>
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

  const { data: team = [], isLoading } = useQuery({
    queryKey: ["admin", "team"],
    queryFn: fetchTeam,
    staleTime: 60_000,
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
          <p className="mt-0.5 text-xs text-muted-foreground">
            Cadastro de membros, vínculo com consultórios e permissões do menu atual.
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
            { label: "Clientes", value: clientesMembers.length, color: "text-sky-700" },
          ].map((kpi, i) => (
            <div
              key={kpi.label}
              className="card-lift animate-fade-up rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]"
              style={{ animationDelay: i * 75 + "ms" }}
            >
              <p className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
                {kpi.label}
              </p>
              <p
                className={`text-3xl font-extrabold tracking-tight animate-numeric-pop mt-1 ${kpi.color}`}
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : team.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="Nenhum membro cadastrado"
          description="Adicione o primeiro membro da equipe."
          action={{ label: "Adicionar membro", onClick: () => setShowAdd(true) }}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_3px_rgba(15,27,53,0.04)]">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Membros
          </p>
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {team.map((member, i) => (
              <div
                key={member.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/30 transition-colors animate-fade-up"
                style={{ animationDelay: i * 50 + "ms" }}
              >
                <span className="text-[10px] font-black text-muted-foreground/30 tabular-nums w-5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Avatar>
                  <AvatarFallback className="text-xs bg-slate-100 text-slate-700">
                    {initials(member.nome, member.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{member.nome ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  {member.role === "cliente" && (
                    <p className="text-[11px] text-sky-700 mt-0.5 truncate">
                      {member.cliente_nome
                        ? `Vinculado: ${member.cliente_nome}`
                        : "Sem consultório vinculado"}
                    </p>
                  )}
                </div>
                <div className="hidden sm:flex flex-col items-end gap-1 max-w-[200px]">
                  {member.role === "admin" ? (
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700">
                      Admin
                    </span>
                  ) : (
                    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-sky-50 text-sky-700">
                      Cliente
                    </span>
                  )}
                  <Badge variant="outline" className="text-[10px] font-normal truncate max-w-full">
                    {summarizePermissions(member.permissoes, member.role)}
                  </Badge>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setEditing(member)}
                  aria-label={`Editar acessos de ${member.email ?? member.nome ?? "membro"}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <AddUserDialog open={showAdd} onClose={() => setShowAdd(false)} />
      {editing && (
        <EditAccessDialog key={editing.id} member={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
