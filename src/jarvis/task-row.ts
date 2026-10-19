/** A JARVIS task as every surface and the server read it. */
import type { TaskStatus } from "./protocol";

export const TASK_COLUMNS =
  "id, conversation_id, device_id, title, plan, current_step, status, blocker, result, browser_mode, checkpoint, created_at, updated_at";

export interface JarvisTaskRow {
  id: string;
  conversation_id: string;
  device_id: string | null;
  title: string;
  plan: string[];
  current_step: number;
  status: TaskStatus;
  blocker: string | null;
  result: string | null;
  browser_mode: "isolated" | "real";
  checkpoint: {
    intelligenceQuality?: "standard" | "high";
    step: number;
    lastAction: string;
    lastUrl: string | null;
    at: string;
  } | null;
  created_at: string;
  updated_at: string;
}
