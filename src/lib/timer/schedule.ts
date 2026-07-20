export type Settings = {
  reps: number;
  timePerRep: number;
  restBetweenReps: number;
  sets: number;
  restBetweenSets: number;
  doubleSet: boolean;
  restBetweenSides: number;
};

export type PhaseKind = "rep" | "rest" | "switch" | "setRest";

export type Phase = {
  kind: PhaseKind;
  duration: number; // seconds
  setIndex: number; // 0-based
  repIndex: number; // 0-based; -1 for non-rep phases
  side: "A" | "B" | null;
};

export const DEFAULT_SETTINGS: Settings = {
  reps: 10,
  timePerRep: 3,
  restBetweenReps: 1,
  sets: 3,
  restBetweenSets: 60,
  doubleSet: false,
  restBetweenSides: 10,
};

export function buildSchedule(s: Settings): Phase[] {
  const phases: Phase[] = [];
  const sides: Array<"A" | "B" | null> = s.doubleSet ? ["A", "B"] : [null];

  for (let set = 0; set < s.sets; set++) {
    sides.forEach((side, sideIdx) => {
      for (let rep = 0; rep < s.reps; rep++) {
        phases.push({
          kind: "rep",
          duration: s.timePerRep,
          setIndex: set,
          repIndex: rep,
          side,
        });
        const isLastRep = rep === s.reps - 1;
        if (!isLastRep && s.restBetweenReps > 0) {
          phases.push({
            kind: "rest",
            duration: s.restBetweenReps,
            setIndex: set,
            repIndex: rep,
            side,
          });
        }
      }
      // switch sides
      if (s.doubleSet && sideIdx === 0 && s.restBetweenSides > 0) {
        phases.push({
          kind: "switch",
          duration: s.restBetweenSides,
          setIndex: set,
          repIndex: -1,
          side: null,
        });
      }
    });
    if (set < s.sets - 1 && s.restBetweenSets > 0) {
      phases.push({
        kind: "setRest",
        duration: s.restBetweenSets,
        setIndex: set,
        repIndex: -1,
        side: null,
      });
    }
  }
  return phases;
}

export function phaseLabel(p: Phase): string {
  switch (p.kind) {
    case "rep":
      return "Rep";
    case "rest":
      return "Rest";
    case "switch":
      return "Switch sides";
    case "setRest":
      return "Set rest";
  }
}
