import { Capacitor } from "@capacitor/core";
import { Haptics, NotificationType } from "@capacitor/haptics";

let ctx: AudioContext | null = null;

type NavigatorWithAudioSession = Navigator & {
  audioSession?: { type: string };
};

function configurePlaybackAudioSession() {
  const session = (navigator as NavigatorWithAudioSession).audioSession;
  if (!session) return;
  try {
    session.type = "playback";
  } catch {
    // ignore — unsupported browser
  }
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    configurePlaybackAudioSession();
  }
  return ctx;
}

async function ensureAudioReady(): Promise<AudioContext | null> {
  configurePlaybackAudioSession();
  const c = getCtx();
  if (!c) return null;
  if (c.state === "suspended") {
    try {
      await c.resume();
    } catch {
      // ignore
    }
  }
  return c;
}

export function unlockAudio() {
  void ensureAudioReady();
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") unlockAudio();
  });
}

function ding(frequency: number, duration: number, when = 0) {
  void ensureAudioReady().then((c) => {
    if (!c || c.state !== "running") return;
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
  });
}

function hapticNotification(type: NotificationType) {
  void Haptics.notification({ type }).catch(() => {});
}

/** Core Haptics continuous pulse — more reliable than impact feedback in silent mode. */
function hapticPulse(durationMs: number) {
  void Haptics.vibrate({ duration: durationMs }).catch(() => {
    hapticNotification(NotificationType.Warning);
  });
}

function hapticPattern(steps: number[]) {
  let delay = 0;
  for (let i = 0; i < steps.length; i++) {
    const ms = steps[i];
    if (i % 2 === 0) {
      const at = delay;
      setTimeout(() => hapticPulse(ms), at);
    }
    delay += ms;
  }
}

function vibrateWeb(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // ignore
    }
  }
}

export type CueKind = "set" | "switch" | "setRest" | "done";

let cueOptions = { sound: true, vibrate: true };

export function setCueOptions(opts: { sound: boolean; vibrate: boolean }) {
  cueOptions = opts;
}

function vibrateCue(kind: CueKind) {
  if (Capacitor.isNativePlatform()) {
    switch (kind) {
      case "set":
        hapticNotification(NotificationType.Success);
        hapticPulse(150);
        break;
      case "switch":
        hapticNotification(NotificationType.Warning);
        hapticPattern([120, 80, 120]);
        break;
      case "setRest":
        hapticNotification(NotificationType.Warning);
        hapticPattern([200, 100, 200]);
        break;
      case "done":
        hapticNotification(NotificationType.Success);
        setTimeout(() => hapticNotification(NotificationType.Success), 420);
        setTimeout(() => hapticNotification(NotificationType.Error), 840);
        hapticPattern([300, 120, 300, 120, 500]);
        break;
    }
    return;
  }

  switch (kind) {
    case "set":
      vibrateWeb(150);
      break;
    case "switch":
      vibrateWeb([120, 80, 120]);
      break;
    case "setRest":
      vibrateWeb([200, 100, 200]);
      break;
    case "done":
      vibrateWeb([300, 120, 300, 120, 500]);
      break;
  }
}

export function playCue(kind: CueKind) {
  void ensureAudioReady();

  const s = cueOptions.sound ? ding : () => {};
  const v = cueOptions.vibrate ? () => vibrateCue(kind) : () => {};

  switch (kind) {
    case "set":
      s(880, 0.25);
      v();
      break;
    case "switch":
      s(780, 0.2);
      s(980, 0.2, 0.22);
      v();
      break;
    case "setRest":
      s(700, 0.25);
      s(900, 0.25, 0.28);
      v();
      break;
    case "done":
      s(880, 0.25);
      s(1100, 0.25, 0.28);
      s(1320, 0.4, 0.56);
      v();
      break;
  }
}
