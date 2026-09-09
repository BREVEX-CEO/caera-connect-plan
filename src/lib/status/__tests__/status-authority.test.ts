import { describe, expect, it, vi } from "vitest";
import { STATUS_COMPONENTS, STATUS_INDEPENDENCE, findStatusComponent } from "../catalogue";
import {
  overallState,
  overallSummary,
  stateFromResponse,
  type ComponentObservation,
} from "../state";
import { probeAll, probeOne, browserEngineCapability } from "../probe";
import { buildSnapshot, toAtom, xmlText, INCIDENTS_NOTE } from "../feed";
import {
  describeWindow,
  readSamples,
  recordSample,
  summariseUptime,
  writeSamples,
  MAX_SAMPLES,
  type SampleStorage,
} from "../uptime";

const AT = "2026-09-03T10:00:00.000Z";

function observation(
  componentId: string,
  state: ComponentObservation["state"],
  deviceSpecific = false,
): ComponentObservation {
  return { componentId, state, detail: `${componentId} ${state}`, observedAt: AT, deviceSpecific };
}

describe("the catalogue", () => {
  it("gives every component evidence, so a row cannot assert an unmeasured state", () => {
    // The page this replaced had three rows whose state was a sentence somebody
    // wrote. There is nowhere to put one now.
    for (const component of STATUS_COMPONENTS) {
      expect(component.evidence).toBeTruthy();
      expect(component.name.length).toBeGreaterThan(0);
      expect(component.description.length).toBeGreaterThan(0);
    }
  });

  it("has unique ids", () => {
    const ids = STATUS_COMPONENTS.map((component) => component.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(findStatusComponent(ids[0])?.id).toBe(ids[0]);
  });

  it("declares that it is not an independent status service", () => {
    // PLAN.md §K: independent-status claims stay hidden until one is configured.
    expect(STATUS_INDEPENDENCE.independent).toBe(false);
    expect(STATUS_INDEPENDENCE.statement).toMatch(/not an independent status service/i);
  });
});

describe("rolling observations into one state", () => {
  it("is operational only when every service component is", () => {
    expect(overallState([observation("a", "operational"), observation("b", "operational")])).toBe(
      "operational",
    );
  });

  it("calls SOME components down degraded, and ALL of them an outage", () => {
    // Rounding one failure up to "outage" makes the word useless the first time
    // it is needed for a real one.
    expect(overallState([observation("a", "outage"), observation("b", "operational")])).toBe(
      "degraded",
    );
    expect(overallState([observation("a", "outage"), observation("b", "outage")])).toBe("outage");
  });

  it("does not let one visitor's laptop report OCADE as degraded", () => {
    expect(
      overallState([observation("a", "operational"), observation("engine", "degraded", true)]),
    ).toBe("operational");
  });

  it("reports unknown rather than operational when nothing could be measured", () => {
    // A green page built out of checks that did not run is the exact failure a
    // status page exists to prevent.
    expect(overallState([observation("a", "unknown")])).toBe("unknown");
    expect(overallState([])).toBe("unknown");
    expect(overallState([observation("engine", "operational", true)])).toBe("unknown");
  });

  it("summarises with real counts", () => {
    const observations = [observation("a", "outage"), observation("b", "operational")];
    expect(overallSummary("degraded", observations)).toBe(
      "1 of 2 checked components is not responding normally.",
    );
    expect(overallSummary("operational", observations)).toContain("2 checked components");
  });
});

describe("reading an HTTP response", () => {
  it("separates 'answered and refused' from 'did not answer'", () => {
    expect(stateFromResponse(200)).toBe("operational");
    expect(stateFromResponse(204)).toBe("operational");
    expect(stateFromResponse(403)).toBe("degraded");
    expect(stateFromResponse(500)).toBe("outage");
    expect(stateFromResponse(null)).toBe("outage");
  });
});

describe("probing", () => {
  const base = {
    origin: "https://ocade.test",
    now: () => new Date(AT),
    accountBindingConfigured: true,
  };

  it("reports what the response actually was, not a restatement of the state", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
    const results = await probeAll({ ...base, fetch: fetchMock as unknown as typeof fetch });
    const http = results.find((result) => result.componentId === "public-web");
    expect(http?.state).toBe("outage");
    expect(http?.detail).toContain("503");
  });

  it("never asks the network without a bound, and calls a hung request an outage", async () => {
    // A status page stuck on "checking" is the one state it must never reach.
    const fetchMock = vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );
    const result = await probeOne(
      {
        id: "public-web",
        name: "n",
        description: "d",
        evidence: { kind: "http", path: "/x", expect: "ok" },
      },
      { ...base, fetch: fetchMock as unknown as typeof fetch, timeoutMs: 10 },
    );
    expect(result.state).toBe("outage");
    expect(result.detail).toMatch(/could not be reached/i);
  });

  it("does not report a configured account binding as healthy", async () => {
    // "Configured" says the deployment has somewhere to talk to. Reporting that
    // as green is a health claim made out of an environment variable.
    const result = await probeOne(
      {
        id: "account-authentication",
        name: "n",
        description: "d",
        evidence: { kind: "configuration", setting: "supabase" },
      },
      { ...base, fetch: (async () => new Response(null)) as unknown as typeof fetch },
    );
    expect(result.state).toBe("unknown");
    expect(result.detail).toMatch(/not a health check/i);
  });

  it("reports an absent account binding as an outage of the things that need it", async () => {
    const result = await probeOne(
      {
        id: "account-data",
        name: "n",
        description: "d",
        evidence: { kind: "configuration", setting: "supabase" },
      },
      {
        ...base,
        accountBindingConfigured: false,
        fetch: (async () => new Response(null)) as unknown as typeof fetch,
      },
    );
    expect(result.state).toBe("outage");
  });

  it("says a browser check was not run rather than guessing about a device", async () => {
    const result = await probeOne(
      {
        id: "offline-intelligence",
        name: "n",
        description: "d",
        evidence: { kind: "browser-capability", capability: "webgpu-or-wasm" },
        deviceSpecific: true,
      },
      { ...base, fetch: (async () => new Response(null)) as unknown as typeof fetch },
    );
    expect(result.state).toBe("unknown");
    expect(result.detail).toMatch(/was not run here/i);
  });

  it("marks a failing device check as the person's browser, not as OCADE", async () => {
    const result = await probeOne(
      {
        id: "offline-intelligence",
        name: "n",
        description: "d",
        evidence: { kind: "browser-capability", capability: "webgpu-or-wasm" },
        deviceSpecific: true,
      },
      {
        ...base,
        fetch: (async () => new Response(null)) as unknown as typeof fetch,
        browserCapability: () => false,
      },
    );
    expect(result.state).toBe("degraded");
    expect(result.detail).toMatch(/property of your browser, not of OCADE/i);
  });

  it("answers null for a capability there is no browser to ask about", () => {
    // Node has WebAssembly but no navigator, which is what this guards.
    expect(browserEngineCapability("something-else")).toBeNull();
  });
});

