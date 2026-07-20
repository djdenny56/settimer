import { ArrowLeft } from "lucide-react";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "@/lib/appSettings";

export function SettingsPanel({
  settings: s,
  setSettings: setS,
  onClose,
}: {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  onClose: () => void;
}) {
  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto text-white"
      style={{ background: `linear-gradient(to bottom, ${s.appBg}dd, ${s.appBg})` }}
    >
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6">
        <header className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-black tracking-tight">Settings</h1>
        </header>

        <div className="flex flex-col gap-4">
          <Row label="App title" tileBg={s.tileBg}>
            <input
              type="text"
              value={s.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={40}
              className="w-full rounded-lg bg-white/10 px-3 py-2 text-base font-bold text-white outline-none focus:bg-white/20"
            />
          </Row>

          <Row label="App background" tileBg={s.tileBg}>
            <ColorPicker value={s.appBg} onChange={(v) => set("appBg", v)} />
          </Row>

          <Row label="Tile background" tileBg={s.tileBg}>
            <ColorPicker value={s.tileBg} onChange={(v) => set("tileBg", v)} />
          </Row>

          <Row label="Show milliseconds" tileBg={s.tileBg}>
            <label className="flex items-center justify-between">
              <span className="text-sm opacity-80">Countdown shows .0–.9</span>
              <input
                type="checkbox"
                checked={s.showMs}
                onChange={(e) => set("showMs", e.target.checked)}
                className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-white/20 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition-transform before:shadow-sm checked:bg-gradient-to-r checked:from-yellow-300 checked:via-pink-400 checked:to-cyan-300 checked:before:translate-x-5"
              />
            </label>
          </Row>

          <Row label="Sound" tileBg={s.tileBg}>
            <label className="flex items-center justify-between">
              <span className="text-sm opacity-80">Play ding at phase changes</span>
              <input
                type="checkbox"
                checked={s.soundEnabled}
                onChange={(e) => set("soundEnabled", e.target.checked)}
                className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-white/20 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition-transform before:shadow-sm checked:bg-gradient-to-r checked:from-yellow-300 checked:via-pink-400 checked:to-cyan-300 checked:before:translate-x-5"
              />
            </label>
          </Row>

          <Row label="Vibration" tileBg={s.tileBg}>
            <label className="flex items-center justify-between">
              <span className="text-sm opacity-80">Buzz at phase changes (mobile)</span>
              <input
                type="checkbox"
                checked={s.vibrateEnabled}
                onChange={(e) => set("vibrateEnabled", e.target.checked)}
                className="relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-white/20 transition-colors before:absolute before:left-0.5 before:top-0.5 before:h-5 before:w-5 before:rounded-full before:bg-white before:transition-transform before:shadow-sm checked:bg-gradient-to-r checked:from-yellow-300 checked:via-pink-400 checked:to-cyan-300 checked:before:translate-x-5"
              />
            </label>
          </Row>

          <button
            type="button"
            onClick={() => setS(DEFAULT_APP_SETTINGS)}
            className="mt-2 self-start rounded-full bg-white/15 px-4 py-2 text-sm font-bold hover:bg-white/25"
          >
            Reset to defaults
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  tileBg,
  children,
}: {
  label: string;
  tileBg: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: tileBg }}>
      <div className="mb-2 text-xs font-extrabold uppercase tracking-wider opacity-80">
        {label}
      </div>
      {children}
    </div>
  );
}

const PRESETS = [
  "#8B3A1F",
  "#C65D34",
  "#1a2045",
  "#2a1a4a",
  "#0f172a",
  "#134e4a",
  "#7c2d12",
  "#4c1d95",
  "#831843",
  "#065f46",
];

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={c}
            className={`h-8 w-8 rounded-full border-2 transition-transform ${
              value.toLowerCase() === c.toLowerCase()
                ? "border-white scale-110"
                : "border-white/20"
            }`}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 cursor-pointer rounded border border-white/20 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg bg-white/10 px-3 py-2 font-mono text-sm text-white outline-none focus:bg-white/20"
        />
      </div>
    </div>
  );
}
