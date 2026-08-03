/**
 * OCADE world scan (master plan §5.3).
 *
 * User-controlled monitoring of things that change: local incidents, weather,
 * transport, markets, company news, regulations, outages, advisories. The plan
 * is emphatic about the boundaries — monitoring must be "opt-in, rate-limited,
 * source-cited, and revocable" — so this module is those four rules made
 * mechanical, independent of the fetch that will one day feed it.
 *
 * WHY EACH RULE IS ENFORCED IN CODE, NOT LEFT TO POLICY:
 *
 *  - **Opt-in:** a monitor exists only because the user created it. There is no
 *    default watch list; nothing is monitored implicitly.
 *  - **Rate-limited:** every monitor has a minimum interval, and `dueChecks`
 *    will not report a monitor due before it has elapsed. A monitor cannot be
 *    made to poll faster than its floor, so an over-eager schedule can't hammer
 *    a source.
 *  - **Source-cited:** a monitor must name the sources it will watch. A monitor
 *    with no source is refused — an alert you can't trace is a rumour.
 *  - **Revocable:** `revoke` genuinely removes it, and a revoked monitor is
 *    never reported as due again. Pausing is distinct from revoking.
 *
 * Pure and local. It decides WHAT is due and WHETHER a monitor is well-formed;
 * it never fetches.
 */

export type ScanTopic =
  | "local_incident"
  | "weather"
  | "transport"
  | "market"
  | "company_news"
  | "regulation"
  | "outage"
  | "security_advisory"
  | "project";

export type MonitorState = "active" | "paused";

export interface Monitor {
  id: string;
  topic: ScanTopic;
  /** What the user is watching, in their words. */
  subject: string;
  /** Sources this monitor will consult. Required, non-empty. */
  sources: string[];
  /** Minimum ms between checks. Floored per topic; see MIN_INTERVAL. */
  intervalMs: number;
  state: MonitorState;
  createdAt: string;
  lastCheckedAt: string | null;
}

export type ScanOutcome<T> =
  { ok: true; data: T; evidence: string } | { ok: false; reason: string };

/**
 * Rate floors per topic. A market can be polled more often than a regulation,
 * but nothing may poll faster than its floor — this is the rate limit.
 */
export const MIN_INTERVAL_MS: Record<ScanTopic, number> = {
  local_incident: 5 * 60 * 1000,
  weather: 30 * 60 * 1000,
  transport: 5 * 60 * 1000,
  market: 60 * 1000,
  company_news: 60 * 60 * 1000,
  regulation: 24 * 60 * 60 * 1000,
  outage: 5 * 60 * 1000,
  security_advisory: 60 * 60 * 1000,
  project: 60 * 60 * 1000,
};

export interface CreateMonitorInput {
  id: string;
  topic: ScanTopic;
  subject: string;
  sources: string[];
  /** Requested interval; raised to the topic floor if lower. */
  intervalMs: number;
  now?: Date;
}

export class WorldScan {
  private monitors = new Map<string, Monitor>();

  /**
   * Create a monitor. Refuses the two states that would break the contract: no
   * sources (untraceable alerts) and — handled by flooring — too-fast polling.
   */
  create(input: CreateMonitorInput): ScanOutcome<Monitor> {
    if (!input.subject.trim()) return { ok: false, reason: "A monitor needs a subject to watch." };
    if (input.sources.length === 0) {
      return {
        ok: false,
        reason:
          "A monitor must name at least one source. OCADE won't raise an alert it can't trace back to where it came from.",
      };
    }
    if (this.monitors.has(input.id)) {
      return { ok: false, reason: `A monitor with id “${input.id}” already exists.` };
    }

    const floor = MIN_INTERVAL_MS[input.topic];
    // The rate limit: a requested interval below the floor is raised, never
    // honoured. It cannot be configured away.
    const intervalMs = Math.max(input.intervalMs, floor);

    const monitor: Monitor = {
      id: input.id,
      topic: input.topic,
      subject: input.subject.trim(),
      sources: [...input.sources],
      intervalMs,
      state: "active",
      createdAt: (input.now ?? new Date()).toISOString(),
      lastCheckedAt: null,
    };
    this.monitors.set(monitor.id, monitor);

    return {
      ok: true,
      data: monitor,
      evidence:
        intervalMs > input.intervalMs
          ? `Watching “${monitor.subject}”. Interval raised to the ${describeInterval(floor)} floor for ${input.topic} to protect the source.`
          : `Watching “${monitor.subject}” every ${describeInterval(intervalMs)}.`,
    };
  }

