import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ADMIN_PERMISSION_GROUPS,
  ADMIN_PERMISSION_LABELS,
  CLIENT_PERMISSION_GROUPS,
  CLIENT_PERMISSION_LABELS,
  type AdminPermissionGroup,
  type ClientPermissionGroup,
} from "@/lib/permissions";

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  /** admin = equipe interna; cliente = portal do médico */
  variant?: "admin" | "cliente";
};

export function PermissionPicker({ value, onChange, variant = "admin" }: Props) {
  const isWildcard = value.includes("*");
  const isClient = variant === "cliente";

  const groups = isClient ? CLIENT_PERMISSION_GROUPS : ADMIN_PERMISSION_GROUPS;
  const labels = isClient ? CLIENT_PERMISSION_LABELS : ADMIN_PERMISSION_LABELS;
  const keys = Object.keys(groups) as Array<AdminPermissionGroup | ClientPermissionGroup>;

  const toggleWildcard = (checked: boolean) => onChange(checked ? ["*"] : []);

  const toggleGroup = (key: string, checked: boolean) => {
    const perm = groups[key as keyof typeof groups] as string;
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
          id={`perm-wildcard-${variant}`}
          checked={isWildcard}
          onCheckedChange={(c) => toggleWildcard(c === true)}
        />
        <Label htmlFor={`perm-wildcard-${variant}`} className="font-semibold cursor-pointer">
          Acesso total (*)
        </Label>
      </div>

      <Separator />

      <div className="grid grid-cols-2 gap-2">
        {keys.map((group) => {
          const perm = groups[group as keyof typeof groups] as string;
          const label = labels[group as keyof typeof labels] as string;
          return (
            <div
              key={group}
              className="flex items-center gap-2 rounded-md border border-border p-2.5"
            >
              <Checkbox
                id={`perm-${variant}-${group}`}
                disabled={isWildcard}
                checked={isWildcard || value.includes(perm)}
                onCheckedChange={(c) => toggleGroup(group, c === true)}
              />
              <Label
                htmlFor={`perm-${variant}-${group}`}
                className={`cursor-pointer text-sm ${isWildcard ? "text-muted-foreground" : ""}`}
              >
                {label}
              </Label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
