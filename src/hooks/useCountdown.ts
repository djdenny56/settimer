import { useEffect, useRef, useState } from "react";

/**
 * Countdown driven by performance.now() deltas so it stays accurate
 * across tab-hide / throttling.
 */
export function useCountdown(
  durationSec: number,
  running: boolean,
  onComplete: () => void,
  resetKey: unknown,
) {
  const [remaining, setRemaining] = useState(durationSec);
  const lastTickRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // reset when key or duration changes
  useEffect(() => {
    setRemaining(durationSec);
    lastTickRef.current = null;
  }, [resetKey, durationSec]);

  useEffect(() => {
    if (!running) {
      lastTickRef.current = null;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      return;
    }
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      const now = performance.now();
      if (lastTickRef.current == null) lastTickRef.current = now;
      const dt = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      setRemaining((r) => {
        const next = r - dt;
        if (next <= 0) {
          onCompleteRef.current();
          return 0;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [running, resetKey]);

  return remaining;
}
