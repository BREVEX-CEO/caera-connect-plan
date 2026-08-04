import { describe, it, expect } from "vitest";
import { planFallback, nextAction, type Attempt } from "../research/source-fallback";
import type { SourceRecord } from "../research/source-ranking";

const NOW = new Date("2026-07-24T12:00:00Z");

const src = (
  id: string,
  publisher: string,
  kind: SourceRecord["kind"],
  authoritativeFor?: string[],
): SourceRecord => ({
  id,
  title: `${publisher} report`,
  publisher,
  kind,
  publishedAt: NOW,
  retrievedAt: NOW,
  authoritativeFor,
});

const official = src("o", "Agency", "official", ["transport"]);
const news = src("n", "Newsroom", "news");
const social = src("s", "Forum", "social");

describe("fallback is ordered by authority", () => {
  it("orders strongest first, excluding sub-floor sources by default", () => {
    // Forum (social, authority 0.25) is below the default 0.4 floor and dropped.
    const r = planFallback([news, official, social], "transport");
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.order[0].publisher).toBe("Agency");
    expect(r.data.order.map((s) => s.publisher)).toEqual(["Agency", "Newsroom"]);
  });

  it("includes a weak source only when the floor is lowered explicitly", () => {
    const r = planFallback([news, official, social], "transport", { minAuthority: 0.2 });
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.order.map((s) => s.publisher)).toEqual(["Agency", "Newsroom", "Forum"]);
  });

  it("drops sources below the authority floor", () => {
    const r = planFallback([official, social], "transport", { minAuthority: 0.5 });
    if (!r.ok) throw new Error("unreachable");
    expect(r.data.order.map((s) => s.publisher)).toEqual(["Agency"]);
  });

  /** Won't fall back to a source too weak to trust just to have an answer. */
  it("refuses when nothing meets the floor", () => {
    const r = planFallback([social], "transport", { minAuthority: 0.5 });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("unreachable");
    expect(r.reason).toMatch(/too weak to trust/i);
  });
});

describe("the next-action policy", () => {
  const plan = () => {
    const r = planFallback([official, news], "transport", { maxRetries: 1 });
    if (!r.ok) throw new Error("unreachable");
    return r.data;
  };

  it("tries the highest-authority source first", () => {
    const a = nextAction(plan(), []);
    expect(a.action).toBe("try");
    if (a.action !== "try") throw new Error("unreachable");
    expect(a.source).toBe("Agency");
  });

  it("retries a transient failure within budget", () => {
    const attempts: Attempt[] = [{ source: "Agency", result: "transient" }];
    const a = nextAction(plan(), attempts);
    expect(a.action).toBe("retry");
    if (a.action !== "retry") throw new Error("unreachable");
    expect(a.source).toBe("Agency");
    expect(a.attempt).toBe(2);
  });

  /** After retries are spent, fall back to the next best — not before. */
  it("falls back to the next source once retries are spent", () => {
    const attempts: Attempt[] = [
      { source: "Agency", result: "transient" },
      { source: "Agency", result: "transient" }, // exceeds maxRetries=1
    ];
    const a = nextAction(plan(), attempts);
    expect(a.action).toBe("try");
    if (a.action !== "try") throw new Error("unreachable");
    expect(a.source).toBe("Newsroom");
  });

  it("skips a hard-failed source immediately, no retry", () => {
    const attempts: Attempt[] = [{ source: "Agency", result: "hard" }];
    const a = nextAction(plan(), attempts);
    expect(a.action).toBe("try");
    if (a.action !== "try") throw new Error("unreachable");
    expect(a.source).toBe("Newsroom");
  });

  it("accepts a source that returned usable content", () => {
    const attempts: Attempt[] = [
      { source: "Agency", result: "hard" },
      { source: "Newsroom", result: "ok" },
    ];
    const a = nextAction(plan(), attempts);
    expect(a.action).toBe("accept");
    if (a.action !== "accept") throw new Error("unreachable");
    expect(a.source).toBe("Newsroom");
  });

  /**
   * The honest exhaustion outcome: every adequate source failed, and the policy
   * reports unconfirmed rather than reaching for a weaker source.
   */
  it("reports exhausted rather than lowering the bar", () => {
    const attempts: Attempt[] = [
      { source: "Agency", result: "hard" },
      { source: "Newsroom", result: "hard" },
    ];
    const a = nextAction(plan(), attempts);
    expect(a.action).toBe("exhausted");
    if (a.action !== "exhausted") throw new Error("unreachable");
    expect(a.reason).toMatch(/won't drop to a weaker source/i);
  });

  it("never 'upgrades' to a weaker source when a stronger one still has retries", () => {
    // Agency (stronger) had one transient; policy must retry it, not jump to Newsroom.
    const a = nextAction(plan(), [{ source: "Agency", result: "transient" }]);
    if (a.action !== "retry") throw new Error("unreachable");
    expect(a.source).toBe("Agency");
  });
});
