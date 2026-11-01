/** One accepted request budget across the composer, handoff and task authority. */
import { z } from "zod";

export const MAX_OBJECTIVE_LENGTH = 8_000;

/** Only surrounding whitespace is normalized; internal text and indentation are authority. */
export const taskObjective = z
  .string()
  .trim()
  .min(1, "Describe what JARVIS should do.")
  .max(MAX_OBJECTIVE_LENGTH, "Keep the request to 8,000 characters or fewer.");
