import { Minus, Plus } from "lucide-react";

type Props = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
};

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  suffix,
}: Props) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {suffix && (
          <span className="text-xs text-muted-foreground">{suffix}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - step))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80 active:scale-95"
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(clamp(n));
          }}
          className="w-16 rounded-md border border-input bg-background px-2 py-2 text-center text-lg font-semibold tabular-nums text-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + step))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80 active:scale-95"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