describe("uptime", () => {
  it("reports no percentage at all until something has been measured", () => {
    // 100% over zero samples is the most reassuring possible answer and means
    // nothing whatsoever.
    const window = summariseUptime([]);
    expect(window.percentage).toBeNull();
    expect(describeWindow(window)).toMatch(/No checks recorded/i);
  });

  it("counts only samples that measured something", () => {
    const window = summariseUptime([
      { at: AT, state: "operational" },
      { at: AT, state: "unknown" },
      { at: AT, state: "outage" },
    ]);
    expect(window.samples).toBe(2);
    expect(window.percentage).toBe(50);
  });

  it("always says how many checks and since when, beside the number", () => {
    const text = describeWindow(
      summariseUptime([
        { at: AT, state: "operational" },
        { at: AT, state: "operational" },
      ]),
    );
    expect(text).toContain("100%");
    expect(text).toContain("2 checks");
    expect(text).toMatch(/not a fleet-wide uptime history/i);
  });

  it("bounds the history it keeps", () => {
    let history: { at: string; state: "operational" }[] = [];
    for (let index = 0; index < MAX_SAMPLES + 25; index += 1) {
      history = recordSample(history, { at: AT, state: "operational" }) as typeof history;
    }
    expect(history).toHaveLength(MAX_SAMPLES);
  });

  it("discards a fabricated sample rather than counting it", () => {
    // Local storage is writable by anything on the origin, and a fabricated
    // history is precisely what this module exists to prevent.
    const storage: SampleStorage = {
      getItem: () =>
        JSON.stringify({
          "public-web": [
            { at: AT, state: "operational" },
            { at: "not a date", state: "operational" },
            { at: AT, state: "perfect" },
            "nonsense",
          ],
        }),
      setItem: () => undefined,
    };
    expect(readSamples(storage)["public-web"]).toEqual([{ at: AT, state: "operational" }]);
  });

  it("survives storage that throws, and no storage at all", () => {
    const hostile: SampleStorage = {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("full");
      },
    };
    expect(readSamples(hostile)).toEqual({});
    expect(() => writeSamples({ a: [] }, hostile)).not.toThrow();
    expect(readSamples(null)).toEqual({});
  });
});

