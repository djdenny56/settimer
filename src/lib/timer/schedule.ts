export type Settings = {
  sets: number;
  timePerSet: number;
  restBetweenSets: number;
  doubleSet: boolean;
  restBetweenSides: number;
};

export type PhaseKind = "set" | "switch" | "setRest";

export type Phase = {
  kind: PhaseKind;
  duration: number; // seconds
  setIndex: number; // 0-based
  side: "A" | "B" | null;
};

export const DEFAULT_SETTINGS: Settings = {
  sets: 3,
  timePerSet: 30,
  restBetweenSets: 60,
  doubleSet: false,
  restBetweenSides: 10,
};

export function buildSchedule(s: Settings): Phase[] {
  const phases: Phase[] = [];
  const sides: Array<"A" | "B" | null> = s.doubleSet ? ["A", "B"] : [null];

  for (let set = 0; set < s.sets; set++) {
    sides.forEach((side, sideIdx) => {
      phases.push({
        kind: "set",
        duration: s.timePerSet,
        setIndex: set,
        side,
      });
      if (s.doubleSet && sideIdx === 0 && s.restBetweenSides > 0) {
        phases.push({
          kind: "switch",
          duration: s.restBetweenSides,
          setIndex: set,
          side: null,
        });
      }
    });
    if (set < s.sets - 1 && s.restBetweenSets > 0) {
      phases.push({
        kind: "setRest",
        duration: s.restBetweenSets,
        setIndex: set,
        side: null,
      });
    }
  }
  return phases;
}

export function phaseLabel(p: Phase): string {
  switch (p.kind) {
    case "set":
      return "Set";
    case "switch":
      return "Switch sides";
    case "setRest":
      return "Rest";
  }
}
