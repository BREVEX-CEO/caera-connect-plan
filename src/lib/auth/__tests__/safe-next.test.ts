/**
 * OCADE MUST NOT BE A REDIRECTOR FOR SOMEBODY ELSE'S PHISHING PAGE.
 *
 * The check that stood here was `startsWith("/") && !startsWith("//")`, in two
 * copies that disagreed with each other. It reads as "a relative path" and is
 * not one: a browser normalises a backslash when resolving a URL, so
 * `/\evil.com` starts with a single slash, does not start with two, and
 * resolves to `https://evil.com/`. A sign-in link carrying that is a phishing
 * page reached through OCADE's own domain, after a real sign-in.
 *
 * Each case below is a payload, not a hypothetical shape.
 */
import { describe, expect, it } from "vitest";
import { safeNext, DEFAULT_NEXT } from "../safe-next";

const ORIGIN = "https://ocade.test";

describe("destinations that leave OCADE are refused", () => {
  it.each([
    ["a backslash that a browser reads as a host", "/\\evil.com"],
    ["two backslashes", "/\\\\evil.com"],
    ["a protocol-relative URL", "//evil.com"],
    ["an absolute URL on another origin", "https://evil.com/steal"],
    ["a different scheme entirely", "javascript:alert(1)"],
    ["a data URL", "data:text/html,<script>alert(1)</script>"],
    ["another origin dressed as a path", "/..//evil.com"],
    ["a same-looking host with a suffix", "https://ocade.test.evil.com/"],
    ["a userinfo trick", "https://ocade.test@evil.com/"],
  ])("refuses %s", (_name, payload) => {
    expect(safeNext(payload, ORIGIN)).toBeNull();
  });

  it("refuses nothing at all", () => {
    expect(safeNext(undefined, ORIGIN)).toBeNull();
    expect(safeNext(null, ORIGIN)).toBeNull();
    expect(safeNext("", ORIGIN)).toBeNull();
  });
});

describe("destinations inside OCADE are kept", () => {
  it("keeps an ordinary path", () => {
    expect(safeNext("/ocade/projects", ORIGIN)).toBe("/ocade/projects");
  });

  it("keeps the query and fragment, which carry real state", () => {
    expect(safeNext("/ocade?conversation=abc#top", ORIGIN)).toBe("/ocade?conversation=abc#top");
  });

  it("accepts a same-origin absolute URL and returns it as a path", () => {
    expect(safeNext(`${ORIGIN}/settings/security`, ORIGIN)).toBe("/settings/security");
  });

  it("keeps the root", () => {
    expect(safeNext("/", ORIGIN)).toBe("/");
  });
});

describe("with no origin to compare against, it fails closed", () => {
  it("accepts a plain path", () => {
    expect(safeNext("/home", undefined)).toBe("/home");
  });

  it("still refuses the backslash and the protocol-relative forms", () => {
    expect(safeNext("/\\evil.com", undefined)).toBeNull();
    expect(safeNext("//evil.com", undefined)).toBeNull();
  });

  it("refuses anything absolute", () => {
    expect(safeNext("https://evil.com", undefined)).toBeNull();
  });
});

describe("both auth screens use the same rule", () => {
  it("has a default nobody has to invent twice, and it is Chat", () => {
    // docs/APP_FLOW.md: successful auth resolves to the intended deep link, or
    // to /ocade. `/home` is only a forwarding address, so defaulting to it
    // spent an extra navigation to arrive at the same screen.
    expect(DEFAULT_NEXT).toBe("/ocade");
  });
});
