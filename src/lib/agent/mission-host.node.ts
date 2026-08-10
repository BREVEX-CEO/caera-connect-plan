/**
 * One mission, one set of live sidecars, held between actions.
 *
 * WHY THIS HAS TO EXIST
 * ---------------------
 * Per-action permission means the agent loop runs in the browser: it has to be
 * able to stop between two tool calls and wait for a person to answer. That in
 * turn means each tool call arrives as its own request to the server.
 *
 * Constructing `OcadeAdapters` per request would be correct-looking and
 * completely broken. `browser_open` stores a Playwright session id on the
 * adapter instance; a fresh instance on the next call has no session, so
 * "open Chrome, then read the page" fails on step two, every time. The Python
 * host has the same problem more expensively — a new interpreter, a new COM
 * apartment and a cold UI Automation initialisation for every click.
 *
 * So the sidecars live for the mission, not the request.
 *
 * WHAT KEEPS THAT FROM BECOMING A LEAK
 * -------------------------------------
 * 1. **An idle deadline.** A mission untouched for `IDLE_MS` is disposed by the
 *    next sweep. A browser tab that closes mid-task cannot leave a Chrome
 *    window and a Python process running on somebody's machine indefinitely.
 * 2. **A hard ceiling on concurrent missions.** Reached, the oldest is stopped.
 *    An unbounded map keyed by a client-supplied id is a way to exhaust a
 *    machine by asking politely many times.
 * 3. **Stopping releases input first.** `input.release` runs before the sidecars
 *    are killed. Disposing a host mid-drag would otherwise leave the left mouse
 *    button held down with nothing left alive to let go of it — the machine in
 *    a worse state than the task found it, and no way for the user to see why.
 */

import type { OcadeAdapters } from "./adapters.node";

/** How long a mission may go untouched before it is cleaned up. */
const IDLE_MS = 5 * 60 * 1000;
const MAX_MISSIONS = 4;

export interface Mission {
  id: string;
  adapters: OcadeAdapters;
  startedAt: number;
  touchedAt: number;
  /** Set the moment a stop is requested, so in-flight work can refuse to continue. */
  stopping: boolean;
  /** Named so a report can say which door this mission came through. */
  via: "account" | "local-demo";
  actions: number;
}

const missions = new Map<string, Mission>();
let sweeper: ReturnType<typeof setInterval> | null = null;

function sweep(): void {
  const now = Date.now();
  for (const mission of [...missions.values()]) {
    if (now - mission.touchedAt > IDLE_MS) void stopMission(mission.id, "It was left idle.");
  }
  if (missions.size === 0 && sweeper) {
    clearInterval(sweeper);
    sweeper = null;
  }
}

function ensureSweeper(): void {
  if (sweeper) return;
  sweeper = setInterval(sweep, 30_000);
  // Never hold the process open for a cleanup timer.
  sweeper.unref?.();
}

export function newMissionId(): string {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function openMission(
  id: string,
  adapters: OcadeAdapters,
  via: Mission["via"],
): Promise<Mission> {
  if (missions.size >= MAX_MISSIONS) {
    const oldest = [...missions.values()].sort((a, b) => a.touchedAt - b.touchedAt)[0];
    if (oldest) await stopMission(oldest.id, "Another mission needed the computer.");
  }
  const mission: Mission = {
    id,
    adapters,
    startedAt: Date.now(),
    touchedAt: Date.now(),
    stopping: false,
    via,
    actions: 0,
  };
  missions.set(id, mission);
  ensureSweeper();
  return mission;
}

export function findMission(id: string): Mission | null {
  const mission = missions.get(id);
  if (!mission) return null;
  mission.touchedAt = Date.now();
  return mission;
}

/**
 * End a mission: let go of the input, then drop the sidecars.
 *
 * Safe to call twice, and safe to call on an id that never existed — a stop
 * arriving after a crash, or twice from an impatient user, must not itself be
 * an error.
 */
export async function stopMission(
  id: string,
  reason = "The user stopped it.",
): Promise<{ stopped: boolean; released: boolean; reason: string }> {
  const mission = missions.get(id);
  if (!mission) return { stopped: false, released: false, reason: "That mission is not running." };
  mission.stopping = true;
  missions.delete(id);

  let released = false;
  try {
    const outcome = await mission.adapters.releaseHeldInput();
    released = outcome;
  } catch {
    released = false;
  }
  try {
    mission.adapters.dispose();
  } catch {
    /* already gone */
  }
  return { stopped: true, released, reason };
}

/** Every running mission, for a shutdown path or a status screen. */
export async function stopAllMissions(reason: string): Promise<number> {
  const ids = [...missions.keys()];
  for (const id of ids) await stopMission(id, reason);
  return ids.length;
}

export function missionCount(): number {
  return missions.size;
}
