import { describe, it, expect, afterEach } from "vitest";
import {
  decideBrowserAction,
  dispatchBrowserAction,
  runBrowserAction,
  isProtectedField,
  originOf,
  UnavailableBrowserBridge,
  getBrowserBridge,
  setBrowserBridge,
  DEFAULT_SITE_POLICY,
  BROWSER_BRIDGE_UNAVAILABLE,
  type PerformOptions,
  type SitePolicy,
} from "../native/browser-bridge";
import { summarisePage } from "../native/browser-dom";

const SITE = "https://app.example.com";

const policy: SitePolicy = {
  ...DEFAULT_SITE_POLICY,
  allowOrigins: [SITE],
  readOrigins: [SITE],
  fillOrigins: [SITE],
};

describe("origin handling", () => {
  it("extracts an origin and rejects malformed urls", () => {
    expect(originOf("https://a.com/x?y=1")).toBe("https://a.com");
    expect(originOf("not a url")).toBeNull();
  });

  it("refuses actions on an invalid address", () => {
    const d = decideBrowserAction({ kind: "navigate", url: "nope" }, policy);
    expect(d.allow).toBe(false);
  });
});

describe("site permissions", () => {
  it("refuses an origin that was never allowed", () => {
    const d = decideBrowserAction({ kind: "navigate", url: "https://other.com/" }, policy);
    expect(d).toMatchObject({ allow: false });
    if (!d.allow) expect(d.reason).toMatch(/no permission/i);
  });

  it("denylist wins over allowlist", () => {
    const p = { ...policy, denyOrigins: [SITE] };
    const d = decideBrowserAction({ kind: "navigate", url: `${SITE}/a` }, p);
    expect(d).toMatchObject({ allow: false });
    if (!d.allow) expect(d.reason).toMatch(/blocked list/i);
  });

  it("never acts inside a private window", () => {
    const d = decideBrowserAction({ kind: "tabs.list" }, policy, { isPrivateWindow: true });
    expect(d).toMatchObject({ allow: false });
    if (!d.allow) expect(d.reason).toMatch(/private windows/i);
  });

  it("requires a separate grant to read page content", () => {
    const p = { ...policy, readOrigins: [] };
    expect(decideBrowserAction({ kind: "dom.read", url: `${SITE}/a` }, p).allow).toBe(false);
    expect(decideBrowserAction({ kind: "dom.read", url: `${SITE}/a` }, policy).allow).toBe(true);
  });
});

describe("protected data boundaries", () => {
  it.each(["password", "otp_code", "cardNumber", "cvv", "captcha_answer", "recoveryCode"])(
    "flags %s as a protected field",
    (name) => expect(isProtectedField(name)).toBe(true),
  );

  it.each(["fullName", "email", "city"])("allows ordinary field %s", (name) =>
    expect(isProtectedField(name)).toBe(false),
  );

  it("refuses to fill a form containing a protected field", () => {
    const d = decideBrowserAction(
      { kind: "form.fill", url: `${SITE}/signup`, fields: [{ name: "password", value: "x" }] },
      policy,
    );
    expect(d).toMatchObject({ allow: false });
    if (!d.allow) expect(d.reason).toMatch(/protected information/i);
  });

  it("refuses when the VALUE looks like a credential even if the name is innocuous", () => {
    const d = decideBrowserAction(
      {
        kind: "form.fill",
        url: `${SITE}/x`,
        fields: [{ name: "notes", value: "my otp is 483920" }],
      },
      policy,
    );
    expect(d.allow).toBe(false);
  });

  it("allows filling ordinary fields but demands confirmation", () => {
    const d = decideBrowserAction(
      { kind: "form.fill", url: `${SITE}/x`, fields: [{ name: "fullName", value: "Alex" }] },
      policy,
    );
    expect(d).toMatchObject({ allow: true, requiresConfirmation: true });
  });
});

