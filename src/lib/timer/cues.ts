let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
}

function ding(frequency: number, duration: number, when = 0) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(0.35, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}

export type CueKind = "set" | "switch" | "setRest" | "done";

export function playCue(kind: CueKind) {
  switch (kind) {
    case "set":
      ding(880, 0.25);
      vibrate(150);
      break;
    case "switch":
      ding(780, 0.2);
      ding(980, 0.2, 0.22);
      vibrate([120, 80, 120]);
      break;
    case "setRest":
      ding(700, 0.25);
      ding(900, 0.25, 0.28);
      vibrate([200, 100, 200]);
      break;
    case "done":
      ding(880, 0.25);
      ding(1100, 0.25, 0.28);
      ding(1320, 0.4, 0.56);
      vibrate([300, 120, 300, 120, 500]);
      break;
  }
}
