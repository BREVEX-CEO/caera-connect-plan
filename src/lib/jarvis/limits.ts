/**
 * UX-22: the limits a running task keeps, in one place so the planner enforces exactly what the person
 * is told. A task that is still open stops by itself after this many steps that could not be done.
 */
export const MAX_FAILED_STEPS = 5;

export const LIMIT_NOTE =
  `JARVIS stops by itself after ${MAX_FAILED_STEPS} steps that could not be done. ` +
  "STOP ends the task at any time.";
