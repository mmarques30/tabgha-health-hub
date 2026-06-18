import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Direction = "up" | "down" | "neutral";

interface KpiCardProps {
  label: string;
  value: number | string;
  delta?: { value: string; label?: string; direction?: Direction };
  icon?: React.ComponentType<{ className?: string }>;
  format?: "number" | "currency" | "percent" | "multiplier" | "raw";
  loading?: boolean;
  className?: string;
  accentColor?: string;
}

function formatValue(value: number | string, format: KpiCardProps["format"] = "number"): string {
  if (typeof value === "string") return value;
  if (format === "currency") return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  if (format === "percent") return `${(value * 100).toFixed(0)}%`;
  if (format === "multiplier") return `${value.toFixed(1)}×`;
  if (format === "raw") return String(value);
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function KpiCard({ label, value, delta, icon: Icon, format = "number", loading = false, className, accentColor }: KpiCardProps) {
  const direction = delta?.direction ?? "neutral";
  const deltaColor = direction === "up" ? "text-emerald-600" : direction === "down" ? "text-rose-600" : "text-muted-foreground";
  const deltaChip = direction === "up" ? "bg-emerald-50" : direction === "down" ? "bg-rose-50" : "bg-muted";
  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "";

  return (
    <div className={cn(
      "relative rounded-2xl border border-border bg-card p-5 overflow-hidden",
      "shadow-[0_1px_0_rgba(15,27,53,0.02),0_1px_3px_rgba(15,27,53,0.04)]",
      "transition-all duration-200 hover:-translate-y-px hover:shadow-[0_2px_8px_rgba(15,27,53,0.08)]",
      className,
    )}>
      {/* Subtle gradient accent in top-right */}
      <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-2/5 bg-gradient-to-br from-sky-100/40 to-transparent" />

      <div className="relative z-10">
        {/* Top row: label + icon */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground leading-none">{label}</p>
          {Icon && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-secondary">
              <Icon className="h-3.5 w-3.5 text-primary" />
            </div>
          )}
        </div>

        {/* Value */}
        <div className="mt-2.5">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <p
              className={cn("text-[30px] font-extrabold leading-none tracking-[-0.024em]", accentColor ?? "text-foreground")}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatValue(value, format)}
            </p>
          )}
        </div>

        {/* Delta */}
        {delta && !loading && (
          <div className="mt-2 flex items-center gap-1.5">
            {arrow && (
              <span className={cn("inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold", deltaChip, deltaColor)}>
                {arrow}
              </span>
            )}
            <span className={cn("text-[11.5px] font-medium", deltaColor)}>
              {delta.value}{delta.label ? ` ${delta.label}` : ""}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
