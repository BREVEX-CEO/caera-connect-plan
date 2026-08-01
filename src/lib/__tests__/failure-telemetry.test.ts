import { describe, it, expect } from "vitest";
import {
  TelemetryQueue,
  buildReport,
  redact,
  newInstallId,
  containsOnlyAllowedFields,
  ALLOWED_FIELDS,
  MAX_QUEUE,
  type RawFailure,
  type TelemetryEnvironment,
} from "../telemetry/failure-telemetry";

/**
 * Opt-in, privacy-safe failure telemetry (HWE-38).
 *
 * A crash report is the most dangerous thing a product sends: generated when
 * things went wrong, from state nobody curated, routinely carrying file paths,
 * window titles and whatever the user was typing. These tests are mostly about
 * what must NOT leave the device.
 */

const ENV: TelemetryEnvironment = {
  osFamily: "windows",
  osVersion: "10.0.19045",
  ocadeVersion: "0.1.0",
  installId: "abc123",
};
const AT = new Date("2026-07-30T12:00:00.000Z");
const failure = (over: Partial<RawFailure> = {}): RawFailure => ({
  kind: "control_route_failed",
  failureCode: "stale_target",
  route: "accessibility",
  appId: "com.example.editor",
  appVersion: "4.1.0",
  ...over,
});

describe("telemetry is off until explicitly asked for", () => {
  it("collects nothing by default", () => {
    const q = new TelemetryQueue(ENV);
    expect(q.currentConsent).toBe("none");
    const r = q.record(failure());
    expect(r.queued).toBe(false);
    if (!r.queued) expect(r.refusal).toBe("no_consent");
    expect(q.size).toBe(0);
  });

  it("collects once consent is given", () => {
    const q = new TelemetryQueue(ENV, () => AT);
    q.setConsent("failures_only");
    expect(q.record(failure()).queued).toBe(true);
    expect(q.size).toBe(1);
  });

  it("DISCARDS what was already queued when consent is withdrawn", () => {
    // Revoking consent must not leave reports sitting on disk waiting to go.
    const q = new TelemetryQueue(ENV, () => AT);
    q.setConsent("failures_only");
    q.record(failure());
    expect(q.size).toBe(1);
    q.setConsent("none");
    expect(q.size).toBe(0);
  });

  it("keeps performance data behind its own consent level", () => {
    const q = new TelemetryQueue(ENV, () => AT);
    q.setConsent("failures_only");
    const r = q.record(failure({ kind: "unknown" }));
    expect(r.queued).toBe(false);
    if (!r.queued) expect(r.refusal).toBe("performance_not_consented");
  });
});

describe("only allow-listed fields ever leave the device", () => {
  it("drops every field the module has not heard of", () => {
    // An allow-list is the point: a deny-list fails OPEN, so the field someone
    // adds next week would be transmitted by default.
    const { report } = buildReport(
      failure({
        windowTitle: "Quarterly results FINAL.xlsx",
        clipboard: "my password is hunter2",
        userEmail: "alice@example.com",
        homeDir: "C:\\Users\\alice",
      }),
      ENV,
      AT,
    );
    const check = containsOnlyAllowedFields(report);
    expect(check.extra, "fields outside the allow-list were included").toEqual([]);
    expect(check.ok).toBe(true);

    const serialised = JSON.stringify(report);
    expect(serialised).not.toMatch(/Quarterly results/);
    expect(serialised).not.toMatch(/hunter2/);
    expect(serialised).not.toMatch(/alice@example\.com/);
    expect(serialised).not.toMatch(/C:\\\\Users/);
  });

  it("keeps the allow-list free of anything identifying a person or document", () => {
    for (const f of ALLOWED_FIELDS) {
      expect(f).not.toMatch(/name|email|title|path|file|user(?!.*id)|content|clipboard/i);
    }
  });

  it("includes the low-cardinality fields the compatibility work needs", () => {
    const { report } = buildReport(failure(), ENV, AT);
    expect(report.appId).toBe("com.example.editor");
    expect(report.appVersion).toBe("4.1.0");
    expect(report.failureCode).toBe("stale_target");
    expect(report.osFamily).toBe("windows");
  });
});

