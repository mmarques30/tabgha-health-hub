import { cn } from "@/lib/utils";

export type SubTabItem<T extends string> = {
  id: T;
  label: string;
  description?: string;
};

export function SubTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: SubTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-secondary/30 p-1">
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-lg px-3 py-2 text-left transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="block text-xs font-semibold">{tab.label}</span>
            {tab.description ? (
              <span className="mt-0.5 block text-[10px] text-muted-foreground">{tab.description}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
