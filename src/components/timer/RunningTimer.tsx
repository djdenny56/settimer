import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, SkipForward, X } from "lucide-react";
import {
  buildSchedule,
  phaseLabel,
  type Settings,
} from "@/lib/timer/schedule";
import { playCue, unlockAudio } from "@/lib/timer/cues";
import { useCountdown } from "@/hooks/useCountdown";

type Props = {
  settings: Settings;
  onExit: () => void;
};

export function RunningTimer({ settings, onExit }: Props) {
  const schedule = useMemo(() => buildSchedule(settings), [settings]);
  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(true);
  const [done, setDone] = useState(false);
  const wakeRef = useRef<WakeLockSentinel | null>(null);

  const current = schedule[idx];

  // wake lock
  useEffect(() => {
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
  }, []);

  useEffect(() => {
    unlockAudio();
  }, []);

  const advance = () => {
    setIdx((i) => {
      const next = i + 1;
      if (next >= schedule.length) {
        playCue("done");
        setDone(true);
        setRunning(false);
        return i;
      }
      // cue for phase that just ended
      const ending = schedule[i];
      playCue(ending.kind);
      return next;
    });
  };

  const remaining = useCountdown(
    current?.duration ?? 0,
    running && !done,
    advance,
    idx,
  );

  if (done) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
        <h1 className="text-4xl font-bold text-foreground">Done!</h1>
        <p className="text-muted-foreground">Nice work.</p>
        <button
          onClick={onExit}
          className="rounded-xl bg-primary px-8 py-4 text-lg font-semibold text-primary-foreground"
        >
          Back
        </button>
      </div>
    );
  }

  if (!current) return null;

  const totalSets = settings.sets;
  const displayRemaining = Math.max(0, remaining);
  const seconds = Math.floor(displayRemaining);
  const tenths = Math.floor((displayRemaining - seconds) * 10);

  const bg =
    current.kind === "set"
      ? "bg-primary text-primary-foreground"
      : current.kind === "switch"
        ? "bg-accent text-accent-foreground"
        : "bg-secondary text-secondary-foreground";

  return (
    <div className={`flex min-h-screen flex-col ${bg} transition-colors`}>
      <div className="flex items-center justify-between px-4 py-4">
        <button
          onClick={onExit}
          aria-label="Stop"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-black/10 hover:bg-black/20"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="text-sm font-medium opacity-80">
          Set {current.setIndex + 1}/{totalSets}
          {current.side && ` · Side ${current.side}`}
        </div>
        <div className="w-10" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="text-xl font-medium uppercase tracking-widest opacity-80">
          {phaseLabel(current)}
        </div>
        <div className="flex items-baseline font-bold tabular-nums leading-none">
          <span className="text-[9rem]">{seconds}</span>
          <span className="text-5xl opacity-70">.{tenths}</span>
        </div>
        <div className="text-lg font-medium opacity-80">&nbsp;</div>
      </div>

      <div className="flex items-center justify-center gap-4 px-4 pb-10">
        <button
          onClick={() => setRunning((r) => !r)}
          aria-label={running ? "Pause" : "Resume"}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-black/15 hover:bg-black/25"
        >
          {running ? (
            <Pause className="h-7 w-7" />
          ) : (
            <Play className="h-7 w-7 fill-current" />
          )}
        </button>
        <button
          onClick={advance}
          aria-label="Skip"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-black/15 hover:bg-black/25"
        >
          <SkipForward className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}
