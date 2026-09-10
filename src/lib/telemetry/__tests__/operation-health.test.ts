import { describe, expect, it } from "vitest";
import {
  ERROR_CLASSES,
  HEALTH_COMPONENTS,
  HEALTH_OPERATIONS,
  LATENCY_BUCKETS,
  PROVIDER_SLOTS,
  buildHealthRecord,
  healthRecordIsEnumerated,
  latencyBucketFor,
  rollUp,
  type HealthObservation,
} from "../operation-health";
import {
  ALLOWED_FIELDS,
  TelemetryQueue,
  containsOnlyAllowedFields,
  newInstallId,
} from "../failure-telemetry";

/*
 * STRUCTURED DIAGNOSTICS THAT CANNOT CARRY ANYBODY'S WORK -- PLAN.md Phase 16.
 *
 * The phase asks for release, operation, error class, latency, provider slot,
 * task, Edge Function and webhook health "without secrets or unnecessary
 * content". The interesting half of that is the second half, so most of this
 * file is adversarial: it hands the builder the things a careless caller
 * actually passes -- a prompt, an email address, a Gemini key, a file path,
 * an exception message -- and proves none of them survive into a record.
 */

const observation = (over: Partial<HealthObservation> = {}): HealthObservation => ({
  component: "edge_function",
  operation: "generation",
  outcome: "succeeded",
  durationMs: 420,
  providerSlot: "primary",
  ...over,
});

describe("a health record", () => {
  it("covers every dimension the phase names", () => {
    const record = buildHealthRecord(observation());
    // release, operation, error class, latency, provider slot -- and the
    // component, which is what makes an Edge Function, a webhook and a task
    // distinguishable rather than all being "the app".
    expect(record.release).toMatch(/^\d+\.\d+\.\d+/);
    expect(record.operation).toBe("generation");
    expect(record.errorClass).toBe("none");
    expect(record.latencyBucket).toBe("under_500ms");
    expect(record.providerSlot).toBe("primary");
    expect(record.component).toBe("edge_function");
    expect(healthRecordIsEnumerated(record).ok).toBe(true);
  });

  it("names an Edge Function, a webhook and a task apart from the web app", () => {
    for (const component of ["edge_function", "webhook", "task"] as const) {
      expect(buildHealthRecord(observation({ component })).component).toBe(component);
    }
  });

  it("has no field outside the enumerations, whatever it is handed", () => {
    const record = buildHealthRecord(observation());
    expect(Object.keys(record).sort()).toEqual([
      "attempts",
      "component",
      "errorClass",
      "latencyBucket",
      "operation",
      "outcome",
      "providerSlot",
      "release",
      "schemaVersion",
    ]);
  });
});

describe("what a careless caller cannot get into a record", () => {
  const smuggled = [
    "the user asked: my card number is 4111 1111 1111 1111",
    "alice@example.com",
    "AIzaSyD-EXAMPLE-EXAMPLE-EXAMPLE-EXAMPLE0",
    "/home/alice/Documents/Quarterly results FINAL.xlsx",
    "TypeError: cannot read property 'body' of undefined",
    "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature",
  ];

  it("refuses free text in the error class, the slot and the operation", () => {
    for (const value of smuggled) {
      const record = buildHealthRecord({
        // Each of these is typed, so a caller reaches this only by casting or
        // by passing data through from a server. Both happen.
        component: value as never,
        operation: value as never,
        outcome: value as never,
        errorClass: value as never,
        providerSlot: value as never,
        attempts: value as never,
      });
      const serialised = JSON.stringify(record);
      expect(serialised).not.toContain(value);
      expect(healthRecordIsEnumerated(record).ok).toBe(true);
      // An unrecognised outcome is treated as a failure, never as a success:
      // the safe default for a health signal is "something is wrong".
      expect(record.outcome).toBe("failed");
      expect(record.errorClass).toBe("internal");
      expect(record.providerSlot).toBe("none");
      expect(record.attempts).toBe(1);
    }
  });

  it("never records a key, only which of the three slots served", () => {
    const record = buildHealthRecord(
      observation({ providerSlot: "AIzaSyD-EXAMPLE-EXAMPLE-EXAMPLE" as never }),
    );
    expect(PROVIDER_SLOTS).toContain(record.providerSlot);
    expect(record.providerSlot).toBe("none");
  });

  it("keeps latency as a bucket, so a duration cannot fingerprint a session", () => {
    // Two distinct durations a millisecond apart must be indistinguishable in
    // the record if they belong to the same bucket.
    expect(latencyBucketFor(1_501)).toBe(latencyBucketFor(1_502));
    expect(LATENCY_BUCKETS).toContain(latencyBucketFor(Number.NaN));
    expect(latencyBucketFor(-5)).toBe("under_100ms");
    expect(latencyBucketFor(60_000)).toBe("over_30s");
    expect(JSON.stringify(buildHealthRecord(observation({ durationMs: 3_141 })))).not.toContain(
      "3141",
    );
  });

  it("caps attempts so a counter cannot become a payload", () => {
    expect(buildHealthRecord(observation({ attempts: 10_000 })).attempts).toBe(99);
    expect(buildHealthRecord(observation({ attempts: -3 })).attempts).toBe(1);
  });
});

