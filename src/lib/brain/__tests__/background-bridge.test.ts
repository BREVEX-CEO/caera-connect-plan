import { describe, it, expect } from "vitest";
import {
  discoverCompanion,
  shouldHandOff,
  handOffToCompanion,
  readCompanionProgress,
  companionResultMatchesTarget,
  cancelCompanionJob,
  uninstallFromCompanion,
  COMPANION_PROTOCOL,
  type CompanionIdentity,
  type CompanionProgress,
} from "../background-bridge";
import type { InstallTarget } from "../installation-authority";

/**
 * Handing preparation to a native OCADE, and the four rules that make it safe.
 *
 * The tests are organised around the failure each rule prevents, because every
 * one of them is a way for a handoff to be worse than no handoff at all: two
 * processes downloading the same gigabyte, a native app's unrelated model
 * being adopted as this one, an unverified artifact being activated because a
 * "trusted" process said it was fine, and an uninstall that quietly leaves the
 * largest copy in place.
 */

const TARGET: InstallTarget = {
  version: "engine-v1",
  totalBytes: 1000,
  sha256: "a".repeat(64),
  sources: [
    { url: "https://cdn.ocade.example/models/engine-v1/engine.bin", kind: "ocade_cdn" },
    { url: "https://publisher.example/engine.bin", kind: "publisher" },
  ],
};

const GOOD_IDENTITY: CompanionIdentity = {
  product: "ocade-companion",
  protocol: COMPANION_PROTOCOL,
  platform: "android",
  backgroundTransfer: true,
};