  /** Which active monitors are due a check now, respecting their interval. */
  dueChecks(now: Date = new Date()): Monitor[] {
    const due: Monitor[] = [];
    for (const m of this.monitors.values()) {
      if (m.state !== "active") continue; // paused/revoked are never due
      if (m.lastCheckedAt === null) {
        due.push(m);
        continue;
      }
      const elapsed = now.getTime() - Date.parse(m.lastCheckedAt);
      if (elapsed >= m.intervalMs) due.push(m);
    }
    return due;
  }

  /** Record that a monitor was checked, so it isn't due again until its interval elapses. */
  markChecked(id: string, now: Date = new Date()): ScanOutcome<Monitor> {
    const m = this.monitors.get(id);
    if (!m) return { ok: false, reason: "No such monitor." };
    m.lastCheckedAt = now.toISOString();
    return {
      ok: true,
      data: m,
      evidence: `“${m.subject}” checked; next due in ${describeInterval(m.intervalMs)}.`,
    };
  }

  pause(id: string): ScanOutcome<Monitor> {
    const m = this.monitors.get(id);
    if (!m) return { ok: false, reason: "No such monitor." };
    m.state = "paused";
    return {
      ok: true,
      data: m,
      evidence: `Paused “${m.subject}”. It won't be checked until resumed.`,
    };
  }

  resume(id: string): ScanOutcome<Monitor> {
    const m = this.monitors.get(id);
    if (!m) return { ok: false, reason: "No such monitor." };
    m.state = "active";
    return { ok: true, data: m, evidence: `Resumed “${m.subject}”.` };
  }

  /**
   * Revoke a monitor — genuinely remove it. A revoked monitor can never be due
   * again because it no longer exists; revoking is distinct from pausing.
   */
  revoke(id: string): ScanOutcome<{ revoked: boolean }> {
    if (!this.monitors.delete(id)) {
      return { ok: false, reason: "That monitor isn't here — nothing was revoked." };
    }
    return { ok: true, data: { revoked: true }, evidence: "Monitor revoked and removed." };
  }

  list(): Monitor[] {
    return [...this.monitors.values()];
  }

  /**
   * Serialise for on-device persistence. Monitors are the user's own opt-in
   * watch list, so they survive a reload — nothing here leaves the device.
   */
  toJSON(): Monitor[] {
    return this.list();
  }

  /**
   * Rehydrate from persisted monitors, re-applying the rate floor to each so a
   * value tampered below the floor in storage can't survive a reload.
   */
  static fromJSON(data: unknown): WorldScan {
    const scan = new WorldScan();
    if (!Array.isArray(data)) return scan;
    for (const raw of data) {
      if (typeof raw !== "object" || raw === null) continue;
      const m = raw as Partial<Monitor>;
      if (typeof m.id !== "string" || typeof m.subject !== "string" || !Array.isArray(m.sources))
        continue;
      if (m.sources.length === 0) continue; // a source-less monitor is never valid
      const topic = (m.topic ?? "project") as ScanTopic;
      const floor = MIN_INTERVAL_MS[topic] ?? MIN_INTERVAL_MS.project;
      scan.monitors.set(m.id, {
        id: m.id,
        topic,
        subject: m.subject,
        sources: [...m.sources],
        intervalMs: Math.max(typeof m.intervalMs === "number" ? m.intervalMs : floor, floor),
        state: m.state === "paused" ? "paused" : "active",
        createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
        lastCheckedAt: typeof m.lastCheckedAt === "string" ? m.lastCheckedAt : null,
      });
    }
    return scan;
  }
}

function describeInterval(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const hours = Math.round(min / 60);
  return hours < 24 ? `${hours} h` : `${Math.round(hours / 24)} d`;
}
