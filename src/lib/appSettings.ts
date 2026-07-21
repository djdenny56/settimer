import { useEffect, useState } from "react";

export type AppSettings = {
  title: string;
  appBg: string;
  tileBg: string;
  showMs: boolean;
  soundEnabled: boolean;
  vibrateEnabled: boolean;
  pipTimerEnabled: boolean;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  title: "Workout Timer",
  appBg: "#8B3A1F",
  tileBg: "#2a1a4a",
  showMs: true,
  soundEnabled: true,
  vibrateEnabled: true,
  pipTimerEnabled: true,
};

const KEY = "workout-timer-app-settings";

function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings> & {
      backgroundNotificationEnabled?: boolean;
    };
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
      pipTimerEnabled:
        parsed.pipTimerEnabled ??
        parsed.backgroundNotificationEnabled ??
        DEFAULT_APP_SETTINGS.pipTimerEnabled,
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setSettings(loadAppSettings());
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
