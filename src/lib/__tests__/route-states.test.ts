import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/*
 * A SCREEN THAT WAITS MUST SAY IT IS WAITING, AND SAY WHEN IT FAILED.
 *
 * The failure this catches is not a missing feature, it is a blank rectangle:
 * a route that fetches, renders nothing while the request is in flight, and
 * renders nothing again when the request fails. Both look identical to the
 * reader, and both look like a broken product rather than a slow network or a
 * signed-out session.
 *
 * Only routes that actually fetch are held to it. Most of this application's
 * screens render from local state and are correct with no spinner at all;
 * requiring one everywhere would add ceremony to screens that never wait.
 */

const ROUTES_DIR = join("src", "routes");

/**
 * Fetches AT LOAD — the case where the reader is left looking at the screen.
 * An `await` inside a click handler is a different situation: the reader
 * pressed something and knows they did.
 *
 * A `loader:` counts only when it is ASYNCHRONOUS. This started as a bare
 * `loader:` match and flagged a route whose loader reads an in-memory array and
 * returns — there is no moment at which anybody is waiting for it, so a spinner
 * there would be ceremony for a state that cannot happen, and adding one to
 * satisfy a rule is how a real rule turns into a ritual.
 */
function fetchesOnLoad(source: string): boolean {
  if (/useQuery\(|useSuspenseQuery\(/.test(source)) return true;
  const loader = loaderBody(source);
  return loader !== null && /\basync\b|\bawait\b/.test(loader);
}

/**
 * The text of a route's `loader:` property, brace-balanced.
 *
 * Balanced rather than bounded by a wildcard, for the reason a previous version
 * of a check in this repository passed with its guarantee deleted: a bounded
 * pattern runs past the closing brace and reads whatever comes next.
 */
function loaderBody(source: string): string | null {
  const start = source.search(/\bloader:\s/);
  if (start < 0) return null;
  const open = source.indexOf("{", start);
  if (open < 0) return source.slice(start, start + 200);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  return source.slice(start);
}

/**
 * Awaits ANYTHING. Every await can reject, and a rejection nobody renders is a
 * button that appears to do nothing.
 */
const AWAITS = /\bawait\s+(?!import\()/;

/**
 * Something in this file tells the reader it is waiting.
 *
 * `pendingComponent` is the router's own first-class name for this state, and a
 * route that declares one has answered the question more directly than any of
 * the string patterns can. It must be assigned something: `pendingComponent:
 * undefined` is the absence this rule exists to find.
 */
const HAS_LOADING =
  /Loader2|isPending|isLoading|isFetching|Skeleton|"Loading|Checking |…["`]|pendingComponent:\s*(?!undefined|null)\S/;

/**
 * Something in this file tells the reader it went wrong.
 *
 * `SetupRequiredState` and `OcadeDataTable` are DELEGATES: a route that hands
 * one of them an error state has said what it needed to say, and the component
 * renders the alert. Naming them here rather than widening the pattern to any
 * `error=` prop keeps the rule from being satisfied by a variable that happens
 * to be called error — and each delegate's own tests assert it really renders
 * the failure (`ocade-data-table.test.tsx`: "shows an error with a way back").
 */
const HAS_ERROR =
  /isError|role="alert"|toast\.error|SetupRequiredState|catch\s*[({]|ErrorBoundary|errorComponent|<OcadeDataTable[\s\S]*?\berror=\{/;

function routeFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "__tests__") continue;
    try {
      if (readdirSync(full).length >= 0) {
        routeFiles(full, out);
        continue;
      }
    } catch {
      /* not a directory */
    }
    if (/\.tsx$/.test(entry)) out.push(full);
  }
  return out;
}

const files = routeFiles(ROUTES_DIR);
const fetching = files.filter((file) => fetchesOnLoad(readFileSync(file, "utf8")));
const awaiting = files.filter((file) => AWAITS.test(readFileSync(file, "utf8")));

describe("routes that fetch", () => {
  it("were found at all, so a broken scan cannot pass", () => {
    expect(files.length).toBeGreaterThan(40);
    expect(fetching.length).toBeGreaterThan(8);
    expect(awaiting.length).toBeGreaterThan(20);
  });

  it("each say they are waiting", () => {
    const silent = fetching.filter((file) => !HAS_LOADING.test(readFileSync(file, "utf8")));
    expect(silent, "these routes fetch and render nothing while they wait").toEqual([]);
  });

  it("each say when it went wrong", () => {
    const mute = awaiting.filter((file) => !HAS_ERROR.test(readFileSync(file, "utf8")));
    expect(mute, "these routes await something and render nothing when it rejects").toEqual([]);
  });
});