describe("risk tiers", () => {
  it("treats a consequential submit as high risk", () => {
    const d = decideBrowserAction(
      { kind: "form.submit", url: `${SITE}/pay`, consequential: true },
      policy,
    );
    expect(d).toMatchObject({ allow: true, risk: "high", requiresConfirmation: true });
  });

  it("treats uploads as high risk and downloads as confirm", () => {
    expect(
      decideBrowserAction({ kind: "upload", url: `${SITE}/f`, path: "C:/a.txt" }, policy),
    ).toMatchObject({ risk: "high" });
    expect(
      decideBrowserAction({ kind: "download", url: `${SITE}/f`, filename: "a.txt" }, policy),
    ).toMatchObject({ risk: "confirm" });
  });

  it("reads are read-only and need no confirmation", () => {
    expect(decideBrowserAction({ kind: "a11y.read", url: `${SITE}/a` }, policy)).toMatchObject({
      risk: "read_only",
      requiresConfirmation: false,
    });
  });
});

describe("dispatch", () => {
  it("blocks when confirmation is required but missing", async () => {
    const r = await dispatchBrowserAction(
      { kind: "form.fill", url: `${SITE}/x`, fields: [{ name: "city", value: "Pune" }] },
      policy,
    );
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/confirmation/i);
  });

  it("reports the bridge as unavailable rather than faking success", async () => {
    const r = await dispatchBrowserAction({ kind: "tabs.list" }, policy, { confirmed: true });
    expect(r.ok).toBe(false);
    expect(r.detail).toBe(BROWSER_BRIDGE_UNAVAILABLE);
  });

  it("surfaces a policy refusal without touching the bridge", async () => {
    const r = await dispatchBrowserAction({ kind: "navigate", url: "https://evil.com/" }, policy, {
      confirmed: true,
    });
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/no permission/i);
  });

  it("does not turn a mutation acknowledgement into verified success", async () => {
    setBrowserBridge({
      status: async () => ({ available: true }),
      perform: async () => ({ ok: true, detail: "The host acknowledged navigation." }),
    });
    const outcome = await runBrowserAction({ kind: "navigate", url: `${SITE}/next` }, policy, {
      runId: "browser-run",
      operationId: "browser-run:navigate",
      verification: { url: `${SITE}/next` },
    });
    expect(outcome.ok).toBe(false);
    expect(outcome.receipt.status).toBe("completed_unverified");
    setBrowserBridge(new UnavailableBrowserBridge());
  });
});

describe("UnavailableBrowserBridge", () => {
  it("is the default bridge and refuses honestly", async () => {
    const s = await getBrowserBridge().status();
    expect(s.available).toBe(false);
    const r = await new UnavailableBrowserBridge().perform(
      { kind: "tabs.list" },
      { confirmed: false },
    );
    expect(r.ok).toBe(false);
  });
});

/**
 * `consequential` is DECLARED by the caller. If that flag were the only guard,
 * a caller that simply doesn't know would submit a checkout at the lower tier.
 */