describe("the public snapshot and feed", () => {
  const observations = [
    observation("public-web", "operational"),
    observation("offline-intelligence", "unknown", true),
  ];

  it("states that it is not independent, in the payload rather than in a footnote", () => {
    const snapshot = buildSnapshot(observations, new Date(AT));
    expect(snapshot.independent).toBe(false);
    expect(snapshot.independenceStatement).toMatch(/not an independent status service/i);
  });

  it("publishes an empty incident list WITH the reason it is empty", () => {
    // An absent field reads as "not built yet"; a bare empty list reads as "no
    // incidents have happened". Neither is true.
    const snapshot = buildSnapshot(observations, new Date(AT));
    expect(snapshot.incidents).toEqual([]);
    expect(snapshot.incidentsNote).toBe(INCIDENTS_NOTE);
    expect(snapshot.incidentsNote).toMatch(/not a claim that there have been no incidents/i);
  });

  it("keeps the same honest qualification after incident publishing begins", () => {
    /*
     * The public endpoint has an incident store and therefore passes an empty
     * array (rather than null) plus its first publishing date.  This is a
     * different branch from the migration-not-applied fallback above and must
     * never regress to a reassuring but unsupported empty-history claim.
     */
    const snapshot = buildSnapshot(observations, new Date(AT), [], "4 September 2026");
    expect(snapshot.incidentsNote).toMatch(/since 4 September 2026/i);
    expect(snapshot.incidentsNote).toMatch(/not a claim that there have been no incidents/i);
  });

  it("carries no field that could hold a prompt, a credential or customer data", () => {
    const snapshot = buildSnapshot(observations, new Date(AT));
    const keys = new Set(Object.keys(snapshot.components[0]));
    expect(keys).toEqual(
      new Set([
        "id",
        "name",
        "description",
        "state",
        "stateLabel",
        "detail",
        "observedAt",
        "deviceSpecific",
      ]),
    );
  });

  it("escapes text into the Atom feed", () => {
    expect(xmlText(`a & b < c > d " e ' f`)).toBe("a &amp; b &lt; c &gt; d &quot; e &apos; f");
    const atom = toAtom(
      buildSnapshot(
        [{ ...observation("public-web", "operational"), detail: 'responded <200> & "ok"' }],
        new Date(AT),
      ),
      "https://ocade.test",
    );
    expect(atom).toContain("&lt;200&gt; &amp; &quot;ok&quot;");
    expect(atom).not.toContain("<200>");
  });

  it("gives every entry a stable id so a reader updates rather than re-announces", () => {
    const atom = toAtom(buildSnapshot(observations, new Date(AT)), "https://ocade.test");
    expect(atom).toContain("<id>urn:ocade:status:public-web</id>");
    expect(atom).toContain("<id>urn:ocade:status:overall</id>");
    expect(atom).toContain(`<updated>${AT}</updated>`);
  });
});
