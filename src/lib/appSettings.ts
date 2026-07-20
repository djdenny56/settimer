import { useEffect, useState } from "react";

export type AppSettings = {
  title: string;
  appBg: string;
  tileBg: string;
  showMs: boolean;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  title: "Workout Timer",
  appBg: "#8B3A1F",
  tileBg: "#2a1a4a",
  showMs: true,
};

const KEY = "workout-timer-app-settings";

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULT_APP_SETTINGS, ...JSON.parse(raw) });
    } catch {
      // ignore
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings, loaded]);

  return [settings, setSettings] as const;
}
