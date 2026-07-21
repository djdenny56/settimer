import { Capacitor, registerPlugin } from "@capacitor/core";
import { phaseLabel, type Phase, type Settings } from "@/lib/timer/schedule";

export type TimerPiPPhase = {
  label: string;
  durationSec: number;
  subline: string;
};

export type TimerPiPState = {
  enabled: boolean;
  running: boolean;
  paused: boolean;
  done: boolean;
  showMs: boolean;
  idx: number;
  phaseStartAtMs: number | null;
  tileBg: string;
  phases: TimerPiPPhase[];
};

type TimerPiPPlugin = {
  updateState(state: TimerPiPState): Promise<void>;
  prepare(): Promise<void>;
  start(): Promise<void>;
  isSupported(): Promise<{ supported: boolean }>;
  stop(): Promise<void>;
};

export const TimerPiP = registerPlugin<TimerPiPPlugin>("TimerPiP");

export function buildPiPPhases(schedule: Phase[], settings: Settings): TimerPiPPhase[] {
  return schedule.map((phase) => ({
    label: phaseLabel(phase),
    durationSec: phase.duration,
    subline: `Set ${phase.setIndex + 1}/${settings.sets}${
      phase.side ? ` · Side ${phase.side}` : ""
    }`,
  }));
}

export function syncTimerPiPState(state: TimerPiPState) {
  if (!Capacitor.isNativePlatform()) return;
  void TimerPiP.updateState(state).catch(() => {});
}

export function prepareTimerPiP() {
  if (!Capacitor.isNativePlatform()) return;
  void TimerPiP.prepare().catch(() => {});
}

export async function syncAndStartTimerPiP(state: TimerPiPState) {
  if (!Capacitor.isNativePlatform() || !state.enabled) return;
  if (!state.running || state.paused || state.done || state.phaseStartAtMs == null) return;
  try {
    await TimerPiP.updateState(state);
    await TimerPiP.start();
  } catch {
    // ignore
  }
}

export function stopTimerPiP() {
  if (!Capacitor.isNativePlatform()) return;
  void TimerPiP.stop().catch(() => {});
}
