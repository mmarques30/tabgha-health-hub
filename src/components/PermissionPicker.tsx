import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ADMIN_PERMISSION_GROUPS, type AdminPermissionGroup } from "@/lib/permissions";

const GROUP_LABELS: Record<AdminPermissionGroup, string> = {
  dashboard:    "Dashboard",
  clientes:     "Clientes",
  estrategia:   "Estratégia",
  operacao:     "Automações & Operação",
  atendimento:  "Atendimento WhatsApp",
  meta_ads:     "Meta Ads",
  roi:          "ROI",
  usuarios:     "Usuários",
  diagnosticos: "Diagnósticos",
};

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
};

export function PermissionPicker({ value, onChange }: Props) {
  const isWildcard = value.includes("*");

  const toggleWildcard = (checked: boolean) => onChange(checked ? ["*"] : []);

  const toggleGroup = (group: AdminPermissionGroup, checked: boolean) => {
    const perm = ADMIN_PERMISSION_GROUPS[group];
    if (checked) {
      onChange([...new Set([...value, perm])]);
    } else {
      onChange(value.filter((p) => p !== perm));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3">
        <Checkbox
          id="perm-wildcard"
          checked={isWildcard}
          onCheckedChange={(c) => toggleWildcard(c === true)}
        />
        <Label htmlFor="perm-wildcard" className="font-semibold cursor-pointer">
          Acesso total (*)
        </Label>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(ADMIN_PERMISSION_GROUPS) as AdminPermissionGroup[]).map((group) => (
          <div key={group} className="flex items-center gap-2 rounded-md border border-border p-2.5">
            <Checkbox
              id={`perm-${group}`}
              disabled={isWildcard}
              checked={isWildcard || value.includes(ADMIN_PERMISSION_GROUPS[group])}
              onCheckedChange={(c) => toggleGroup(group, c === true)}
            />
            <Label
              htmlFor={`perm-${group}`}
              className={`cursor-pointer text-sm ${isWildcard ? "text-muted-foreground" : ""}`}
            >
              {GROUP_LABELS[group]}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
