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
        content: "Set it up and go. Sound + vibration cues on every phase.",
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-900 to-fuchsia-900 text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.35),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.30),transparent_45%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6">
        <header className="mb-4">
          <h1 className="text-2xl font-black tracking-tight">Workout Timer</h1>
          <p className="text-sm font-semibold opacity-80">Set it up, then hit start.</p>
        </header>

        {/* Timer display */}
        <div className="rounded-[2rem] bg-gradient-to-br from-yellow-300 via-pink-400 via-cyan-300 to-lime-300 p-1 shadow-2xl shadow-black/25">
          <div className="relative flex flex-col items-center gap-2 overflow-hidden rounded-[calc(2rem-4px)] bg-white/15 px-4 py-8 backdrop-blur-sm">
            <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-yellow-300 via-pink-400 via-cyan-300 to-lime-300" />
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-lime-300 via-cyan-300 via-pink-400 to-yellow-300 opacity-60" />
            <div className="text-sm font-extrabold uppercase tracking-widest opacity-90">
              {label}
            </div>
            <div className="flex items-baseline font-black tabular-nums leading-none drop-shadow-md">
              <span className="text-8xl">{seconds}</span>
              <span className="text-3xl opacity-80">.{tenths}</span>
            </div>
            <div className="text-sm font-bold opacity-85">{subline}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-5 flex items-center justify-center gap-3">
          {!running && !done && (
            <div className="flex-1 rounded-full bg-gradient-to-r from-yellow-300 via-pink-400 via-cyan-300 to-lime-300 p-1 shadow-xl shadow-black/25">
              <button
                onClick={start}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white px-8 text-lg font-extrabold text-primary transition-transform active:scale-[0.98]"
              >
                <Play className="h-5 w-5 fill-current" />
                Start
              </button>
            </div>
          )}
          {running && (
            <>
              <button
                onClick={stop}
                aria-label="Stop"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 via-pink-400 to-cyan-300 p-0.5 transition-transform active:scale-[0.96]"
              >
                <span className="flex h-full w-full items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/40">
                  <RotateCcw className="h-5 w-5" />
                </span>
              </button>
              <div className="flex-1 rounded-full bg-gradient-to-r from-yellow-300 via-pink-400 via-cyan-300 to-lime-300 p-1 shadow-xl shadow-black/25">
                <button
                  onClick={() => setPaused((p) => !p)}
                  aria-label={paused ? "Resume" : "Pause"}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white px-8 text-lg font-extrabold text-primary transition-transform active:scale-[0.98]"
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
              </div>
              <button
                onClick={advance}
                aria-label="Skip"
                className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 via-pink-400 to-yellow-300 p-0.5 transition-transform active:scale-[0.96]"
              >
                <span className="flex h-full w-full items-center justify-center rounded-full bg-black/30 text-white transition-colors hover:bg-black/40">
                  <SkipForward className="h-5 w-5" />
                </span>
              </button>
            </>
          )}
          {done && (
            <div className="flex-1 rounded-full bg-gradient-to-r from-yellow-300 via-pink-400 via-cyan-300 to-lime-300 p-1 shadow-xl shadow-black/25">
              <button
                onClick={stop}
                className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white px-8 text-lg font-extrabold text-primary transition-transform active:scale-[0.98]"
              >
                <RotateCcw className="h-5 w-5" />
                Reset
              </button>
            </div>
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
            className={`flex items-center justify-between gap-4 rounded-2xl bg-white/15 p-4 ring-1 ring-white/10 ${
              running ? "opacity-60" : ""
            }`}
          >
            <div className="flex flex-col">
              <span className="text-sm font-bold">Double set</span>
              <span className="text-xs font-semibold opacity-80">
                e.g. left arm, then right arm
              </span>
            </div>
            <input
              type="checkbox"
              disabled={running}
              className="relative h-6 w-11 cursor-pointer appearance-none rounded-full bg-black/30 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition-transform before:shadow-sm checked:bg-white checked:before:translate-x-5"
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
      className={`rounded-2xl bg-gradient-to-br from-yellow-300/80 via-pink-400/80 via-cyan-300/80 to-lime-300/80 p-[1px] ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-4 rounded-[calc(1rem-1px)] bg-white/15 p-4 backdrop-blur-sm">
        <div className="flex flex-col">
          <span className="text-sm font-bold">{label}</span>
          {suffix && <span className="text-xs font-semibold opacity-80">{suffix}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            aria-label={`Decrease ${label}`}
            onClick={() => onChange(clamp(value - step))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 via-pink-400 to-cyan-300 p-0.5 shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <span className="flex h-full w-full items-center justify-center rounded-full bg-white">
              <Minus className="h-5 w-5 stroke-[3] text-primary" />
            </span>
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
            className="w-16 rounded-xl bg-white/95 px-2 py-2 text-center text-lg font-extrabold tabular-nums text-primary outline-none focus:ring-2 focus:ring-white disabled:opacity-70"
          />
          <button
            type="button"
            disabled={disabled}
            aria-label={`Increase ${label}`}
            onClick={() => onChange(clamp(value + step))}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-300 via-pink-400 to-yellow-300 p-0.5 shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            <span className="flex h-full w-full items-center justify-center rounded-full bg-white">
              <Plus className="h-5 w-5 stroke-[3] text-primary" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
