import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listJarvisDevices, listJarvisSchedules, listJarvisWatches } from "@/lib/jarvis/functions";
import { civilDate } from "@/lib/jarvis/lifeos";
import { listObligations } from "@/lib/jarvis/lifeos.functions";
import { problemRadar, type RadarSource } from "@/lib/jarvis/problem-radar";

const button =
  "min-h-11 rounded-md border border-border px-2 text-xs hover:bg-accent disabled:opacity-60";
const SEVERITY = { high: "Needs attention", medium: "Check soon", low: "Worth a look" } as const;

/** Dismissals stay on this browser, per account; a finding returns when its evidence changes. */
function dismissedKey(account: string) {
  return `ocade.radar.dismissed.${account}`;
}
function readDismissed(account: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(dismissedKey(account)) ?? "[]");
    return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/**
 * PROBLEM RADAR (plan 28.1.3): one card per problem found in the person's own LifeOS,
 * schedules, folder watches and computers, with the evidence and the fix. A source that could
 * not be read is named, so "nothing found" is never shown for something that was not checked.
 */
export function ProblemRadar({ account }: { account: string }) {
  const lifeos = useQuery({
    queryKey: ["jarvis", "lifeos", account],
    queryFn: () => listObligations(),
  });
  const schedules = useQuery({
    queryKey: ["jarvis", "schedules", account],
    queryFn: () => listJarvisSchedules(),
  });
  const watches = useQuery({
    queryKey: ["jarvis", "watches", account],
    queryFn: () => listJarvisWatches(),
  });
  const devices = useQuery({
    queryKey: ["jarvis", "devices", account],
    queryFn: () => listJarvisDevices(),
  });
  const [dismissed, setDismissed] = useState(() => readDismissed(account));
  const remember = (next: string[]) => {
    setDismissed(next);
    try {
      localStorage.setItem(dismissedKey(account), JSON.stringify(next.slice(-200)));
    } catch {
      // Storage full or blocked: the dismissal lasts for this visit only.
    }
  };

  const sources: [RadarSource, { isPending: boolean; isError: boolean }][] = [
    ["LifeOS", lifeos],
    ["Schedules", schedules],
    ["Watches", watches],
    ["Computers", devices],
  ];
  if (sources.some(([, query]) => query.isPending)) {
    return <p role="status">Checking for problems…</p>;
  }
  const unread = sources.filter(([, query]) => query.isError).map(([name]) => name);
  const week = new Date();
  week.setDate(week.getDate() + 7);
  const findings = problemRadar({
    today: civilDate(new Date()),
    soon: civilDate(week),
    obligations: lifeos.data,
    schedules: schedules.data,
    watches: watches.data,
    devices: devices.data,
  });
  const shown = findings.filter((finding) => !dismissed.includes(finding.fingerprint));
  const hidden = findings.length - shown.length;

  return (
    <section aria-labelledby="problem-radar" className="grid gap-2">
      <h3 id="problem-radar" className="text-sm font-medium">
        Problem Radar
      </h3>
      <p className="text-xs text-muted-foreground" role="status">
        {shown.length
          ? `${shown.length} ${shown.length === 1 ? "problem" : "problems"} found in your own records.`
          : unread.length
            ? "No problems found in what could be read."
            : "No problems found in your obligations, schedules, watches or computers."}
      </p>
      {unread.length ? (
        <p className="text-xs" role="alert">
          Not checked: {unread.join(", ")} could not be read just now.
        </p>
      ) : null}
      {shown.length ? (
        <ul className="grid gap-2">
          {shown.map((finding) => (
            <li
              key={finding.fingerprint}
              className={`grid gap-1 rounded-lg border p-2 text-xs [overflow-wrap:anywhere] ${
                finding.severity === "high" ? "border-destructive" : "border-border"
              }`}
            >
              <p className="font-medium">
                {SEVERITY[finding.severity]} · {finding.source}
              </p>
              <strong className="text-sm">{finding.title}</strong>
              <p>{finding.evidence}</p>
              <p>Fix: {finding.fix}</p>
              <button
                className={`${button} justify-self-start`}
                type="button"
                onClick={() => remember([...dismissed, finding.fingerprint])}
              >
                Dismiss
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {hidden ? (
        <button
          className={`${button} justify-self-start`}
          type="button"
          onClick={() => remember([])}
        >
          Show {hidden} dismissed
        </button>
      ) : null}
    </section>
  );
}
