import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { KeepAwake } from "@capacitor-community/keep-awake";
import { Minus, Pause, Play, Plus, RotateCcw, Settings as SettingsIcon, SkipForward, Star, X } from "lucide-react";
import {
  buildSchedule,
  DEFAULT_SETTINGS,
  phaseLabel,
  type Settings,
} from "@/lib/timer/schedule";
import { playCue, setCueOptions, unlockAudio } from "@/lib/timer/cues";
import { buildPiPPhases, prepareTimerPiP, stopTimerPiP, syncAndStartTimerPiP, syncTimerPiPState } from "@/lib/timer/timerPiP";
import { syncWatchTimerState, WatchSync } from "@/lib/watch/watchSync";
import { useCountdown } from "@/hooks/useCountdown";
import { useAppSettings } from "@/lib/appSettings";
import { SettingsPanel } from "@/components/SettingsPanel";

const STORAGE_KEY = "workout-timer-settings";
const FAVORITES_KEY = "workout-timer-favorites";

type Favorite = { id: string; name: string; settings: Settings };

function formatFavoriteName(s: Settings) {
  const base = `${s.sets} X ${s.timePerSet} X ${s.restBetweenSets}`;
  return s.doubleSet ? `${base} DBL` : base;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Set Timer" },
      {
        name: "description",
        content:
          "A dead-simple workout timer: sets, time per set, rest, and optional double-set with sound + vibration cues.",
      },
      { property: "og:title", content: "Set Timer" },
      {
        property: "og:description",
        content: "A dead-simple workout timer: sets, time per set, rest, and optional double-set with sound + vibration cues.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [appSettings, setAppSettings] = useAppSettings();
  const [showSettings, setShowSettings] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [idx, setIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [phaseStartAtMs, setPhaseStartAtMs] = useState<number | null>(null);
  const pauseRemainingRef = useRef(0);
  const prevIdxRef = useRef(0);
  const remainingRef = useRef(0);
  const pendingWatchCueRef = useRef<string | null>(null);
  const appActiveRef = useRef(true);

  const reorderFavorite = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    setFavorites((f) => {
      const from = f.findIndex((x) => x.id === fromId);
      const to = f.findIndex((x) => x.id === toId);
      if (from < 0 || to < 0) return f;
      const next = f.slice();
      const [m] = next.splice(from, 1);
      next.splice(to, 0, m);
      return next;
    });
  };

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
    } catch {
      // ignore
    }
    try {
      const raw = localStorage.getItem(FAVORITES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setFavorites(parsed);
      }
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

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
    } catch {
      // ignore
    }
  }, [favorites, loaded]);

  useEffect(() => {
    setCueOptions({ sound: appSettings.soundEnabled, vibrate: appSettings.vibrateEnabled });
  }, [appSettings.soundEnabled, appSettings.vibrateEnabled]);

  useEffect(() => {
    document.documentElement.style.backgroundColor = appSettings.appBg;
    document.body.style.backgroundColor = appSettings.appBg;
  }, [appSettings.appBg]);


  const schedule = useMemo(() => buildSchedule(settings), [settings]);
  const pipPhases = useMemo(() => buildPiPPhases(schedule, settings), [schedule, settings]);
  const current = schedule[idx];

  const syncFromWallClock = useCallback(() => {
    if (!running || paused || done || phaseStartAtMs == null) return;

    const now = Date.now();
    let phaseStart = phaseStartAtMs;
    let i = idx;

    while (i < schedule.length) {
      const durMs = schedule[i].duration * 1000;
      const phaseEnd = phaseStart + durMs;
      if (now < phaseEnd) {
        if (i !== idx) setIdx(i);
        if (phaseStart !== phaseStartAtMs) setPhaseStartAtMs(phaseStart);
        return;
      }
      phaseStart = phaseEnd;
      i++;
    }

    playCue("done");
    pendingWatchCueRef.current = "done";
    setDone(true);
    setRunning(false);
    setPhaseStartAtMs(null);
    stopTimerPiP();
  }, [running, paused, done, phaseStartAtMs, idx, schedule]);

  const advance = useCallback(() => {
    setIdx((i) => {
      const ending = schedule[i];
      const next = i + 1;
      if (next >= schedule.length) {
        playCue("done");
        pendingWatchCueRef.current = "done";
        setDone(true);
        setRunning(false);
        setPhaseStartAtMs(null);
        stopTimerPiP();
        return i;
      }
      if (ending) {
        playCue(ending.kind);
        pendingWatchCueRef.current = ending.kind;
      }
      return next;
    });
  }, [schedule]);

  const remaining = useCountdown(
    current?.duration ?? 0,
    running && !paused && !done,
    advance,
    idx,
    phaseStartAtMs,
  );

  remainingRef.current = remaining;

  useEffect(() => {
    if (!running || paused || done) return;
    if (prevIdxRef.current === idx) return;
    setPhaseStartAtMs(Date.now());
    prevIdxRef.current = idx;
  }, [idx, running, paused, done]);

  // Keep screen on while timer is active in the foreground (native + web fallback).
  useEffect(() => {
    const active = running && !done;
    if (!active) {
      if (Capacitor.isNativePlatform()) void KeepAwake.allowSleep().catch(() => {});
      return;
    }

    if (Capacitor.isNativePlatform()) {
      if (appActiveRef.current) void KeepAwake.keepAwake().catch(() => {});
    } else {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinel> };
      };
      let sentinel: WakeLockSentinel | null = null;
      if (nav.wakeLock && appActiveRef.current) {
        void nav.wakeLock.request("screen").then((s) => {
          sentinel = s;
        });
      }
      return () => {
        sentinel?.release().catch(() => {});
      };
    }

    return () => {
      if (Capacitor.isNativePlatform()) void KeepAwake.allowSleep().catch(() => {});
    };
  }, [running, done]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const appSub = App.addListener("appStateChange", ({ isActive }) => {
      appActiveRef.current = isActive;

      if (isActive) {
        void KeepAwake.allowSleep().catch(() => {});
        syncFromWallClock();
        if (running && !done) void KeepAwake.keepAwake().catch(() => {});
        return;
      }

      if (running && !paused && !done && phaseStartAtMs != null && appSettings.pipTimerEnabled) {
        void syncAndStartTimerPiP({
          enabled: appSettings.pipTimerEnabled,
          running,
          paused,
          done,
          showMs: appSettings.showMs,
          idx,
          phaseStartAtMs,
          tileBg: appSettings.tileBg,
          phases: pipPhases,
        });
      }
    });

    return () => {
      void appSub.then((h) => h.remove());
    };
  }, [running, done, paused, idx, phaseStartAtMs, pipPhases, appSettings.pipTimerEnabled, appSettings.showMs, appSettings.tileBg, syncFromWallClock]);

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  const start = () => {
    unlockAudio();
    if (appSettings.pipTimerEnabled) prepareTimerPiP();
    const now = Date.now();
    setIdx(0);
    setDone(false);
    setPaused(false);
    setRunning(true);
    setPhaseStartAtMs(now);
    prevIdxRef.current = 0;
  };
  const stop = () => {
    setRunning(false);
    setPaused(false);
    setDone(false);
    setIdx(0);
    setPhaseStartAtMs(null);
    stopTimerPiP();
  };

  const settingsMatch = (a: Settings, b: Settings) =>
    a.sets === b.sets &&
    a.timePerSet === b.timePerSet &&
    a.restBetweenSets === b.restBetweenSets &&
    a.doubleSet === b.doubleSet &&
    a.restBetweenSides === b.restBetweenSides;

  const activeFavoriteId = favorites.find((f) => settingsMatch(f.settings, settings))?.id ?? null;

  const saveFavorite = () => {
    const name = formatFavoriteName(settings);
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setFavorites((f) => [...f, { id, name, settings: { ...settings } }]);
  };

  const applyFavorite = (fav: Favorite) => {
    if (running) return;
    setSettings({ ...DEFAULT_SETTINGS, ...fav.settings });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteFavorite = (id: string) => {
    setFavorites((f) => f.filter((x) => x.id !== id));
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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    syncWatchTimerState({
      running,
      paused,
      done,
      remainingSec: remainingRef.current,
      phaseEndAtMs: phaseStartAtMs,
      phaseLabel: label,
      subline,
      title: appSettings.title,
      vibrateEnabled: appSettings.vibrateEnabled,
      cue: pendingWatchCueRef.current ?? undefined,
    });
    pendingWatchCueRef.current = null;
  }, [
    running,
    paused,
    done,
    idx,
    phaseStartAtMs,
    label,
    subline,
    appSettings.title,
    appSettings.vibrateEnabled,
    remaining,
  ]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    syncTimerPiPState({
      enabled: appSettings.pipTimerEnabled,
      running,
      paused,
      done,
      showMs: appSettings.showMs,
      idx,
      phaseStartAtMs,
      tileBg: appSettings.tileBg,
      phases: pipPhases,
    });
  }, [
    running,
    paused,
    done,
    idx,
    phaseStartAtMs,
    pipPhases,
    appSettings.pipTimerEnabled,
    appSettings.showMs,
    appSettings.tileBg,
    remaining,
  ]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const sub = WatchSync.addListener("watchCommand", ({ command }) => {
      if (command === "pause" && running && !paused && !done) {
        pauseRemainingRef.current = remainingRef.current;
        setPaused(true);
      } else if (command === "resume" && running && paused && !done) {
        const phase = schedule[idx];
        if (phase) {
          setPhaseStartAtMs(
            Date.now() - (phase.duration - pauseRemainingRef.current) * 1000,
          );
        }
        setPaused(false);
      } else if (command === "skip" && running && !done) {
        advance();
      }
    });

    return () => {
      void sub.then((h) => h.remove());
    };
  }, [running, paused, done, schedule, idx, advance]);

  return (
    <div
      className="min-h-screen text-white pt-[env(safe-area-inset-top,0px)] pr-[env(safe-area-inset-right,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)]"
      style={{ background: `linear-gradient(to bottom, ${appSettings.appBg}dd, ${appSettings.appBg})` }}
    >
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6">
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight">{appSettings.title}</h1>
            <p className="text-sm font-semibold opacity-80">Set it up, then hit start.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <SettingsIcon className="h-5 w-5" />
          </button>
        </header>

        {showSettings && (
          <SettingsPanel
            settings={appSettings}
            setSettings={setAppSettings}
            onClose={() => setShowSettings(false)}
          />
        )}

        {/* Timer display */}
        <div className="rounded-[2rem] bg-gradient-to-br from-yellow-300 via-pink-400 to-cyan-300 p-1 shadow-2xl shadow-black/25">
          <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-[calc(2rem-4px)] px-4 py-8" style={{ background: appSettings.tileBg }}>
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
                  {appSettings.showMs && <span className="text-3xl opacity-80">.{tenths}</span>}
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
                <span className="flex h-full w-full items-center justify-center rounded-full text-white transition-opacity hover:opacity-90" style={{ background: appSettings.tileBg }}>
                  <RotateCcw className="h-5 w-5" />
                </span>
              </button>
              <div className="flex-1 rounded-full bg-gradient-to-r from-yellow-300 via-pink-400 to-cyan-300 p-1 shadow-xl shadow-black/25">
                <button
                  onClick={() => {
                    unlockAudio();
                    if (paused) {
                      const phase = schedule[idx];
                      if (phase) {
                        setPhaseStartAtMs(
                          Date.now() - (phase.duration - pauseRemainingRef.current) * 1000,
                        );
                      }
                      setPaused(false);
                    } else {
                      pauseRemainingRef.current = remainingRef.current;
                      setPaused(true);
                    }
                  }}
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
                <span className="flex h-full w-full items-center justify-center rounded-full text-white transition-opacity hover:opacity-90" style={{ background: appSettings.tileBg }}>
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

        {/* Favorites */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-extrabold uppercase tracking-wider opacity-90">
              Favorites
            </span>
            <button
              type="button"
              onClick={saveFavorite}
              disabled={running || activeFavoriteId !== null}
              className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-primary shadow-md transition-transform active:scale-95 disabled:opacity-50"
            >
              <Star className="h-3.5 w-3.5 fill-current" />
              Save
            </button>
          </div>
          {favorites.length === 0 ? (
            <p className="rounded-2xl px-4 py-2.5 text-xs font-semibold opacity-70" style={{ background: appSettings.tileBg }}>
              Save your current setup to recall it in one tap.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {favorites.map((fav) => {
                const active = fav.id === activeFavoriteId;
                const isDragOver = dragOverId === fav.id && dragId !== fav.id;
                return (
                  <div
                    key={fav.id}
                    draggable={!running}
                    onDragStart={(e) => {
                      if (running) return;
                      setDragId(fav.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(e) => {
                      if (dragId === null) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                      if (dragOverId !== fav.id) setDragOverId(fav.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverId === fav.id) setDragOverId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragId) reorderFavorite(dragId, fav.id);
                      setDragId(null);
                      setDragOverId(null);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOverId(null);
                    }}
                    className={`relative rounded-xl p-0.5 transition-all ${
                      active
                        ? "bg-gradient-to-br from-yellow-300 via-pink-400 to-cyan-300"
                        : ""
                    } ${dragId === fav.id ? "opacity-40" : ""} ${
                      isDragOver ? "scale-105 ring-2 ring-white/70" : ""
                    } ${running ? "" : "cursor-grab active:cursor-grabbing"}`}
                    style={active ? undefined : { background: appSettings.tileBg }}
                  >
                    <button
                      type="button"
                      onClick={() => applyFavorite(fav)}
                      disabled={running}
                      className={`flex min-h-[2.75rem] w-full items-center justify-center rounded-[calc(0.75rem-2px)] px-1.5 py-2 text-center text-sm font-extrabold leading-tight transition-opacity disabled:opacity-50 ${
                        active
                          ? "bg-white text-primary"
                          : "text-white hover:opacity-90"
                      }`}
                      title={`${fav.settings.sets} sets · ${fav.settings.timePerSet}s · ${fav.settings.restBetweenSets}s rest${fav.settings.doubleSet ? " · double" : ""}`}
                    >
                      {formatFavoriteName(fav.settings)}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteFavorite(fav.id)}
                      aria-label={`Delete ${fav.name}`}
                      className={`absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full shadow-md transition-colors ${
                        active
                          ? "bg-primary text-white hover:bg-primary/90"
                          : "bg-white text-primary hover:bg-white/90"
                      }`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
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
            tileBg={appSettings.tileBg}
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
            tileBg={appSettings.tileBg}
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
            tileBg={appSettings.tileBg}
          />
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3">
          <div
            className={`rounded-2xl ${running ? "opacity-60" : ""}`}
            style={{ background: appSettings.tileBg }}
          >
            <label className="flex flex-row items-center justify-between gap-3 px-4 py-2">
              <span className="text-sm font-bold">Double set</span>
              <input
                type="checkbox"
                disabled={running}
                className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-white/20 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition-transform before:shadow-sm checked:bg-gradient-to-r checked:from-yellow-300 checked:via-pink-400 checked:to-cyan-300 checked:before:translate-x-5 disabled:opacity-50"
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
              tileBg={appSettings.tileBg}
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
  tileBg,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  disabled?: boolean;
  tileBg?: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div
      className={`rounded-2xl p-3 ${disabled ? "opacity-60" : ""}`}
      style={{ background: tileBg ?? "#2a1a4a" }}
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
