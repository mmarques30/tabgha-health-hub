import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlus, Users, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/EmptyState";
import { PermissionPicker } from "@/components/PermissionPicker";
import { createUserWithRole } from "@/functions/usuarios/createUserWithRole.functions";
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
  head: () => ({ meta: [{ title: "Usuários — Tabgha Admin" }] }),
});

type TeamMember = {
  id: string;
  nome: string | null;
  email: string | null;
  role: string | null;
  permissoes: string[];
};

async function fetchTeam(): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, email, permissoes, user_roles(role)")
    .order("nome");

  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => ({
    id: p.id,
    nome: p.nome,
    email: p.email,
    // user_roles is a joined array — cast needed because Supabase types don't infer nested joins
    role: (p.user_roles as unknown as { role: string }[] | null)?.[0]?.role ?? null,
    permissoes: p.permissoes ?? [],
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

function initials(nome: string | null): string {
  if (!nome) return "?";
  return nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function AddUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [permissoes, setPermissoes] = useState<string[]>(["*"]);
  const queryClient = useQueryClient();

  const form = useForm<AddUserForm>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(addUserSchema) as any,
    defaultValues: { nome: "", email: "", role: "admin", cliente_id: null },
  });

  const mutation = useMutation({
    mutationFn: (data: AddUserForm) =>
      createUserWithRole({ data: { ...data, permissoes } }),
    onSuccess: () => {
      toast.success("Usuário criado. Email de acesso enviado.");
      queryClient.invalidateQueries({ queryKey: ["admin", "team"] });
      onClose();
      form.reset();
      setPermissoes(["*"]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar membro</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit((d) => mutation.mutate(d as AddUserForm))}
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
              value={form.watch("role")}
              onValueChange={(v) => form.setValue("role", v as "admin" | "cliente")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — equipe interna</SelectItem>
                <SelectItem value="cliente">Cliente — médico</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.watch("role") === "admin" && (
            <div className="space-y-2">
              <Label>Permissões</Label>
              <PermissionPicker value={permissoes} onChange={setPermissoes} />
            </div>
          )}

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

function UsuariosPage() {
  const [showAdd, setShowAdd] = useState(false);

  const { data: team = [], isLoading } = useQuery({
    queryKey: ["admin", "team"],
    queryFn: fetchTeam,
    staleTime: 60_000,
  });

  return (
    <div className="px-8 py-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Configurações</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Equipe</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os membros e suas permissões de acesso.
          </p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Adicionar membro
        </Button>
      </div>

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
        <div className="divide-y divide-border rounded-xl border border-border">
          {team.map((member) => (
            <div key={member.id} className="flex items-center gap-4 px-5 py-4">
              <Avatar>
                <AvatarFallback className="text-xs">{initials(member.nome)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member.nome ?? "—"}</p>
                <p className="text-xs text-muted-foreground truncate">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                  {member.role === "admin" ? "Admin" : "Cliente"}
                </Badge>
                {member.permissoes.includes("*") && (
                  <Badge variant="outline" className="text-xs">
                    Acesso total
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddUserDialog open={showAdd} onClose={() => setShowAdd(false)} />
    </div>
  );
}
