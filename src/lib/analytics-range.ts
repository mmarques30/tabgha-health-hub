/** Períodos compartilhados para Dashboard / ROI / Marketing Pago */

export type PeriodPreset = "7d" | "30d" | "90d" | "month" | "year";

export type DateRange = {
  since: string;
  until: string;
  preset: PeriodPreset;
  /** YYYY-MM quando preset=month */
  monthKey?: string;
  /** YYYY quando preset=year */
  yearKey?: string;
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function buildRange(preset: PeriodPreset, opts?: { monthKey?: string; yearKey?: string }): DateRange {
  const today = new Date();
  const until = iso(today);

  if (preset === "7d" || preset === "30d" || preset === "90d") {
    const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
    const since = new Date(today);
    since.setDate(today.getDate() - (days - 1));
    return { since: iso(since), until, preset };
  }

  if (preset === "month") {
    const key = opts?.monthKey ?? `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;
    const [y, m] = key.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    const endIso = iso(end) > until ? until : iso(end);
    return { since: iso(start), until: endIso, preset, monthKey: key };
  }

  const year = Number(opts?.yearKey ?? today.getUTCFullYear());
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31));
  const endIso = iso(end) > until ? until : iso(end);
  return { since: iso(start), until: endIso, preset, yearKey: String(year) };
}

export function monthOptions(count = 12): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const value = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" });
    out.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) });
  }
  return out;
}

export function yearOptions(count = 4): { value: string; label: string }[] {
  const y = new Date().getUTCFullYear();
  return Array.from({ length: count }, (_, i) => {
    const year = String(y - i);
    return { value: year, label: year };
  });
}

/** CAQ = custo de aquisição por lead (investimento / leads). */
export function calcCaq(investimento: number, leads: number): number | null {
  if (leads <= 0) return null;
  return investimento / leads;
}