describe("redaction is a second line of defence on allowed fields", () => {
  it("removes absolute paths", () => {
    expect(redact("failed at C:\\Users\\alice\\secret.docx").value).toMatch(
      /\[redacted absolute path\]/,
    );
    expect(redact("failed at /home/alice/secret").value).toMatch(/\[redacted absolute path\]/);
  });

  it("removes emails, tokens and JWTs", () => {
    expect(redact("contact alice@example.com").value).toMatch(/\[redacted email\]/);
    expect(redact("key sk-abcdefghijklmnopqrst").value).toMatch(/\[redacted bearer token\]/);
    expect(redact("tok eyJhbGciOi.eyJzdWIiOi.sig").value).toMatch(/\[redacted jwt\]/);
  });

  it("removes IP addresses and long digit runs", () => {
    expect(redact("from 192.168.1.44").value).toMatch(/\[redacted ip address\]/);
    expect(redact("card 4111111111111111").value).toMatch(/\[redacted long digit run\]/);
  });

  it("names what it removed, so a user can see why a value looks odd", () => {
    const r = redact("alice@example.com at C:\\Users\\alice");
    expect(r.redactions).toContain("email");
    expect(r.redactions).toContain("absolute path");
  });

  it("catches a sensitive value that arrives inside an ALLOWED field", () => {
    // A failure code built from a file path is exactly the leak the allow-list
    // alone would not stop.
    const { report, redactions } = buildReport(
      failure({ failureCode: "cannot_read_C:\\Users\\alice\\tax.pdf" }),
      ENV,
      AT,
    );
    expect(String(report.failureCode)).toMatch(/\[redacted absolute path\]/);
    expect(redactions).toContain("absolute path");
  });

  it("leaves ordinary values untouched", () => {
    const r = redact("stale_target");
    expect(r.value).toBe("stale_target");
    expect(r.redactions).toEqual([]);
  });
});

describe("the install id identifies an install, not a person", () => {
  it("is random and differs between installs", () => {
    const a = newInstallId();
    const b = newInstallId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe("the queue is bounded and inspectable", () => {
  it("drops NEW reports when full, keeping the earliest failures", () => {
    // The first failure in a cascade is the informative one, and an unbounded
    // queue is a disk-fill an attacker can drive.
    const q = new TelemetryQueue(ENV, () => AT);
    q.setConsent("failures_only");
    for (let i = 0; i < MAX_QUEUE; i += 1) {
      expect(q.record(failure({ failureCode: `code_${i}` })).queued).toBe(true);
    }
    const overflow = q.record(failure({ failureCode: "code_last" }));
    expect(overflow.queued).toBe(false);
    if (!overflow.queued) expect(overflow.refusal).toBe("queue_full");
    expect(q.size).toBe(MAX_QUEUE);
    expect(q.pending()[0].failureCode).toBe("code_0");
  });

  it("lets the user read exactly what would be sent", () => {
    const q = new TelemetryQueue(ENV, () => AT);
    q.setConsent("failures_only");
    q.record(failure());
    const pending = q.pending();
    expect(pending).toHaveLength(1);
    expect(containsOnlyAllowedFields(pending[0]).ok).toBe(true);
  });

  it("returns copies, so a caller cannot mutate the queued report", () => {
    const q = new TelemetryQueue(ENV, () => AT);
    q.setConsent("failures_only");
    q.record(failure());
    const first = q.pending()[0] as Record<string, unknown>;
    first.failureCode = "tampered";
    expect(q.pending()[0].failureCode).toBe("stale_target");
  });

  it("can be cleared", () => {
    const q = new TelemetryQueue(ENV, () => AT);
    q.setConsent("failures_only");
    q.record(failure());
    q.clear();
    expect(q.size).toBe(0);
  });
});
