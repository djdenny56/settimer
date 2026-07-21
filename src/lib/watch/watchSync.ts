import { Capacitor, registerPlugin } from "@capacitor/core";

export type WatchTimerState = {
  running: boolean;
  paused: boolean;
  done: boolean;
  remainingSec: number;
  phaseEndAtMs: number | null;
  phaseLabel: string;
  subline: string;
  title: string;
  vibrateEnabled: boolean;
  cue?: string;
};

export type WatchCommand = "pause" | "resume" | "skip";

type WatchSyncPlugin = {
  updateState(state: WatchTimerState): Promise<void>;
  addListener(
    eventName: "watchCommand",
    listenerFunc: (event: { command: WatchCommand }) => void,
  ): Promise<{ remove: () => Promise<void> }>;
};

export const WatchSync = registerPlugin<WatchSyncPlugin>("WatchSync");

export function syncWatchTimerState(state: WatchTimerState) {
  if (!Capacitor.isNativePlatform()) return;
  void WatchSync.updateState(state).catch(() => {});
}
