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
 */
const FETCHES_ON_LOAD = /useQuery\(|useSuspenseQuery\(|\bloader:\s/;

/**
 * Awaits ANYTHING. Every await can reject, and a rejection nobody renders is a
 * button that appears to do nothing.
 */
const AWAITS = /\bawait\s+(?!import\()/;

/** Something in this file tells the reader it is waiting. */
const HAS_LOADING = /Loader2|isPending|isLoading|isFetching|Skeleton|"Loading|Checking |…["`]/;

/** Something in this file tells the reader it went wrong. */
const HAS_ERROR =
  /isError|role="alert"|toast\.error|SetupRequiredState|catch\s*[({]|ErrorBoundary|errorComponent/;

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
const fetching = files.filter((file) => FETCHES_ON_LOAD.test(readFileSync(file, "utf8")));
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