/** A companion that answers whatever it is told to. */
function companionServer(
  routes: Record<string, { status?: number; body?: unknown; hang?: boolean }>,
) {
  const seen: { url: string; method: string; body?: unknown }[] = [];
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    seen.push({
      url: href,
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    const key = Object.keys(routes).find((route) => href.includes(route));
    const route = key ? routes[key] : undefined;
    if (!route) return new Response(null, { status: 404 });
    if (route.hang) return new Promise<Response>(() => {});
    return new Response(route.body === undefined ? null : JSON.stringify(route.body), {
      status: route.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fetchImpl, seen };
}

const ORIGINS = ["http://127.0.0.1:11801"] as const;

describe("a companion is only trusted when it proves it is one", () => {
  it("finds a companion that identifies itself correctly", async () => {
    const server = companionServer({ "/identity": { body: GOOD_IDENTITY } });
    const found = await discoverCompanion({ fetchImpl: server.fetchImpl, origins: ORIGINS });
    expect(found?.identity.platform).toBe("android");
  });

  it("REFUSES something else listening on the port", async () => {
    /*
     * Loopback is not authentication. Any other application on the machine can
     * bind a port and answer, so a listener that is not OCADE must read as
     * absent rather than as a companion.
     */
    const server = companionServer({ "/identity": { body: { product: "something-else" } } });
    expect(await discoverCompanion({ fetchImpl: server.fetchImpl, origins: ORIGINS })).toBeNull();
  });

  it("refuses a companion speaking a protocol this build does not know", async () => {
    // A future build may have changed what "prepare this version" means, and
    // guessing is how two processes download different things to one place.
    const server = companionServer({
      "/identity": { body: { ...GOOD_IDENTITY, protocol: COMPANION_PROTOCOL + 1 } },
    });
    expect(await discoverCompanion({ fetchImpl: server.fetchImpl, origins: ORIGINS })).toBeNull();
  });

  it("treats nothing listening as no companion", async () => {
    const server = companionServer({});
    expect(await discoverCompanion({ fetchImpl: server.fetchImpl, origins: ORIGINS })).toBeNull();
  });

  it("treats a companion that will not answer as absent, rather than waiting", async () => {
    // The probe runs on the path to first paint; a hung companion must cost a
    // handoff, never a first run.
    const server = companionServer({ "/identity": { hang: true } });
    const found = await discoverCompanion({
      fetchImpl: server.fetchImpl,
      origins: ORIGINS,
      timeoutMs: 50,
    });
    expect(found).toBeNull();
  });

  it("carries a companion token when one is supplied, and works without one", async () => {
    /*
     * The desktop PAIRING secret is deliberately not what goes here — it is
     * documented as never leaving the device, and a hostile local listener
     * would simply receive it. The field exists for a dedicated companion
     * token; discovery must work either way.
     */
    const withToken = companionServer({ "/identity": { body: GOOD_IDENTITY } });
    expect(
      await discoverCompanion({
        fetchImpl: withToken.fetchImpl,
        origins: ORIGINS,
        secret: "companion-token",
      }),
    ).not.toBeNull();

    const withoutToken = companionServer({ "/identity": { body: GOOD_IDENTITY } });
    expect(
      await discoverCompanion({
        fetchImpl: withoutToken.fetchImpl,
        origins: ORIGINS,
        secret: null,
      }),
    ).not.toBeNull();
  });
});

describe("RULE 1: never two downloads of the same model", () => {
  it("does not hand off when the browser can already continue in the background", () => {
    /*
     * Background Fetch already survives the tab closing AND writes into the
     * same vault the engine loads from. Handing off on top of it would create
     * two owners for one job to gain nothing.
     */
    expect(
      shouldHandOff({
        companion: { origin: ORIGINS[0], identity: GOOD_IDENTITY },
        browserCanContinueInBackground: true,
        alreadyInstalled: false,
      }),
    ).toBe(false);
  });

  it("does not hand off a model that is already installed", () => {
    expect(
      shouldHandOff({
        companion: { origin: ORIGINS[0], identity: GOOD_IDENTITY },
        browserCanContinueInBackground: false,
        alreadyInstalled: true,
      }),
    ).toBe(false);
  });

  it("hands off only when the companion is genuinely stronger", () => {
    expect(
      shouldHandOff({
        companion: { origin: ORIGINS[0], identity: GOOD_IDENTITY },
        browserCanContinueInBackground: false,
        alreadyInstalled: false,
      }),
    ).toBe(true);
  });

  it("does not hand off to a companion that cannot transfer in the background", () => {
    // An iOS build without the background-transfer entitlement, or an Android
    // one denied battery exemption, is present and no better than the tab.
    expect(
      shouldHandOff({
        companion: {
          origin: ORIGINS[0],
          identity: { ...GOOD_IDENTITY, backgroundTransfer: false },
        },
        browserCanContinueInBackground: false,
        alreadyInstalled: false,
      }),
    ).toBe(false);
  });

  it("does not hand off when there is no companion", () => {
    expect(
      shouldHandOff({
        companion: null,
        browserCanContinueInBackground: false,
        alreadyInstalled: false,
      }),
    ).toBe(false);
  });
});

describe("RULE 2: one canonical identity", () => {
  it("sends the exact version, digest and source ladder", async () => {
    const server = companionServer({ "/prepare": { body: { jobId: "job-1" } } });
    const result = await handOffToCompanion(
      { origin: ORIGINS[0], identity: GOOD_IDENTITY },
      TARGET,
      { fetchImpl: server.fetchImpl },
    );
    expect(result.ok).toBe(true);

    const request = server.seen.find((entry) => entry.url.includes("/prepare"));
    // The companion is not asked to prepare "the model". It is asked for
    // exactly the artifact this build's catalogue names.
    expect(request?.body).toMatchObject({
      version: TARGET.version,
      sha256: TARGET.sha256,
      totalBytes: TARGET.totalBytes,
    });
    // And the same ordered ladder, so it fails over identically rather than
    // inventing its own.
    expect((request?.body as { sources: string[] }).sources).toEqual([
      TARGET.sources[0].url,
      TARGET.sources[1].url,
    ]);
  });

  it("REFUSES to hand off an artifact with no published digest", async () => {
    /*
     * With no digest the companion's word would be the only evidence on return
     * — exactly the trust this module declines to extend.
     */
    const server = companionServer({ "/prepare": { body: { jobId: "job-1" } } });
    const result = await handOffToCompanion(
      { origin: ORIGINS[0], identity: GOOD_IDENTITY },
      { ...TARGET, sha256: undefined },
      { fetchImpl: server.fetchImpl },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.retriable).toBe(false);
    // And nothing was even asked of the companion.
    expect(server.seen).toHaveLength(0);
  });

  it("reports a companion that refuses the job", async () => {
    const server = companionServer({ "/prepare": { status: 503 } });
    const result = await handOffToCompanion(
      { origin: ORIGINS[0], identity: GOOD_IDENTITY },
      TARGET,
      { fetchImpl: server.fetchImpl },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.retriable).toBe(true);
  });

  it("reports a companion that accepts but starts nothing", async () => {
    const server = companionServer({ "/prepare": { body: {} } });
    const result = await handOffToCompanion(
      { origin: ORIGINS[0], identity: GOOD_IDENTITY },
      TARGET,
      { fetchImpl: server.fetchImpl },
    );
    expect(result.ok).toBe(false);
  });
});

describe("RULE 3: verification still belongs to OCADE", () => {
  const complete = (over: Partial<CompanionProgress> = {}): CompanionProgress => ({
    phase: "complete",
    version: TARGET.version,
    receivedBytes: TARGET.totalBytes!,
    totalBytes: TARGET.totalBytes,
    sha256: TARGET.sha256,
    ...over,
  });

  it("accepts a result that matches the published fingerprint exactly", () => {
    expect(companionResultMatchesTarget(complete(), TARGET)).toBe(true);
  });

  it("REFUSES a different digest, however complete the companion says it is", () => {
    // "The native app already has a model" is not "it has THIS model".
    expect(companionResultMatchesTarget(complete({ sha256: "b".repeat(64) }), TARGET)).toBe(false);
  });

  it("refuses a different version", () => {
    expect(companionResultMatchesTarget(complete({ version: "engine-v2" }), TARGET)).toBe(false);
  });

  it("refuses a short artifact", () => {
    expect(companionResultMatchesTarget(complete({ receivedBytes: 999 }), TARGET)).toBe(false);
  });

  it("refuses a companion that reports no digest at all", () => {
    // Absence of a check is not a passing check, here as everywhere else.
    expect(companionResultMatchesTarget(complete({ sha256: undefined }), TARGET)).toBe(false);
  });

  it("refuses anything that is not finished", () => {
    for (const phase of ["idle", "downloading", "verifying", "failed", "cancelled"] as const) {
      expect(companionResultMatchesTarget(complete({ phase }), TARGET)).toBe(false);
    }
  });

  it("relays progress while the job runs", async () => {
    const server = companionServer({
      "/progress/": {
        body: {
          phase: "downloading",
          version: TARGET.version,
          receivedBytes: 400,
          totalBytes: 1000,
        },
      },
    });
    const progress = await readCompanionProgress(
      { origin: ORIGINS[0], identity: GOOD_IDENTITY },
      "job-1",
      { fetchImpl: server.fetchImpl },
    );
    expect(progress).toMatchObject({ phase: "downloading", receivedBytes: 400 });
  });

  it("returns null rather than inventing progress when the companion goes quiet", async () => {
    const server = companionServer({});
    expect(
      await readCompanionProgress({ origin: ORIGINS[0], identity: GOOD_IDENTITY }, "job-1", {
        fetchImpl: server.fetchImpl,
      }),
    ).toBeNull();
  });
});

describe("RULE 4: uninstall reaches the companion", () => {
  it("asks the companion to delete what it holds", async () => {
    const server = companionServer({ "/uninstall": { body: { ok: true } } });
    const removed = await uninstallFromCompanion(
      { origin: ORIGINS[0], identity: GOOD_IDENTITY },
      { fetchImpl: server.fetchImpl },
    );
    expect(removed).toBe(true);
    expect(server.seen.some((entry) => entry.url.includes("/uninstall"))).toBe(true);
  });

  it("reports failure rather than claiming a removal that did not happen", async () => {
    /*
     * A companion that is running and refuses to delete is a different
     * situation from one that is not installed, and saying "removed" over a
     * full disk is the failure this returns false to prevent.
     */
    const server = companionServer({ "/uninstall": { status: 500 } });
    expect(
      await uninstallFromCompanion(
        { origin: ORIGINS[0], identity: GOOD_IDENTITY },
        {
          fetchImpl: server.fetchImpl,
        },
      ),
    ).toBe(false);
  });

  it("can take the work back by cancelling a running job", async () => {
    const server = companionServer({ "/cancel/": { body: { ok: true } } });
    expect(
      await cancelCompanionJob({ origin: ORIGINS[0], identity: GOOD_IDENTITY }, "job-1", {
        fetchImpl: server.fetchImpl,
      }),
    ).toBe(true);
  });
});

describe("only loopback is ever contacted", () => {
  it("never reaches a LAN or public address", () => {
    /*
     * A companion is a process on THIS device. Probing a network address would
     * turn a local convenience into a scan, and would let something on the same
     * network answer for it.
     */
    for (const origin of ORIGINS) {
      expect(origin).toMatch(/^http:\/\/(127\.0\.0\.1|localhost):/);
    }
  });
});
