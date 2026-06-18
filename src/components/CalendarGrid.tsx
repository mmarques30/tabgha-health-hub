import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalEvent = {
  id: string;
  date: string;
  title: string;
  type: "conteudo" | "agendamento" | "gravacao";
  sub?: string;
};

const TYPE_COLOR: Record<string, string> = {
  conteudo:    "bg-accent text-accent-foreground",
  agendamento: "bg-yellow-100 text-yellow-700",
  gravacao:    "bg-green-100 text-green-700",
};

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function mondayFirst(d: Date) {
  const day = getDay(d);
  return day === 0 ? 6 : day - 1;
}

type Props = {
  events: CalEvent[];
  filters?: React.ReactNode;
  onMonthChange?: (month: Date) => void;
};

export function CalendarGrid({ events, filters, onMonthChange }: Props) {
  const [month, setMonth] = useState(new Date());

  const navMonth = (delta: number) =>
    setMonth((m) => {
      const n = new Date(m);
      n.setMonth(n.getMonth() + delta);
      onMonthChange?.(n);
      return n;
    });

  const firstDay = startOfMonth(month);
  const lastDay = endOfMonth(month);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });

  const leadingEmpty = mondayFirst(firstDay);
  const trailingEmpty = (7 - ((leadingEmpty + days.length) % 7)) % 7;

  const eventsForDay = (d: Date) =>
    events.filter((e) => {
      const eDate = new Date(e.date.slice(0, 10) + "T00:00:00");
      return isSameDay(eDate, d);
    });

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-semibold capitalize">
            {format(month, "MMMM yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => { const n = new Date(); setMonth(n); onMonthChange?.(n); }}>
            Hoje
          </Button>
        </div>
        {filters && <div className="flex items-center gap-2">{filters}</div>}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-accent inline-block" />Conteúdo</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-yellow-100 border border-yellow-200 inline-block" />Reunião/agendamento</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-green-100 border border-green-200 inline-block" />Gravação</span>
      </div>

      {/* Grid */}
      <div className="rounded-xl border border-border overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-secondary">
          {WEEKDAYS.map((wd) => (
            <div key={wd} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {wd}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 border-t border-border">
          {Array.from({ length: leadingEmpty }).map((_, i) => (
            <div key={`l${i}`} className="min-h-[80px] border-b border-r border-border bg-secondary/20" />
          ))}

          {days.map((day, idx) => {
            const dayEvents = eventsForDay(day);
            const today = isToday(day);
            const isLast = leadingEmpty + idx === leadingEmpty + days.length - 1;
            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[80px] p-1.5 border-b border-r border-border",
                  today && "bg-blue-50/60",
                  isLast && "border-r-0",
                )}
              >
                <div className={cn(
                  "mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-semibold",
                  today ? "bg-primary text-primary-foreground" : "text-foreground",
                )}>
                  {format(day, "d")}
                </div>
                <div className="flex flex-col gap-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      title={ev.title + (ev.sub ? ` · ${ev.sub}` : "")}
                      className={cn(
                        "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                        TYPE_COLOR[ev.type] ?? "bg-secondary text-muted-foreground",
                      )}
                    >
                      {ev.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 3} mais</div>
                  )}
                </div>
              </div>
            );
          })}

          {Array.from({ length: trailingEmpty }).map((_, i) => (
            <div key={`t${i}`} className={cn("min-h-[80px] border-b border-r border-border bg-secondary/20", i === trailingEmpty - 1 && "border-r-0")} />
          ))}
        </div>
      </div>
    </div>
  );
}
