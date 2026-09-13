import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * A ROUTE WITH CHILDREN HAS TO RENDER THEM.
 *
 * TanStack's flat file routing makes `auth.tsx` the PARENT of `auth.verify.tsx`
 * and `auth.callback.tsx`, not a sibling. A parent whose component does not
 * render an `<Outlet/>` renders itself in place of every child, and the child's
 * `head` still applies — so `/auth/verify` served a document titled "Enter your
 * code" whose body was the sign-in form.
 *
 * That is what OCADE shipped. Nobody who asked for an email or phone code could
 * enter one, and no Google handshake could complete, because `/auth/callback`
 * was the sign-in form too. Every route answered 200 and the titles were right,
 * which is why route-level checks and the reachability audit all passed.
 *
 * The fix was to make `/auth` a leaf (`auth.index.tsx`) so the three flows are
 * siblings under a parent with no component. This keeps it that way: a route
 * file that owns children must either render an `<Outlet/>` or not be a
 * component route at all.
 */

const ROUTES = "src/routes";

/** `auth.verify.tsx` and `auth.callback.tsx` make `auth` a parent segment. */
function parentSegments(files: string[]): Set<string> {
  const parents = new Set<string>();
  for (const file of files) {
    const parts = file.replace(/\.tsx$/, "").split(".");
    for (let index = 1; index < parts.length; index += 1) {
      parents.add(parts.slice(0, index).join("."));
    }
  }
  return parents;
}

describe("every route that owns children", () => {
  const files = readdirSync(ROUTES).filter((name) => name.endsWith(".tsx"));
  const parents = parentSegments(files);

  for (const parent of parents) {
    const file = `${parent}.tsx`;
    if (!files.includes(file)) continue;
    it(`renders them — ${file}`, () => {
      const source = readFileSync(`${ROUTES}/${file}`, "utf8");
      // `index` is the leaf for the parent's own path and is never a parent.
      if (parent.endsWith(".index")) return;
      expect(source).toContain("<Outlet");
    });
  }

  it("finds the auth flows as siblings rather than children of the form", () => {
    // The specific arrangement the defect above was fixed into, named so a
    // future rename back to `auth.tsx` fails here with the reason rather than
    // silently restoring the bug.
    expect(files).toContain("auth.index.tsx");
    expect(files).not.toContain("auth.tsx");
  });
});
