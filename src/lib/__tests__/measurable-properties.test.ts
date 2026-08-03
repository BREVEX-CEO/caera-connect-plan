import { describe, it, expect, beforeEach, vi } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import * as fsp from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assessAction, matchPack, buildReceipt, type SkillCapability } from "../skills/skill-pack";
import { PackRegistry, coverageReport } from "../skills/pack-registry";
import { checkScope, createTaskScope } from "../skills/task-scope";
import { fingerprintApp, lookupAppMap, saveAppMap, recordMapUse } from "../skills/app-map";
import {
  initialHealth,
  recordOutcome,
  chooseHealthyMethod,
  resumePoint,
  preconditionsToRecheck,
  type ResumableJob,
} from "../skills/adapter-health";
import { methodRank, type ControlMethod } from "../skills/skill-pack";
import { recordableInputs, redactReplay, captureMaskFor } from "../skills/session-recording";
import { writeTextFile, deleteFile, type FileSystemLike } from "../skills/packs/local-files-pack";

/**
 * MEASURABLE PROPERTIES.
 *
 * The product goal asks OCADE to be better on accuracy, privacy, recovery,
 * continuity and evidence. This file measures OCADE's OWN behaviour against
 * each of those, with numbers that come from running the code.
 *
 * It deliberately does NOT compare against another product. I have no way to
 * run one here, so any comparative figure would be invented — and a fabricated
 * measurement would make every real number in this suite untrustworthy too.
 * What follows are OCADE's actual properties, stated as tests that fail if the
 * property is lost.
 */

const NOW = new Date("2026-07-23T10:00:00Z");

const capability = (over: Partial<SkillCapability> = {}): SkillCapability => ({
  id: "act",
  label: "Do something",
  methods: ["official_api", "vision_input"],
  mutating: true,
  verifyBy: "file",
  tested: true,
  ...over,
});

/* ---------------------------------------------------- ACCURACY --------- */

describe("ACCURACY: a wrong action is refused before it runs", () => {
  /**
   * The scenarios below are all the ways a step can be wrong. Every one must be
   * refused at plan time, not discovered afterwards.
   */
  const scenarios: { name: string; run: () => boolean }[] = [
    {
      name: "unknown app, best possible route",
      run: () => assessAction(capability(), "unknown", ["official_api"]).proceed,
    },
    {
      name: "untested version, vision only",
      run: () => assessAction(capability(), "probed", ["vision_input"]).proceed,
    },
    {
      name: "no route available at all",
      run: () => assessAction(capability(), "verified", ["cli"]).proceed,
    },
    {
      name: "mutating action that cannot be verified",
      run: () => assessAction(capability({ verifyBy: "none" }), "probed", ["official_api"]).proceed,
    },
    {
      name: "untested capability on an untested version",
      run: () => assessAction(capability({ tested: false }), "probed", ["official_api"]).proceed,
    },
  ];

  it("refuses every unsafe scenario (0 of 5 proceed)", () => {
    const proceeded = scenarios.filter((s) => s.run());
    expect(proceeded.map((s) => s.name)).toEqual([]);
  });

  it("still proceeds on the one genuinely safe scenario", () => {
    expect(assessAction(capability(), "verified", ["official_api"]).proceed).toBe(true);
  });

  it("never substitutes a similar app for an unknown one", () => {
    const m = matchPack(
      { appId: "unknown.app", displayName: "Unknown", version: "1.0" },
      new PackRegistry().list(),
    );
    expect(m.pack).toBeNull();
    expect(m.confidence).toBe("unknown");
  });
});

/* ------------------------------------------- NO FALSE SUCCESS ---------- */