describe("sensitive submits escalate on what is actually on the page", () => {
  const loginPage = summarisePage({
    url: `${SITE}/checkout`,
    title: "Checkout",
    headings: [],
    bodyText: "",
    fields: [
      { name: "email", type: "email" },
      { name: "cardNumber", type: "text" },
    ],
    links: [],
  });

  const plainPage = summarisePage({
    url: `${SITE}/feedback`,
    title: "Feedback",
    headings: [],
    bodyText: "",
    fields: [{ name: "comment", type: "text" }],
    links: [],
  });

  it("raises an UNDECLARED submit to high risk when a payment field is present", () => {
    const d = decideBrowserAction(
      { kind: "form.submit", url: `${SITE}/checkout`, consequential: false },
      policy,
      { pageSummary: loginPage },
    );
    expect(d.allow).toBe(true);
    if (!d.allow) throw new Error("unreachable");
    expect(d.risk).toBe("high");
    expect(d.requiresConfirmation).toBe(true);
  });

  it("leaves an ordinary form at the normal confirm tier", () => {
    const d = decideBrowserAction(
      { kind: "form.submit", url: `${SITE}/feedback`, consequential: false },
      policy,
      { pageSummary: plainPage },
    );
    if (!d.allow) throw new Error("unreachable");
    expect(d.risk).toBe("confirm");
  });

  it("still honours a declared consequential submit with no page summary", () => {
    const d = decideBrowserAction(
      { kind: "form.submit", url: `${SITE}/checkout`, consequential: true },
      policy,
    );
    if (!d.allow) throw new Error("unreachable");
    expect(d.risk).toBe("high");
  });

  /** Observation may only RAISE the tier, never lower a declared one. */
  it("never downgrades a declared consequential submit", () => {
    const d = decideBrowserAction(
      { kind: "form.submit", url: `${SITE}/feedback`, consequential: true },
      policy,
      { pageSummary: plainPage },
    );
    if (!d.allow) throw new Error("unreachable");
    expect(d.risk).toBe("high");
  });

  it("always requires confirmation for a submit, whatever the tier", () => {
    for (const consequential of [true, false]) {
      const d = decideBrowserAction(
        { kind: "form.submit", url: `${SITE}/x`, consequential },
        policy,
      );
      if (!d.allow) throw new Error("unreachable");
      expect(d.requiresConfirmation).toBe(true);
    }
  });

  it("requires the separate fill grant for submit and upload", () => {
    const navigateOnly = { ...policy, fillOrigins: [] };
    expect(
      decideBrowserAction(
        { kind: "form.submit", url: `${SITE}/x`, consequential: false },
        navigateOnly,
      ).allow,
    ).toBe(false);
    expect(
      decideBrowserAction({ kind: "upload", url: `${SITE}/x`, path: "approved.txt" }, navigateOnly)
        .allow,
    ).toBe(false);
  });
});

/**
 * A screenshot that reaches the extension without masking instructions would
 * capture whatever is on screen — including a password field. These pin that it
 * cannot happen, whatever the caller knows about the page.
 */
describe("screenshots are masked before capture", () => {
  function capturing() {
    const seen: PerformOptions[] = [];
    setBrowserBridge({
      status: async () => ({ available: true }),
      perform: async (_a, opts) => {
        seen.push(opts);
        return { ok: true, detail: "captured" };
      },
    });
    return seen;
  }

  afterEach(() => setBrowserBridge(new UnavailableBrowserBridge()));

  it("always attaches masking, even with no page summary available", async () => {
    const seen = capturing();
    await dispatchBrowserAction({ kind: "screenshot", url: `${SITE}/x` }, policy);
    expect(seen[0].redaction).toBeDefined();
    expect(seen[0].redaction?.maskSelectors).toContain('input[type="password"]');
    expect(seen[0].redaction?.maskSelectors.some((s) => s.includes("one-time"))).toBe(true);
    expect(seen[0].redaction?.maskSelectors.some((s) => s.includes("cc-"))).toBe(true);
  });

  it("also masks the protected fields discovered on the page", async () => {
    const seen = capturing();
    const summary = summarisePage({
      url: `${SITE}/login`,
      title: "Sign in",
      headings: [],
      bodyText: "",
      fields: [
        { name: "email", type: "email" },
        { name: "password", type: "password" },
        { name: "otp", type: "text" },
      ],
      links: [],
    });
    await dispatchBrowserAction({ kind: "screenshot", url: `${SITE}/login` }, policy, {
      pageSummary: summary,
    });
    expect(seen[0].redaction?.maskSelectors).toContain('[name="password"]');
    expect(seen[0].redaction?.maskSelectors).toContain('[name="otp"]');
    // A non-protected field is not masked — the capture stays useful.
    expect(seen[0].redaction?.maskSelectors).not.toContain('[name="email"]');
  });

  it("does not attach screenshot masking to unrelated actions", async () => {
    const seen = capturing();
    await dispatchBrowserAction({ kind: "dom.read", url: `${SITE}/x` }, policy);
    expect(seen[0].redaction).toBeUndefined();
  });

  it("refuses a screenshot on a site without read permission — nothing is captured", async () => {
    const seen = capturing();
    const r = await dispatchBrowserAction(
      { kind: "screenshot", url: `${SITE}/x` },
      { ...policy, readOrigins: [] },
    );
    expect(r.ok).toBe(false);
    expect(seen).toHaveLength(0);
  });
});
