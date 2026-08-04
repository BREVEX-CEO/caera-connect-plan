import { describe, it, expect } from "vitest";
import {
  validateRequest,
  summariseAccessibility,
  summarisePage,
  hasProtectedFields,
  screenshotRedaction,
  isProtectedInputName,
  refuse,
  reply,
  EXTENSION_PROTOCOL_VERSION,
  MAX_PAGE_TEXT,
  type DomLike,
} from "../native/extension-protocol";

const TOKEN = "a".repeat(24);

function req(over: Record<string, unknown> = {}) {
  return { v: EXTENSION_PROTOCOL_VERSION, token: TOKEN, kind: "page.summary", ...over };
}

describe("validateRequest", () => {
  it("accepts a well-formed, correctly paired request", () => {
    const r = validateRequest(req(), TOKEN);
    expect(r.ok).toBe(true);
  });

  it("accepts connect only with the current six-digit popup code", () => {
    expect(
      validateRequest(
        { v: EXTENSION_PROTOCOL_VERSION, token: "", kind: "connect", pairingCode: "123456" },
        "",
        "123456",
      ),
    ).toMatchObject({ ok: true });
    expect(
      validateRequest(
        { v: EXTENSION_PROTOCOL_VERSION, token: "", kind: "connect", pairingCode: "000000" },
        "",
        "123456",
      ),
    ).toMatchObject({ ok: false });
  });

  it("rejects a non-object payload", () => {
    expect(validateRequest("nope", TOKEN)).toMatchObject({ ok: false });
    expect(validateRequest(null, TOKEN)).toMatchObject({ ok: false });
  });

  it("rejects an unsupported protocol version", () => {
    const r = validateRequest(req({ v: 99 }), TOKEN);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.reason).toMatch(/version/i);
  });

  it("rejects a missing or short token", () => {
    expect(validateRequest(req({ token: "short" }), TOKEN)).toMatchObject({ ok: false });
    expect(validateRequest(req({ token: undefined }), TOKEN)).toMatchObject({ ok: false });
  });

  it("rejects a token from an unpaired page", () => {
    const r = validateRequest(req({ token: "b".repeat(24) }), TOKEN);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.reason).toMatch(/not paired/i);
  });

  it("rejects an unknown request kind rather than coercing it", () => {
    expect(validateRequest(req({ kind: "page.exfiltrate" }), TOKEN)).toMatchObject({ ok: false });
  });

  it("refuses everything when no token is configured", () => {
    expect(validateRequest(req(), "")).toMatchObject({ ok: false });
  });
});

describe("isProtectedInputName", () => {
  it.each(["password", "otp", "cardNumber", "cvv", "captcha", "recovery_code", "hidden"])(
    "flags %s",
    (n) => expect(isProtectedInputName(n)).toBe(true),
  );
  it.each(["email", "fullName", "city", "search"])("allows %s", (n) =>
    expect(isProtectedInputName(n)).toBe(false),
  );
});

const dom: DomLike = {
  url: "https://example.com/login",
  title: "Sign in",
  headings: [" Welcome ", "", "Account"],
  bodyText: "Please   sign\n in to continue",
  fields: [
    { name: "email", type: "email" },
    { name: "password", type: "password" },
    { name: "otp", type: "text" },
  ],
  links: [
    { text: " Help ", href: "https://example.com/help" },
    { text: "js", href: "javascript:alert(1)" },
  ],
};

describe("summarisePage", () => {
  it("reports field NAMES and flags protected ones — never values", () => {
    const s = summarisePage(dom);
    expect(s.fields).toEqual([
      { name: "email", type: "email", protected: false },
      { name: "password", type: "password", protected: true },
      { name: "otp", type: "text", protected: true },
    ]);
    // The shape has no value field at all.
    expect(JSON.stringify(s)).not.toContain("value");
  });

  it("normalises whitespace and trims headings", () => {
    const s = summarisePage(dom);
    expect(s.text).toBe("Please sign in to continue");
    expect(s.headings).toEqual(["Welcome", "Account"]);
  });

  it("drops non-http links such as javascript: URLs", () => {
    const s = summarisePage(dom);
    expect(s.links).toHaveLength(1);
    expect(s.links[0].href).toBe("https://example.com/help");
  });

  it("bounds very large pages", () => {
    const s = summarisePage({ ...dom, bodyText: "x".repeat(MAX_PAGE_TEXT + 5_000) });
    expect(s.text.length).toBe(MAX_PAGE_TEXT);
  });

  it("detects that a page has protected fields", () => {
    expect(hasProtectedFields(summarisePage(dom))).toBe(true);
    expect(
      hasProtectedFields(summarisePage({ ...dom, fields: [{ name: "city", type: "text" }] })),
    ).toBe(false);
  });
});

describe("summariseAccessibility", () => {
  it("bounds node names and preserves protected name-only metadata", () => {
    const snapshot = summariseAccessibility({
      url: "https://example.com/login",
      title: " Sign in ",
      nodes: [
        {
          role: " input ",
          name: `${"password".repeat(30)} secret-value-is-not-present`,
          disabled: false,
          protected: true,
        },
      ],
    });
    expect(snapshot.title).toBe("Sign in");
    expect(snapshot.nodes[0]).toMatchObject({
      role: "input",
      disabled: false,
      protected: true,
    });
    expect(snapshot.nodes[0].name.length).toBeLessThanOrEqual(120);
    expect(JSON.stringify(snapshot)).not.toContain('"value"');
  });
});

describe("screenshotRedaction", () => {
  it("always masks standard credential inputs", () => {
    const r = screenshotRedaction(summarisePage({ ...dom, fields: [] }));
    expect(r.maskSelectors).toContain('input[type="password"]');
    expect(r.maskSelectors.some((s) => s.includes("one-time"))).toBe(true);
  });

  it("additionally masks every protected field found on the page", () => {
    const r = screenshotRedaction(summarisePage(dom));
    expect(r.maskSelectors).toContain('[name="password"]');
    expect(r.maskSelectors).toContain('[name="otp"]');
    expect(r.reason).toMatch(/masked before capture/i);
  });
});

describe("response helpers", () => {
  it("builds typed replies and refusals", () => {
    expect(reply("tabs.list", [])).toMatchObject({ ok: true, kind: "tabs.list" });
    expect(refuse("nope")).toEqual({ ok: false, error: "nope" });
  });
});
