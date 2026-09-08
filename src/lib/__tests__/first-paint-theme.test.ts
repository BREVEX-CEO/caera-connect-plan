import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * THE WHITE FRAME BEFORE THE APP.
 *
 * A browser paints its own canvas before it has parsed any CSS, and that
 * canvas is white. On a product that is black everywhere else, the reader sees
 * a white flash, and a white flash reads as the page having failed and
 * reloaded — the single most expensive frame in the whole product, because it
 * is the first one.
 *
 * Worse for the light theme: the class that selects it is added by a React
 * effect, so the sequence used to be white, then black (the default theme),
 * then light. Two flips before the page settles.
 *
 * The fix is an inline background on <html> and a synchronous boot script that
 * reads the stored preference before anything renders. Both halves matter and
 * both are easy to delete by accident, so both are asserted here.
 */

const ROOT = readFileSync(join("src", "routes", "__root.tsx"), "utf8");
const PROVIDER = readFileSync(join("src", "lib", "theme-provider.tsx"), "utf8");

const BOOT = ROOT.slice(ROOT.indexOf("const THEME_BOOT"), ROOT.indexOf("function RootShell"));

describe("the first frame is already the right colour", () => {
  it("paints <html> even with no stylesheet and no script", () => {
    expect(ROOT).toMatch(/<html lang="en" style=\{\{ background: "#0a0a0a" \}\}/);
  });

  it("runs the theme boot synchronously, in head, before HeadContent", () => {
    const head = ROOT.slice(ROOT.indexOf("<head>"), ROOT.indexOf("</head>"));
    expect(head).toContain("THEME_BOOT");
    expect(head.indexOf("THEME_BOOT")).toBeLessThan(head.indexOf("<HeadContent"));
    // A module or a deferred script would paint after the frame it is meant to
    // fix, which is the whole bug.
    expect(head).not.toMatch(/<script[^>]*\b(type="module"|defer|async)/);
  });

  it("reads the same storage key the theme provider writes", () => {
    const key = PROVIDER.match(/const LS_KEY = "([^"]+)"/)?.[1];
    expect(key).toBeTruthy();
    expect(BOOT).toContain(key!);
  });

  it("understands the same three themes the provider does", () => {
    for (const theme of ["light", "real"]) {
      expect(BOOT).toContain(`"${theme}"`);
      expect(PROVIDER).toContain(`"${theme}"`);
    }
  });

  it("sets the class the stylesheet selects on, not one of its own", () => {
    // styles.css keys light off `html.light` and real off `html.real`.
    expect(BOOT).toMatch(/classList\.add\("theme-"\+t\)/);
    expect(BOOT).toMatch(/if\(t!=="dark"\)d\.classList\.add\(t\)/);
  });

  it("declares color-scheme, so form controls and scrollbars match", () => {
    expect(BOOT).toContain("colorScheme");
  });

  it("swallows every failure rather than blanking the page", () => {
    // Storage can be blocked and the stored value can be garbage. Neither is
    // worth an exception in a script that runs before anything renders.
    const tries = BOOT.match(/try\{/g) ?? [];
    expect(tries.length).toBeGreaterThanOrEqual(2);
    const catches = BOOT.match(/catch\(e\)\{\}/g) ?? [];
    expect(catches.length).toBeGreaterThanOrEqual(2);
  });

  it("is an IIFE, so it leaks no globals into the page", () => {
    expect(BOOT).toMatch(/\(function\(\)\{/);
    expect(BOOT).toMatch(/\}\)\(\);/);
  });

  it("defaults to the dark background when it knows nothing", () => {
    expect(BOOT).toMatch(/var t="dark"/);
    expect(BOOT).toContain("#0a0a0a");
  });
});

/*
 * THE SUPPRESSION IS LOAD-BEARING.
 *
 * The boot script exists to change <html> before React sees it, so the server
 * markup and the live DOM disagree on that element by design. React 19 reads
 * that as a failed hydration and throws the server HTML away to re-render the
 * whole tree on the client.
 *
 * Online that is an invisible cost. Offline it is a blank page: a full client
 * render has to rebuild everything from cache, and the service-worker probe
 * found the document still empty — no title, no body — ten seconds after
 * navigation. One missing prop turned a working offline shell into a white
 * rectangle, so it gets its own test rather than living as a comment.
 */
describe("the boot script and React agree to disagree about <html>", () => {
  it("suppresses hydration warnings on the element the script mutates", () => {
    expect(ROOT).toMatch(/<html lang="en"[^>]*suppressHydrationWarning/);
  });

  it("suppresses it on <html> and nowhere else in the shell", () => {
    // One level deep by design: a genuine mismatch inside the app must still
    // fail loudly, so this must not spread to <body> or to children. Counted
    // as JSX attributes rather than as text, because the rationale above the
    // element names the prop too.
    const shell = ROOT.slice(ROOT.indexOf("function RootShell"));
    const attributes = shell.match(/suppressHydrationWarning[\s/>=]/g) ?? [];
    expect(attributes).toHaveLength(1);
    expect(shell).not.toMatch(/<body[^>]*suppressHydrationWarning/);
  });

  it("mutates exactly what the suppression covers: className and style", () => {
    // If the script ever starts writing something else onto <html>, the
    // suppression still covers it, but the reason above stops being accurate.
    expect(BOOT).toMatch(/d\.classList\.add/);
    expect(BOOT).toMatch(/d\.style\./);
    expect(BOOT).not.toMatch(/document\.body/);
  });
});
