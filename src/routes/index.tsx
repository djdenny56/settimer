import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SetupForm } from "@/components/timer/SetupForm";
import { RunningTimer } from "@/components/timer/RunningTimer";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/timer/schedule";
import { unlockAudio } from "@/lib/timer/cues";

const STORAGE_KEY = "workout-timer-settings";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Workout Timer" },
      {
        name: "description",
        content:
          "A dead-simple workout timer: reps, rest, sets, and double-set support with sound and vibration cues.",
      },
      { property: "og:title", content: "Workout Timer" },
      {
        property: "og:description",
        content:
          "Set reps, time per rep, and rest, then go. Sound + vibration cues on every phase.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [running, setRunning] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
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

  if (running) {
    return (
      <RunningTimer settings={settings} onExit={() => setRunning(false)} />
    );
  }

  return (
    <SetupForm
      settings={settings}
      onChange={setSettings}
      onStart={() => {
        unlockAudio();
        setRunning(true);
      }}
    />
  );
}
