import { describe, it, expect } from "vitest";
import { renderErrorPage } from "../error-page";
import { cn } from "../utils";

/**
 * Last-resort error page and the class-name helper.
 *
 * The error page is what a user sees when everything else has failed, so it
 * must be self-contained (no external CSS, fonts or scripts to fetch — those
 * requests are exactly what may be failing) and must offer a way out. It also
 * must not leak internals: a stack trace or error detail here would be shown to
 * an end user on a page that is served when something went wrong on our end.
 */

describe("renderErrorPage", () => {
  const html = renderErrorPage();

  it("returns a complete standalone document", () => {
    expect(html.trimStart().startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain("</html>");
  });

  it("sets a charset, title and viewport", () => {
    expect(html).toContain('charset="utf-8"');
    expect(html).toContain("<title>");
    expect(html).toContain('name="viewport"');
  });

  it("fetches NOTHING external — the network is what may be broken", () => {
    expect(html).not.toMatch(/<script\s+[^>]*src=/i);
    expect(html).not.toMatch(/<link\s+[^>]*href=["']https?:/i);
    expect(html).not.toMatch(/@import/i);
    expect(html).not.toMatch(/https?:\/\//); // no remote URL of any kind
  });

  it("gives the user both a retry and a way home", () => {
    expect(html).toContain("location.reload()");
    expect(html).toContain('href="/"');
  });

  it("explains the situation in plain language", () => {
    expect(html).toContain("This page didn't load");
    expect(html).toMatch(/went wrong/i);
  });

  it("leaks no stack trace, error detail or internal path", () => {
    expect(html).not.toMatch(/\bat\s+\w+\s+\(/); // stack frame shape
    expect(html).not.toMatch(/node_modules|\.tsx?:|src\//);
    expect(html).not.toMatch(/stack|exception|traceback/i);
  });

  it("is deterministic, so it can be cached or snapshotted safely", () => {
    expect(renderErrorPage()).toBe(html);
  });
});

/**
 * `cn` exists specifically so later Tailwind classes WIN over earlier
 * conflicting ones. That is the entire reason twMerge is used rather than plain
 * string concatenation, and it is the behaviour every component relies on when
 * it accepts a `className` prop and merges it over its own defaults.
 */
describe("cn", () => {
  it("joins plain class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("lets a LATER tailwind class override an earlier conflicting one", () => {
    // A component's default padding must lose to the caller's override.
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("keeps non-conflicting classes together", () => {
    expect(cn("p-2", "text-lg")).toBe("p-2 text-lg");
  });

  it("drops falsy values instead of emitting 'false' or 'undefined'", () => {
    expect(cn("a", false, null, undefined, "")).toBe("a");
  });

  it("supports conditional object syntax", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
  });

  it("flattens arrays of class values", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });

  it("returns an empty string when given nothing", () => {
    expect(cn()).toBe("");
    expect(cn(undefined)).toBe("");
  });
});
