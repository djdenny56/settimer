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

  const currentDuration = current?.duration ?? settings.timePerSet;
  const progress =
    currentDuration > 0
      ? Math.max(0, Math.min(1, displayRemaining / currentDuration))
      : 1;
  const timerOffset = TIMER_CIRCUMFERENCE * (1 - progress);

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
    <div className="min-h-screen bg-gradient-to-b from-[#C65D34] to-[#8B3A1F] text-white">
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6">
        <header className="mb-4">
          <h1 className="text-2xl font-black tracking-tight">Workout Timer</h1>
          <p className="text-sm font-semibold opacity-80">Set it up, then hit start.</p>
        </header>

        {/* Timer display */}
        <div className="rounded-[2rem] bg-gradient-to-br from-yellow-300 via-pink-400 to-cyan-300 p-1 shadow-2xl shadow-black/25">
          <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-[calc(2rem-4px)] bg-[#2a1a4a] px-4 py-8">
            <div className="relative flex h-60 w-60 items-center justify-center">
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100">
                <defs>
                  <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#fde047" />
                    <stop offset="50%" stopColor="#f472b6" />
                    <stop offset="100%" stopColor="#67e8f9" />
                  </linearGradient>
                </defs>
                <circle
                  cx="50"
                  cy="50"
                  r={TIMER_R}
                  fill="none"
                  stroke="rgba(255,255,255,0.15)"
                  strokeWidth="6"
                />
                <circle
                  cx="50"
                  cy="50"
                  r={TIMER_R}
                  fill="none"
                  stroke="url(#timerGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                  strokeDasharray={TIMER_CIRCUMFERENCE}
                  strokeDashoffset={timerOffset}
                  
                />
              </svg>

              <div className="relative z-10 flex flex-col items-center gap-2">
                <div className="text-base font-extrabold uppercase tracking-widest opacity-90">
                  {label}
                </div>
                <div className="flex items-baseline font-black tabular-nums leading-none drop-shadow-md">
                  <span className="text-8xl">{seconds}</span>
                  <span className="text-3xl opacity-80">.{tenths}</span>
                </div>
                <div className="text-base font-bold opacity-85">{subline}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-5 flex items-center justify-center gap-3">
          {!running && !done && (
            <div className="flex-1 rounded-full bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-300 p-1 shadow-xl shadow-black/25">
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
                <span className="flex h-full w-full items-center justify-center rounded-full bg-[#2a1a4a] text-white transition-colors hover:bg-[#362260]">
                  <RotateCcw className="h-5 w-5" />
                </span>
              </button>
              <div className="flex-1 rounded-full bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-300 p-1 shadow-xl shadow-black/25">
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
                <span className="flex h-full w-full items-center justify-center rounded-full bg-[#2a1a4a] text-white transition-colors hover:bg-[#362260]">
                  <SkipForward className="h-5 w-5" />
                </span>
              </button>
            </>
          )}
          {done && (
            <div className="flex-1 rounded-full bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-300 p-1 shadow-xl shadow-black/25">
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
        <div className="mt-6 grid grid-cols-3 gap-3">
          <Field
            label="Sets"
            value={settings.sets}
            onChange={(v) => set("sets", v)}
            min={1}
            max={99}
            disabled={running}
          />
          <Field
            label="Time / set"
            suffix="sec"
            value={settings.timePerSet}
            onChange={(v) => set("timePerSet", v)}
            min={1}
            max={3600}
            step={5}
            disabled={running}
          />
          <Field
            label="Rest"
            suffix="sec"
            value={settings.restBetweenSets}
            onChange={(v) => set("restBetweenSets", v)}
            min={0}
            max={3600}
            step={5}
            disabled={running}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3">
          <div
            className={`rounded-2xl bg-[#2a1a4a] ${
              running ? "opacity-60" : ""
            }`}
          >
            <label className="flex flex-row items-center justify-between gap-3 px-4 py-2">
              <span className="text-sm font-bold">Double set</span>
              <input
                type="checkbox"
                disabled={running}
                className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-300 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition-transform before:shadow-sm checked:from-cyan-300 checked:via-pink-400 checked:to-yellow-300 checked:before:translate-x-5"
                checked={settings.doubleSet}
                onChange={(e) => set("doubleSet", e.target.checked)}
              />
            </label>
          </div>

          {settings.doubleSet && (
            <Field
              label="Switch rest"
              suffix="sec"
              value={settings.restBetweenSides}
              onChange={(v) => set("restBetweenSides", v)}
              min={0}
              max={600}
              step={5}
              disabled={running}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const TIMER_R = 46;
const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_R;

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
      className={`rounded-2xl bg-[#2a1a4a] p-3 ${
        disabled ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-col items-center gap-2">
        <span className="text-center text-xs font-bold leading-tight">{label}</span>
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
          className="w-full appearance-none rounded-xl bg-white/95 px-1 py-1 text-center text-2xl font-extrabold tabular-nums text-primary outline-none focus:ring-2 focus:ring-white disabled:opacity-70"
        />
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
        {suffix && <span className="text-[10px] font-semibold opacity-70">{suffix}</span>}
      </div>
    </div>
  );
}
