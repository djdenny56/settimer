## Workout Timer App

A single-page app at `/` with two views: a **Setup** screen and a **Running** screen. No routing beyond `/`, no backend, no accounts. Settings persist in `localStorage`.

### Setup screen

Number inputs (with +/− steppers, mobile-friendly) for:
- Reps per set
- Time per rep (seconds)
- Rest between reps (seconds)
- Number of sets
- Rest between sets (seconds)
- Toggle: **Double set** (e.g. left arm / right arm)
  - When on, shows: Rest between sides (seconds)

A big **Start** button.

### Running screen

Full-screen countdown showing:
- Large numeric timer (current phase remaining, tenths precision)
- Phase label: `Rep`, `Rest`, `Switch sides`, `Set rest`, `Done`
- Sub-line: `Set 2/4 · Rep 5/10` and, when double-set is on, `Side A` / `Side B`
- Pause / Resume, Skip phase, Stop (back to Setup)

### Timer flow

For each set (1..N):
- Side loop (once, or A then B if double set):
  - For each rep (1..reps): Rep timer → Rest between reps (skipped after last rep of the side)
  - If double set and just finished Side A: Rest between sides → repeat loop for Side B
- If not last set: Rest between sets
- After last set: Done

### Cues

At the **end** of every phase (rep, rep-rest, side-switch, set-rest, and workout end):
- Play a short "ding" via WebAudio (oscillator, no asset file needed)
- Call `navigator.vibrate(...)` — short pulse for rep/rest, longer pattern for set end, distinctive pattern for workout complete
- First user interaction (Start button) unlocks audio on iOS

### Persistence

`localStorage` key `workout-timer-settings` holds the last-used values; loaded on mount, saved on change.

### Technical notes

- New files:
  - `src/routes/index.tsx` — replaces placeholder; hosts Setup ↔ Running state
  - `src/components/timer/SetupForm.tsx`
  - `src/components/timer/RunningTimer.tsx`
  - `src/components/timer/NumberField.tsx` (labeled number input with steppers)
  - `src/lib/timer/schedule.ts` — pure function building the phase list from settings
  - `src/lib/timer/cues.ts` — WebAudio ding + `navigator.vibrate` helper
  - `src/hooks/useCountdown.ts` — `requestAnimationFrame` loop with pause/resume, resilient to tab-hide via `performance.now()` deltas
- Uses existing shadcn tokens/utilities; no new deps.
- Update `src/routes/__root.tsx` head: title `Workout Timer`, matching description/og/twitter tags; viewport already set.
- Screen wake lock (`navigator.wakeLock.request('screen')`) requested when running so the phone doesn't sleep mid-workout; silently ignored where unsupported.
- No design-direction exploration — the UI is a straightforward mobile-first single screen consistent with the request for "incredibly simple."
