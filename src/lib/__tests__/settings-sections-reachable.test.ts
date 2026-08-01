import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";

/**
 * Every settings section marked `active` must actually render something.
 *
 * A section can be served two different ways: a dedicated route file
 * (`settings.<slug>.tsx`) or an entry in the `IMPLEMENTED_SECTIONS` map inside
 * the `$section` catch-all. If a slug is marked `active` but has NEITHER, the
 * catch-all falls through to the Setup-Required state — so the settings menu
 * advertises a working section that renders "not set up yet". That is an
 * inaccurate completion claim rendered directly at the user.
 *
 * Nothing checked this. The status lives in `settings-sections.ts` and the two
 * rendering mechanisms live elsewhere, so the three could drift apart silently.
 *
 * A NOTE ON GETTING THIS WRONG. The first version of this check looked only at
 * `IMPLEMENTED_SECTIONS` and reported ten sections as broken. All ten have
 * dedicated route files and were fine. Both mechanisms must be considered, or
 * this test manufactures false failures.
 */

const SECTIONS_SRC = readFileSync("src/lib/settings-sections.ts", "utf8");
const ROUTE_DIR = "src/routes/_authenticated";
const CATCH_ALL = `${ROUTE_DIR}/settings.$section.tsx`;

/** Slugs handled by the catch-all's implementation map. */
function implementedInCatchAll(): string[] {
  const src = readFileSync(CATCH_ALL, "utf8");
  const start = src.indexOf("IMPLEMENTED_SECTIONS");
  const end = src.indexOf("};", start);
  return [...src.slice(start, end).matchAll(/^\s{2}([a-zA-Z0-9_-]+):\s*\(\)\s*=>/gm)].map(
    (m) => m[1],
  );
}

/** Slugs served by their own route file. */
function dedicatedRouteSlugs(): string[] {
  return readdirSync(ROUTE_DIR)
    .filter((f) => /^settings\.[a-z0-9-]+\.tsx$/.test(f))
    .map((f) => f.replace(/^settings\./, "").replace(/\.tsx$/, ""))
    .filter((slug) => slug !== "index" && slug !== "$section");
}

/** Every slug whose declared status is `active`. */
function activeSlugs(): string[] {
  const found: string[] = [];
  const re = /slug:\s*"([a-z0-9-]+)"[\s\S]{0,400}?status:\s*"([a-z_]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(SECTIONS_SRC))) {
    if (match[2] === "active") found.push(match[1]);
  }
  return found;
}

describe("settings sections that claim to be active can actually render", () => {
  const active = activeSlugs();
  const implemented = implementedInCatchAll();
  const dedicated = dedicatedRouteSlugs();

  it("finds sections, routes and implementations", () => {
    // Any of these coming back empty would make the check below vacuous.
    expect(active.length).toBeGreaterThan(5);
    expect(implemented.length).toBeGreaterThan(0);
    expect(dedicated.length).toBeGreaterThan(0);
  });

  it("gives every ACTIVE section either a dedicated route or an implementation", () => {
    const unreachable = active.filter(
      (slug) => !implemented.includes(slug) && !dedicated.includes(slug),
    );
    expect(
      unreachable,
      `these sections are marked active but would render Setup Required: ${unreachable.join(", ")}`,
    ).toEqual([]);
  });

  it("keeps every catch-all implementation pointing at a real component file", () => {
    const src = readFileSync(CATCH_ALL, "utf8");
    for (const slug of implemented) {
      const match = new RegExp(`^\\s{2}${slug}:\\s*\\(\\)\\s*=>\\s*<([A-Za-z0-9_]+)`, "m").exec(
        src,
      );
      expect(match, `${slug} has no component`).toBeTruthy();
      const component = match![1];
      const importLine = new RegExp(`import \\{ ${component} \\} from "([^"]+)"`).exec(src);
      expect(importLine, `${component} is not imported`).toBeTruthy();
      const path = importLine![1].replace(/^@\//, "src/");
      expect(existsSync(`${path}.tsx`) || existsSync(`${path}.ts`), `${path} missing`).toBe(true);
    }
  });

  it("includes the Updates section, which is served by the catch-all", () => {
    // Regression guard for the section wired this session.
    expect(active).toContain("updates");
    expect(implemented).toContain("updates");
  });
});
