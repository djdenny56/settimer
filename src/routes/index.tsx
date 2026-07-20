import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Pause, Play, Plus, RotateCcw, SkipForward } from "lucide-react";
import {
  buildSchedule,
  DEFAULT_SETTINGS,
  phaseLabel,
  type Settings,
} from "@/lib/timer/schedule";
import { playCue, unlockAudio } from "@/lib/timer/cues";
import { useCountdown } from "@/hooks/useCountdown";

const STORAGE_KEY = "workout-timer-settings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workout Timer" },
      {
        name: "description",
        content:
          "A dead-simple workout timer: sets, time per set, rest, and optional double-set with sound + vibration cues.",
      },
      { property: "og:title", content: "Workout Timer" },
      {
        property: "og:description",
        content:
          "Set it up and go. Sound + vibration cues on every phase.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const wakeRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings, loaded]);

  const schedule = useMemo(() => buildSchedule(settings), [settings]);
  const current = schedule[idx];

  // wake lock while running
  useEffect(() => {
    if (!running) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> };
    };
    if (nav.wakeLock) {
      nav.wakeLock
        .request("screen")
        .then((s) => {
          wakeRef.current = s;
        })
        .catch(() => {});
    }
    return () => {
      wakeRef.current?.release().catch(() => {});
      wakeRef.current = null;
    };
  }, [running]);

  const advance = () => {
    setIdx((i) => {
      const ending = schedule[i];
      const next = i + 1;
      if (next >= schedule.length) {
        playCue("done");
        setDone(true);
        setRunning(false);
        return i;
      }
      if (ending) playCue(ending.kind);
      return next;
    });
  };

  const remaining = useCountdown(
    current?.duration ?? 0,
    running && !paused && !done,
    advance,
    idx,
  );

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  const start = () => {
    unlockAudio();
    setIdx(0);
    setDone(false);
    setPaused(false);
    setRunning(true);
  };
  const stop = () => {
    setRunning(false);
    setPaused(false);
    setDone(false);
    setIdx(0);
  };

  const displayRemaining = running
    ? Math.max(0, remaining)
    : settings.timePerSet;
  const seconds = Math.floor(displayRemaining);
  const tenths = Math.floor((displayRemaining - seconds) * 10);

  const label = done
    ? "Done"
    : running && current
      ? phaseLabel(current)
      : "Ready";

  const subline =
    running && current
      ? `Set ${current.setIndex + 1}/${settings.sets}${current.side ? ` · Side ${current.side}` : ""}`
      : `${settings.sets} sets · ${settings.timePerSet}s`;

  return (
    <div className="min-h-screen bg-primary text-primary-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6">
        <header className="mb-4">
          <h1 className="text-2xl font-bold tracking-tight">Workout Timer</h1>
          <p className="text-sm opacity-75">Set it up, then hit start.</p>
        </header>

        {/* Timer display */}
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-black/15 px-4 py-8">
          <div className="text-sm font-medium uppercase tracking-widest opacity-80">
            {label}
          </div>
          <div className="flex items-baseline font-bold tabular-nums leading-none">
            <span className="text-8xl">{seconds}</span>
            <span className="text-3xl opacity-70">.{tenths}</span>
          </div>
          <div className="text-sm opacity-80">{subline}</div>
        </div>

        {/* Controls */}
        <div className="mt-5 flex items-center justify-center gap-3">
          {!running && !done && (
            <button
              onClick={start}
              className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-lg font-semibold text-primary shadow-lg transition-transform active:scale-[0.98]"
            >
              <Play className="h-5 w-5 fill-current" />
              Start
            </button>
          )}
          {running && (
            <>
              <button
                onClick={stop}
                aria-label="Stop"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-black/20 hover:bg-black/30"
              >
                <RotateCcw className="h-5 w-5" />
              </button>
              <button
                onClick={() => setPaused((p) => !p)}
                aria-label={paused ? "Resume" : "Pause"}
                className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-lg font-semibold text-primary shadow-lg transition-transform active:scale-[0.98]"
              >
                {paused ? (
                  <>
                    <Play className="h-5 w-5 fill-current" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-5 w-5" />
                    Pause
                  </>
                )}
              </button>
              <button
                onClick={advance}
                aria-label="Skip"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-black/20 hover:bg-black/30"
              >
                <SkipForward className="h-5 w-5" />
              </button>
            </>
          )}
          {done && (
            <button
              onClick={stop}
              className="flex h-16 flex-1 items-center justify-center gap-2 rounded-2xl bg-white text-lg font-semibold text-primary shadow-lg transition-transform active:scale-[0.98]"
            >
              <RotateCcw className="h-5 w-5" />
              Reset
            </button>
          )}
        </div>

        {/* Setup */}
        <div className="mt-6 flex flex-col gap-3">
          <Field
            label="Number of sets"
            value={settings.sets}
            onChange={(v) => set("sets", v)}
            min={1}
            max={99}
            disabled={running}
          />
          <Field
            label="Time per set"
            suffix="seconds"
            value={settings.timePerSet}
            onChange={(v) => set("timePerSet", v)}
            min={1}
            max={3600}
            step={5}
            disabled={running}
          />
          <Field
            label="Rest between sets"
            suffix="seconds"
            value={settings.restBetweenSets}
            onChange={(v) => set("restBetweenSets", v)}
            min={0}
            max={3600}
            step={5}
            disabled={running}
          />

          <label
            className={`flex items-center justify-between gap-4 rounded-xl bg-black/15 p-4 ${
              running ? "opacity-60" : ""
            }`}
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">Double set</span>
              <span className="text-xs opacity-75">
                e.g. left arm, then right arm
              </span>
            </div>
            <input
              type="checkbox"
              disabled={running}
              className="relative h-6 w-11 cursor-pointer appearance-none rounded-full bg-black/30 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition-transform checked:bg-white/40 checked:before:translate-x-5"
              checked={settings.doubleSet}
              onChange={(e) => set("doubleSet", e.target.checked)}
            />
          </label>

          {settings.doubleSet && (
            <Field
              label="Rest between sides"
              suffix="seconds"
              value={settings.restBetweenSides}
              onChange={(v) => set("restBetweenSides", v)}
              min={0}
              max={600}
              disabled={running}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  min = 0,
  max = 9999,
  step = 1,
  suffix,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl bg-black/15 p-4 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {suffix && <span className="text-xs opacity-75">{suffix}</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - step))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 transition-colors hover:bg-black/40 active:scale-95 disabled:opacity-50"
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
          disabled={disabled}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) onChange(clamp(n));
          }}
          className="w-16 rounded-md bg-white/95 px-2 py-2 text-center text-lg font-semibold tabular-nums text-primary outline-none focus:ring-2 focus:ring-white disabled:opacity-70"
        />
        <button
          type="button"
          disabled={disabled}
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + step))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/25 transition-colors hover:bg-black/40 active:scale-95 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
