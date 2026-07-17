import { cn } from "@/lib/utils";
import {
  buildRange,
  monthOptions,
  yearOptions,
  type DateRange,
  type PeriodPreset,
} from "@/lib/analytics-range";

export type AnalyticsFiltersValue = {
  range: DateRange;
  clienteId: string | null;
  plataforma: string | null;
  categoria: string | null;
};

type ClienteOpt = { id: string; nome: string; especialidade?: string | null };

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "7d", label: "7d" },
  { id: "30d", label: "30d" },
  { id: "90d", label: "90d" },
  { id: "month", label: "Mês" },
  { id: "year", label: "Ano" },
];

const PLATAFORMAS = [
  { id: "", label: "Todas plataformas" },
  { id: "meta", label: "Meta" },
  { id: "google", label: "Google" },
  { id: "outro", label: "Outras" },
];

export function AnalyticsFilters({
  value,
  onChange,
  clientes = [],
  categorias = [],
  showCliente = true,
  showPlataforma = true,
  showCategoria = true,
  className,
}: {
  value: AnalyticsFiltersValue;
  onChange: (next: AnalyticsFiltersValue) => void;
  clientes?: ClienteOpt[];
  categorias?: string[];
  showCliente?: boolean;
  showPlataforma?: boolean;
  showCategoria?: boolean;
  className?: string;
}) {
  const months = monthOptions();
  const years = yearOptions();

  function setPreset(preset: PeriodPreset) {
    const range = buildRange(preset, {
      monthKey: value.range.monthKey ?? months[0]?.value,
      yearKey: value.range.yearKey ?? years[0]?.value,
    });
    onChange({ ...value, range });
  }

  return (
    <div className={cn("flex flex-wrap items-end gap-2", className)}>
      <div className="flex items-center gap-1 rounded-xl border border-border bg-secondary/30 p-1">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPreset(p.id)}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
              value.range.preset === p.id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {value.range.preset === "month" ? (
        <select
          value={value.range.monthKey ?? months[0]?.value}
          onChange={(e) =>
            onChange({
              ...value,
              range: buildRange("month", { monthKey: e.target.value }),
            })
          }
          className="h-9 rounded-xl border border-input bg-background px-3 text-xs"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      ) : null}

      {value.range.preset === "year" ? (
        <select
          value={value.range.yearKey ?? years[0]?.value}
          onChange={(e) =>
            onChange({
              ...value,
              range: buildRange("year", { yearKey: e.target.value }),
            })
          }
          className="h-9 rounded-xl border border-input bg-background px-3 text-xs"
        >
          {years.map((y) => (
            <option key={y.value} value={y.value}>
              {y.label}
            </option>
          ))}
        </select>
      ) : null}

      {showCliente ? (
        <select
          value={value.clienteId ?? ""}
          onChange={(e) => onChange({ ...value, clienteId: e.target.value || null })}
          className="h-9 min-w-[10rem] rounded-xl border border-input bg-background px-3 text-xs"
        >
          <option value="">Todos os clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      ) : null}

      {showCategoria && categorias.length > 0 ? (
        <select
          value={value.categoria ?? ""}
          onChange={(e) => onChange({ ...value, categoria: e.target.value || null })}
          className="h-9 min-w-[9rem] rounded-xl border border-input bg-background px-3 text-xs"
        >
          <option value="">Todas categorias</option>
          {categorias.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      ) : null}

      {showPlataforma ? (
        <select
          value={value.plataforma ?? ""}
          onChange={(e) => onChange({ ...value, plataforma: e.target.value || null })}
          className="h-9 min-w-[9rem] rounded-xl border border-input bg-background px-3 text-xs"
        >
          {PLATAFORMAS.map((p) => (
            <option key={p.id || "all"} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}

export function defaultAnalyticsFilters(preset: PeriodPreset = "30d"): AnalyticsFiltersValue {
  return {
    range: buildRange(preset),
    clienteId: null,
    plataforma: null,
    categoria: null,
  };
}