describe("EVIDENCE: success is never reported without a check", () => {
  it("an unverified action is stamped NOT CONFIRMED", () => {
    const r = buildReceipt({
      app: { appId: "a", displayName: "A", version: "1" },
      capability: capability(),
      method: "vision_input",
      verified: false,
      evidence: "the dialog closed",
    });
    expect(r.evidence).toMatch(/^NOT CONFIRMED:/);
  });

  /** Measured against the real filesystem, not a mock. */
  it("a write that cannot be confirmed is reported as a failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "ocade-prop-"));
    try {
      // A filesystem that accepts the write but returns different content —
      // exactly the truncated-write failure mode.
      const lying: FileSystemLike = {
        realpath: (p) => fsp.realpath(p),
        stat: async (p) => {
          const s = await fsp.stat(p);
          return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size };
        },
        readFile: async () => "TRUNCATED",
        writeFile: (p, d) => fsp.writeFile(p, d, "utf8"),
        readdir: (p) => fsp.readdir(p),
        mkdir: (p) => fsp.mkdir(p).then(() => undefined),
        rename: (a, b) => fsp.rename(a, b),
        unlink: (p) => fsp.unlink(p),
      };
      const r = await writeTextFile(lying, root, join(root, "x.txt"), "the full content");
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error("unreachable");
      expect(r.reason).toMatch(/don't match/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("a delete that did not happen is reported as a failure", async () => {
    const root = await mkdtemp(join(tmpdir(), "ocade-prop-"));
    try {
      const target = join(root, "stubborn.txt");
      await writeFile(target, "still here", "utf8");
      const noOpDelete: FileSystemLike = {
        realpath: (p) => fsp.realpath(p),
        stat: async (p) => {
          const s = await fsp.stat(p);
          return { isFile: s.isFile(), isDirectory: s.isDirectory(), size: s.size };
        },
        readFile: (p) => fsp.readFile(p, "utf8"),
        writeFile: (p, d) => fsp.writeFile(p, d, "utf8"),
        readdir: (p) => fsp.readdir(p),
        mkdir: (p) => fsp.mkdir(p).then(() => undefined),
        rename: (a, b) => fsp.rename(a, b),
        // Reports success, does nothing.
        unlink: async () => {},
      };
      const r = await deleteFile(noOpDelete, root, target);
      expect(r.ok).toBe(false);
      if (r.ok) throw new Error("unreachable");
      expect(r.reason).toMatch(/still there/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

/* --------------------------------------------------- PRIVACY ----------- */

describe("PRIVACY: protected content cannot reach any surface", () => {
  const surfaces = [
    {
      name: "input log",
      leaks: () =>
        recordableInputs(
          "hunter2"
            .split("")
            .map((c) => ({ kind: "key" as const, label: c, inProtectedField: false, at: 0 })),
        ).length > 0,
    },
    {
      name: "replay log",
      leaks: () =>
        redactReplay([
          { index: 1, summary: "typed the password hunter2", undoable: true, at: 0 },
        ])[0].summary.includes("hunter2"),
    },
    {
      name: "screen capture",
      leaks: () => !captureMaskFor([]).maskSelectors.includes('input[type="password"]'),
    },
    {
      name: "task scope",
      leaks: () =>
        checkScope(
          { kind: "text.type", text: "my password is hunter2" },
          createTaskScope({ id: "t", summary: "x", capabilities: ["text.type"], now: NOW }),
          NOW,
        ).allow,
    },
  ];

  it("leaks through 0 of 4 surfaces", () => {
    expect(surfaces.filter((s) => s.leaks()).map((s) => s.name)).toEqual([]);
  });
});

/* -------------------------------------------------- RECOVERY ----------- */

describe("RECOVERY: a failing route and an interrupted job both recover", () => {
  it("routes around a failing adapter instead of retrying it", () => {
    let bad = initialHealth("official_api");
    bad = recordOutcome(bad, { ok: false });
    bad = recordOutcome(bad, { ok: false });

    const r = chooseHealthyMethod(
      ["official_api", "accessibility"],
      new Map([["official_api", bad]]),
      methodRank,
    );
    expect(r.method).toBe("accessibility");
    expect(r.routedAround).toEqual(["official_api"]);
  });

  it("recovers the route after a single success", () => {
    let h = initialHealth("official_api");
    h = recordOutcome(h, { ok: false });
    h = recordOutcome(h, { ok: false });
    h = recordOutcome(h, { ok: true, latencyMs: 20 });
    const r = chooseHealthyMethod(["official_api"], new Map([["official_api", h]]), methodRank);
    expect(r.method).toBe("official_api");
  });

  it("resumes at the failed step, not from the beginning", () => {
    const job: ResumableJob = {
      id: "j",
      startedAt: 0,
      updatedAt: 0,
      steps: [
        { id: "1", summary: "a", status: "done" },
        { id: "2", summary: "b", status: "done" },
        { id: "3", summary: "c", status: "failed", precondition: "c still applies" },
        { id: "4", summary: "d", status: "pending", precondition: "d still applies" },
      ],
    };
    expect(resumePoint(job)?.id).toBe("3");
    // Every remaining assumption is re-checked, not just the resume point.
    expect(preconditionsToRecheck(job)).toHaveLength(2);
  });
});

/* ------------------------------------------- REPEATED SCANNING --------- */

describe("SPEED: an app is inspected once, not on every task", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });

  it("100 tasks against an unchanged app require exactly 1 inspection", () => {
    const fp = fingerprintApp({
      version: "1.0",
      windowTitle: "App",
      controlCount: 12,
      locale: "en",
    });
    let inspections = 0;

    for (let i = 0; i < 100; i++) {
      const state = lookupAppMap("demo", fp);
      if (state.status !== "fresh") {
        inspections++;
        saveAppMap({
          appId: "demo",
          displayName: "Demo",
          version: "1.0",
          fingerprint: fp,
          controls: [],
        });
      } else {
        recordMapUse("demo");
      }
    }
    expect(inspections).toBe(1);
  });

  /** Correctness beats the cache: a changed app MUST be re-inspected. */
  it("re-inspects exactly once when the app actually changes", () => {
    const before = fingerprintApp({ version: "1.0", controlCount: 12 });
    const after = fingerprintApp({ version: "2.0", controlCount: 15 });
    let inspections = 0;

    for (const fp of [before, before, before, after, after, after]) {
      if (lookupAppMap("demo", fp).status !== "fresh") {
        inspections++;
        saveAppMap({
          appId: "demo",
          displayName: "Demo",
          version: "x",
          fingerprint: fp,
          controls: [],
        });
      }
    }
    expect(inspections).toBe(2);
  });
});

/* -------------------------------------------------- APPROVALS ---------- */

describe("APPROVALS: one decision covers a task, and genuinely bounds it", () => {
  const scope = createTaskScope({
    id: "t",
    summary: "Tidy invoices",
    capabilities: ["file.open", "window.list"],
    paths: ["C:/Work/Invoices"],
    now: NOW,
  });

  it("10 in-scope steps require 0 further prompts", () => {
    let prompts = 0;
    for (let i = 0; i < 10; i++) {
      const d = checkScope({ kind: "window.list" }, scope, NOW);
      if (!d.allow) prompts++;
    }
    expect(prompts).toBe(0);
  });

  it("every out-of-scope attempt is caught (4 of 4)", () => {
    const attempts = [
      { kind: "clipboard.write", text: "x" } as const,
      { kind: "app.open", appId: "banking" } as const,
      { kind: "file.open", path: "C:/Personal/diary.txt" } as const,
      { kind: "file.open", path: "C:/Work/Invoices/../../secrets.txt" } as const,
    ];
    const allowed = attempts.filter((a) => checkScope(a, scope, NOW).allow);
    expect(allowed).toEqual([]);
  });
});

/* ------------------------------------------------- HONEST SCOPE -------- */

describe("HONESTY: coverage is reported, not implied", () => {
  it("names every category rather than omitting the weak ones", () => {
    const report = coverageReport(new PackRegistry());
    expect(report).toHaveLength(14);
    // Every row is labelled, supported or not — an omission reads as "fine" to
    // someone scanning the list.
    for (const row of report) expect(row.label.length).toBeGreaterThan(4);
  });

  /**
   * Every category now has a tested pack, which makes the honesty question a
   * different one: several of those packs read the category's FILE FORMATS and
   * cannot drive its applications. That distinction must survive in the data,
   * or a full-coverage table becomes a false claim.
   */
  it("marks file-format coverage as such, and makes it state its limits", () => {
    const report = coverageReport(new PackRegistry());
    const formatOnly = report.filter((r) => r.formatOnly);
    expect(formatOnly.length).toBeGreaterThan(0);

    for (const row of formatOnly) {
      expect(row.limits.length).toBeGreaterThan(0);
      // Each limit must name something OCADE genuinely cannot do.
      expect(row.limits.join(" ")).toMatch(/cannot|does not|never/i);
    }

    // And the categories with real application adapters are not mislabelled.
    expect(report.find((r) => r.category === "dev_tools")!.formatOnly).toBe(false);
  });

  it("a category counts as supported only with a tested capability", () => {
    for (const row of coverageReport(new PackRegistry())) {
      expect(row.supported).toBe(row.testedCapabilities > 0);
    }
  });
});
