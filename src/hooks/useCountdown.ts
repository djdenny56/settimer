import { useEffect, useRef, useState } from "react";

/**
 * Wall-clock countdown: stays accurate when the app is backgrounded or throttled.
 */
export function useCountdown(
  durationSec: number,
  running: boolean,
  onComplete: () => void,
  resetKey: unknown,
  phaseStartAtMs: number | null,
) {
  const [remaining, setRemaining] = useState(durationSec);
  const rafRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    setRemaining(durationSec);
  }, [resetKey, durationSec]);

  useEffect(() => {
    if (!running || phaseStartAtMs == null) {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const endAt = phaseStartAtMs + durationSec * 1000;
      const next = (endAt - Date.now()) / 1000;
      if (next <= 0) {
        setRemaining(0);
        onCompleteRef.current();
        return;
      }
      setRemaining(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [running, resetKey, durationSec, phaseStartAtMs]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      if (!running || phaseStartAtMs == null) return;
      const endAt = phaseStartAtMs + durationSec * 1000;
      const next = (endAt - Date.now()) / 1000;
      if (next <= 0) {
        setRemaining(0);
        onCompleteRef.current();
      } else {
        setRemaining(next);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [running, resetKey, durationSec, phaseStartAtMs]);

  return remaining;
}
