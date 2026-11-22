/**
 * PROBLEM RADAR (plan 28.1.3): deterministic checks over the person's own records only —
 * LifeOS obligations, schedules, folder watches and paired computers. No model, no new reads,
 * no monitoring of anything the person has not already given OCADE. Each finding cites the
 * record it comes from and a fingerprint that changes only when its evidence changes, so a
 * dismissed finding comes back only if something material changed.
 */
import { obligationSignal } from "./lifeos.ts";

export type Severity = "high" | "medium" | "low";
export type RadarSource = "LifeOS" | "Schedules" | "Watches" | "Computers";

export interface Finding {
  fingerprint: string;
  severity: Severity;
  source: RadarSource;
  title: string;
  evidence: string;
  fix: string;
}

export interface RadarInput {
  today: string;
  soon: string;
  obligations?: {
    id: string;
    title: string;
    source: string;
    due_on: string | null;
    snoozed_until: string | null;
    completed: boolean;
  }[];
  schedules?: {
    id: string;
    what: string;
    device_id: string | null;
    active: boolean;
    last_outcome: string | null;
    last_run_at: string | null;
  }[];
  watches?: { id: string; device_id: string; folder: string; what: string; active: boolean }[];
  devices?: { id: string; name: string; state: string }[];
}

/** Outcomes the scheduler writes when a run did what it should. */
const RAN = new Set(["Task started", "Reminder sent", "Ended on its end date"]);
const RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function obligationSeverity(signal: string): Severity {
  if (signal === "Past the date you entered." || signal === "Due today.") return "high";
  if (signal === "Due in the next seven days.") return "medium";
  return "low";
}

const OBLIGATION_FIX: Record<string, string> = {
  "Past the date you entered.": "Open it in LifeOS: finish it, mark it done, or change the date.",
  "Due today.": "Open it in LifeOS and finish it, or snooze it to a date you choose.",
  "Due in the next seven days.": "Check what it needs now, so nothing is missing on the day.",
  "No due date recorded.": "Add the date from its source, or leave it waiting on purpose.",
  "No source recorded.": "Note where it came from, so the date can be checked later.",
};

export function problemRadar(input: RadarInput): Finding[] {
  const findings: Finding[] = [];
  const devices = new Map((input.devices ?? []).map((device) => [device.id, device]));

  const open = (input.obligations ?? []).filter((item) => !item.completed);
  for (const item of open) {
    const signal = obligationSignal(item, input.today, input.soon);
    if (!signal) continue;
    findings.push({
      fingerprint: `lifeos:${item.id}:${signal}:${item.due_on ?? ""}`,
      severity: obligationSeverity(signal),
      source: "LifeOS",
      title: item.title,
      evidence: item.due_on ? `${signal} Date: ${item.due_on}.` : signal,
      fix: OBLIGATION_FIX[signal]!,
    });
  }
  // The same obligation recorded twice with different dates: which one is right is unknown.
  const byTitle = new Map<string, typeof open>();
  for (const item of open) {
    const key = item.title.trim().toLowerCase().replace(/\s+/g, " ");
    byTitle.set(key, [...(byTitle.get(key) ?? []), item]);
  }
  for (const group of byTitle.values()) {
    const dates = [...new Set(group.map((item) => item.due_on ?? "no date"))].sort();
    if (group.length < 2 || dates.length < 2) continue;
    findings.push({
      fingerprint: `lifeos-conflict:${group
        .map((item) => item.id)
        .sort()
        .join(",")}:${dates.join(",")}`,
      severity: "medium",
      source: "LifeOS",
      title: group[0]!.title,
      evidence: `Recorded ${group.length} times with different dates: ${dates.join(", ")}.`,
      fix: "Check the source, keep the correct date and remove the other card.",
    });
  }

  for (const schedule of input.schedules ?? []) {
    const device = schedule.device_id ? devices.get(schedule.device_id) : undefined;
    if (schedule.active && schedule.device_id && (!device || device.state === "removed")) {
      findings.push({
        fingerprint: `schedule-device:${schedule.id}:removed`,
        severity: "high",
        source: "Schedules",
        title: schedule.what,
        evidence: "Scheduled for a computer that was removed. Its next run cannot start.",
        fix: "Edit the schedule and choose a paired computer, or delete it.",
      });
    } else if (schedule.active && device && device.state === "permission_required") {
      findings.push({
        fingerprint: `schedule-device:${schedule.id}:permission`,
        severity: "medium",
        source: "Schedules",
        title: schedule.what,
        evidence: `${device.name} has not given JARVIS permission to work in its folder.`,
        fix: "Open Settings › Devices and allow it, or the next run is refused.",
      });
    }
    if (schedule.last_outcome && !RAN.has(schedule.last_outcome)) {
      findings.push({
        fingerprint: `schedule-run:${schedule.id}:${schedule.last_run_at ?? ""}`,
        severity: "medium",
        source: "Schedules",
        title: schedule.what,
        evidence: `The last run did not start: ${schedule.last_outcome}`,
        fix: "Fix what the message names; the next run tries again by itself.",
      });
    }
  }

  for (const watch of input.watches ?? []) {
    const device = devices.get(watch.device_id);
    if (!watch.active || (device && device.state !== "removed" && device.state !== "offline"))
      continue;
    const removed = !device || device.state === "removed";
    findings.push({
      fingerprint: `watch:${watch.id}:${removed ? "removed" : "offline"}`,
      severity: removed ? "high" : "low",
      source: "Watches",
      title: `${watch.folder}: ${watch.what}`,
      evidence: removed
        ? "Watches a folder on a computer that was removed. New files are not noticed."
        : `${device!.name} is offline, so new files are noticed only when it is back.`,
      fix: removed
        ? "Remove this watch, or add it again on a paired computer."
        : "Start OCADE on that computer.",
    });
  }

  return findings.sort(
    (a, b) => RANK[a.severity] - RANK[b.severity] || a.title.localeCompare(b.title),
  );
}
