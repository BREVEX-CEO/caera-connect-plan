/**
 * FINDING PAGES WITHOUT ASKING A MODEL TO INVENT THEM.
 *
 * The alternative to a search index is a model producing URLs, and a model
 * producing URLs is how a citation ends up pointing at a page that does not
 * exist — which is worse than no citation, because it looks like evidence.
 *
 * The other thing these tests hold is that discovery cannot widen scope. Every
 * candidate must come back from the host that was asked; a search endpoint
 * that starts returning offsite links has its results dropped here rather than
 * passed on to be refused later.
 */
import { describe, expect, it } from "vitest";
import {
  discoverCandidates,
  parseWikipediaOpenSearch,
  wikipediaSearchUrl,
  MAX_CANDIDATES,
} from "../candidate-discovery";

const OK = (payload: unknown) =>
  ({ ok: true, status: 200, json: async () => payload }) as unknown as Response;

describe("the query goes to a search index, not to a model", () => {
  it("builds an OpenSearch request against the allowlisted host", () => {
    const url = new URL(wikipediaSearchUrl("node lts"));
    expect(url.hostname).toBe("en.wikipedia.org");
    expect(url.searchParams.get("action")).toBe("opensearch");
    expect(url.searchParams.get("search")).toBe("node lts");
  });

  it("escapes a query that would otherwise alter the request", () => {
    const url = new URL(wikipediaSearchUrl("a&limit=500&b"));
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("search")).toBe("a&limit=500&b");
  });
});

describe("results are read defensively, because they are somebody else's JSON", () => {
  const payload = [
    "node",
    ["Node.js", "Node (networking)"],
    ["desc", "desc"],
    ["https://en.wikipedia.org/wiki/Node.js", "https://en.wikipedia.org/wiki/Node_(networking)"],
  ];

  it("turns a well-formed response into candidates", () => {
    const found = parseWikipediaOpenSearch(payload);
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({
      url: "https://en.wikipedia.org/wiki/Node.js",
      title: "Node.js",
      publishedAt: null,
    });
  });

  it("drops an offsite result rather than passing it on to be refused", () => {
    const hostile = ["q", ["Evil"], ["d"], ["https://evil.test/steal"]];
    expect(parseWikipediaOpenSearch(hostile)).toEqual([]);
  });

  it("drops a plain-http result, because research is HTTPS only", () => {
    const insecure = ["q", ["T"], ["d"], ["http://en.wikipedia.org/wiki/T"]];
    expect(parseWikipediaOpenSearch(insecure)).toEqual([]);
  });

  it("returns nothing, rather than throwing, on a shape it does not recognise", () => {
    for (const nonsense of [null, {}, [], ["q"], ["q", "not-an-array", 1, 2], 42, "text"]) {
      expect(parseWikipediaOpenSearch(nonsense)).toEqual([]);
    }
  });

  it("skips a malformed URL without losing the results either side of it", () => {
    const mixed = [
      "q",
      ["A", "B", "C"],
      ["", "", ""],
      ["https://en.wikipedia.org/wiki/A", "not a url", "https://en.wikipedia.org/wiki/C"],
    ];
    expect(parseWikipediaOpenSearch(mixed).map((c) => c.title)).toEqual(["A", "C"]);
  });
});

describe("a search that fails degrades to answering from the device", () => {
  it("returns nothing when the endpoint refuses", async () => {
    const found = await discoverCandidates("anything", {
      fetch: async () => ({ ok: false, status: 429 }) as unknown as Response,
    });
    expect(found).toEqual([]);
  });

  it("returns nothing when the request throws", async () => {
    const found = await discoverCandidates("anything", {
      fetch: async () => {
        throw new Error("offline");
      },
    });
    expect(found).toEqual([]);
  });

  it("does not send a query too short to mean anything", async () => {
    let called = false;
    await discoverCandidates("hi", {
      fetch: async () => {
        called = true;
        return OK([]);
      },
    });
    expect(called).toBe(false);
  });

  it("bounds how many candidates one question can produce", async () => {
    const many = [
      "q",
      Array.from({ length: 40 }, (_, i) => `T${i}`),
      Array.from({ length: 40 }, () => ""),
      Array.from({ length: 40 }, (_, i) => `https://en.wikipedia.org/wiki/T${i}`),
    ];
    const found = await discoverCandidates("a real question", { fetch: async () => OK(many) });
    expect(found.length).toBeLessThanOrEqual(MAX_CANDIDATES);
  });

  it("sends only the words of the question, and nothing about the person", async () => {
    let requested = "";
    await discoverCandidates("what is the latest node release", {
      fetch: async (url) => {
        requested = url;
        return OK([]);
      },
    });
    const sent = new URL(requested);
    expect([...sent.searchParams.keys()].sort()).toEqual([
      "action",
      "format",
      "limit",
      "namespace",
      "search",
    ]);
  });
});
