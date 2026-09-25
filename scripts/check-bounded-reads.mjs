/**
 * NO READ WITHOUT A BOUND — PLAN.md Phase 18's third silent speed killer.
 *
 * "Explicitly eliminate the five silent speed killers: N+1 queries, missing
 * evidence-backed indexes, UNBOUNDED READS, unoptimized media and giant eager
 * bundles."
 *
 * An unbounded read is invisible in development and fatal in production, and it
 * fails in the worst order: the accounts it hurts first are the ones that used
 * the product most. A list that is fine at forty rows is a stall at four
 * thousand, and the person it stalls for is the customer who wrote four
 * thousand things.
 *
 * WHAT COUNTS AS BOUNDED. `.limit()` or `.range()` caps the rows. `.single()`
 * and `.maybeSingle()` ask for one and error otherwise, so they are bounded by
 * construction. A `count`-only read transfers no rows. An `insert`, `update`,
 * `upsert` or `delete` that returns the row it just wrote is bounded by what it
 * wrote. Everything else has to say how much it is willing to fetch.
 *
 * THE EXEMPTION IS A SENTENCE, NOT A SILENCE. A read that genuinely must be
 * whole — a small fixed catalogue, a per-user settings row set — carries
 * `bounded-read:` with the reason on or above the line. That makes each
 * exception something somebody wrote down and a reviewer can disagree with.
 */

import { readFileSync } from "node:fs";
import { globSync } from "node:fs";

const SOURCES = globSync("src/**/*.{ts,tsx}").filter((file) => !file.includes("__tests__"));

/** How far past `.select(` to look for the rest of the query chain. */
const CHAIN_WINDOW = 1_400;

const BOUNDED = [
  ".limit(",
  ".range(",
  ".single()",
  ".maybeSingle()",
  'count: "exact", head: true',
  "head: true",
];

const problems = [];
let readsChecked = 0;

for (const file of SOURCES) {
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");

  let index = source.indexOf(".select(");
  while (index !== -1) {
    /*
     * Comments come out before the chain is measured. A `;` inside one — "one
     * browser install has one grant;" — ended the chain early and reported a
     * bounded read as unbounded, which is the shape of false positive that
     * gets a gate switched off.
     */
    const chain = source
      .slice(index, index + CHAIN_WINDOW)
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    const end = chain.indexOf(";");
    /*
     * A CHAIN CAN BE BUILT IN PIECES. Several reads assign the query to a
     * variable, narrow it conditionally, and apply the cap on the line that
     * awaits it — `let q = supabase.from(…).select(…); … await
     * q.order(…).limit(100)`. Stopping at the first `;` calls that unbounded,
     * so when the select is assigned to a name the whole window is searched
     * instead.
     */
    const assignedToVariable = /(?:const|let)\s+\w+\s*=[^;]*$/.test(
      source.slice(Math.max(0, index - 300), index),
    );
    const query = assignedToVariable || end === -1 ? chain : chain.slice(0, end);
    const lineNumber = source.slice(0, index).split("\n").length;
    const line = lines[lineNumber - 1] ?? "";
    const nearby = lines.slice(Math.max(0, lineNumber - 6), lineNumber).join("\n");

    /*
     * A DATABASE READ, NOT ANY `.select(`. `field.select()` on an input is a
     * DOM call, and flagging it would teach a reader that this gate does not
     * know what it is looking at.
     */
    const isDatabaseRead = /\.from\(\s*["'`]/.test(source.slice(Math.max(0, index - 300), index));
    if (!isDatabaseRead) {
      index = source.indexOf(".select(", index + 1);
      continue;
    }

    const writeReturningItsOwnRow = /\.(insert|update|upsert|delete)\(/.test(
      source.slice(Math.max(0, index - 400), index),
    );

    readsChecked += 1;
    const bounded =
      BOUNDED.some((marker) => query.includes(marker)) ||
      writeReturningItsOwnRow ||
      nearby.includes("bounded-read:") ||
      line.includes("bounded-read:");

    if (!bounded) problems.push(`${file}:${lineNumber}`);
    index = source.indexOf(".select(", index + 1);
  }
}

if (problems.length > 0) {
  console.error(`Unbounded reads: ${problems.length} of ${readsChecked} checked`);
  for (const problem of problems) console.error(`- ${problem}`);
  console.error(
    "\nAdd .limit()/.range(), ask for one row, or mark the line `bounded-read:` with the reason.",
  );
  process.exit(1);
}

console.log(`Bounded-read audit: ${readsChecked} database reads, every one bounded.`);
