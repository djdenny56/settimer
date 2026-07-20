import { Play } from "lucide-react";
import { NumberField } from "./NumberField";
import type { Settings } from "@/lib/timer/schedule";

type Props = {
  settings: Settings;
  onChange: (s: Settings) => void;
  onStart: () => void;
};

export function SetupForm({ settings, onChange, onStart }: Props) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    onChange({ ...settings, [k]: v });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-4 px-4 py-8">
      <header className="mb-2">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Workout Timer
        </h1>
        <p className="text-sm text-muted-foreground">
          Set it up, then hit start.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <NumberField
          label="Number of sets"
          value={settings.sets}
          onChange={(v) => set("sets", v)}
          min={1}
          max={99}
        />
        <NumberField
          label="Time per set"
          suffix="seconds"
          value={settings.timePerSet}
          onChange={(v) => set("timePerSet", v)}
          min={1}
          max={3600}
          step={5}
        />
        <NumberField
          label="Rest between sets"
          suffix="seconds"
          value={settings.restBetweenSets}
          onChange={(v) => set("restBetweenSets", v)}
          min={0}
          max={3600}
          step={5}
        />

        <label className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              Double set
            </span>
            <span className="text-xs text-muted-foreground">
              e.g. left arm, then right arm
            </span>
          </div>
          <input
            type="checkbox"
            className="h-6 w-11 cursor-pointer appearance-none rounded-full bg-secondary transition-colors checked:bg-primary relative before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-background before:transition-transform checked:before:translate-x-5"
            checked={settings.doubleSet}
            onChange={(e) => set("doubleSet", e.target.checked)}
          />
        </label>

        {settings.doubleSet && (
          <NumberField
            label="Rest between sides"
            suffix="seconds"
            value={settings.restBetweenSides}
            onChange={(v) => set("restBetweenSides", v)}
            min={0}
            max={600}
          />
        )}
      </div>

      <button
        onClick={onStart}
        className="mt-4 flex h-16 items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-lg transition-transform active:scale-[0.98]"
      >
        <Play className="h-5 w-5 fill-current" />
        Start
      </button>
    </div>
  );
}