describe("a success and a failure say different things", () => {
  it("clears the error class on a success even when one was passed", () => {
    const record = buildHealthRecord(observation({ outcome: "succeeded", errorClass: "quota" }));
    expect(record.errorClass).toBe("none");
  });

  it("refuses to call a failure classless", () => {
    const record = buildHealthRecord(observation({ outcome: "failed", errorClass: "none" }));
    expect(record.errorClass).toBe("internal");
  });

  it("keeps the class an operator would act on", () => {
    for (const errorClass of ERROR_CLASSES.filter((c) => c !== "none")) {
      expect(buildHealthRecord(observation({ outcome: "failed", errorClass })).errorClass).toBe(
        errorClass,
      );
    }
  });
});

describe("the rollup an operator reads", () => {
  it("counts by component and operation, and keeps the worst latency", () => {
    const rolled = rollUp([
      buildHealthRecord(observation({ durationMs: 50 })),
      buildHealthRecord(
        observation({ outcome: "failed", errorClass: "quota", durationMs: 40_000 }),
      ),
      buildHealthRecord(observation({ outcome: "refused", errorClass: "permission" })),
      buildHealthRecord(observation({ component: "webhook", operation: "webhook_receipt" })),
    ]);

    const generation = rolled.find((r) => r.key === "edge_function:generation");
    expect(generation?.total).toBe(3);
    expect(generation?.failed).toBe(1);
    expect(generation?.refused).toBe(1);
    expect(generation?.slowest).toBe("over_30s");
    expect(generation?.errorClasses).toEqual({ quota: 1, permission: 1 });
    expect(rolled.map((r) => r.key)).toContain("webhook:webhook_receipt");
  });

  it("carries no per-record identity into the rollup", () => {
    const rolled = rollUp([buildHealthRecord(observation())]);
    expect(Object.keys(rolled[0]).sort()).toEqual([
      "component",
      "errorClasses",
      "failed",
      "key",
      "operation",
      "refused",
      "slowest",
      "total",
    ]);
  });
});

describe("the queue this feeds is still the only one", () => {
  const environment = {
    osFamily: "linux",
    osVersion: "unknown",
    ocadeVersion: "0.1.0",
    installId: newInstallId(),
  };

  it("sends nothing at all without consent", () => {
    const queue = new TelemetryQueue(environment);
    const outcome = queue.observe(observation());
    expect(outcome.queued).toBe(false);
    expect(queue.size).toBe(0);
  });

  it("needs the timing consent, because a health record is timing", () => {
    const queue = new TelemetryQueue(environment);
    queue.setConsent("failures_only");
    const refused = queue.observe(observation());
    expect(refused.queued).toBe(false);
    if (!refused.queued) expect(refused.refusal).toBe("performance_not_consented");

    queue.setConsent("failures_and_performance");
    expect(queue.observe(observation()).queued).toBe(true);
  });

  it("puts every health field through the same allow-list as a crash", () => {
    const queue = new TelemetryQueue(environment);
    queue.setConsent("failures_and_performance");
    const outcome = queue.observe(observation({ outcome: "failed", errorClass: "upstream" }));
    expect(outcome.queued).toBe(true);
    if (!outcome.queued) return;

    expect(containsOnlyAllowedFields(outcome.report).ok).toBe(true);
    for (const field of ["component", "operation", "errorClass", "latencyBucket", "providerSlot"]) {
      expect(ALLOWED_FIELDS).toContain(field);
      expect(outcome.report[field as keyof typeof outcome.report]).toBeDefined();
    }
  });

  it("discards queued health records when consent is withdrawn", () => {
    const queue = new TelemetryQueue(environment);
    queue.setConsent("failures_and_performance");
    queue.observe(observation());
    expect(queue.size).toBe(1);
    queue.setConsent("none");
    expect(queue.size).toBe(0);
    expect(queue.pending()).toEqual([]);
  });
});

describe("the vocabulary itself", () => {
  it("has no duplicate value in any enumeration", () => {
    for (const set of [
      HEALTH_COMPONENTS,
      HEALTH_OPERATIONS,
      ERROR_CLASSES,
      PROVIDER_SLOTS,
      LATENCY_BUCKETS,
    ]) {
      expect(new Set(set).size).toBe(set.length);
    }
  });

  it("orders the latency buckets from fastest to slowest, which the rollup relies on", () => {
    const durations = [50, 300, 800, 2_000, 5_000, 20_000, 90_000];
    expect(durations.map(latencyBucketFor)).toEqual([...LATENCY_BUCKETS]);
  });
});
