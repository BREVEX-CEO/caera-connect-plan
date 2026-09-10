import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { scoreMatch, snippetAround, sortResults, type SearchResult } from "../results";

/**
 * RANKING, TESTED AS THE RULES IT CLAIMS TO FOLLOW.
 *
 * Search reads the account's rows through parameterized filters — that part is
 * the database's job and is asserted where the query lives. What is decided
 * here is which of the answers a person sees first, and whether the line of
 * text under each one contains the word they typed. Both are pure functions,
 * so both can be held to their own description without a database.
 */

const result = (over: Partial<SearchResult> = {}): SearchResult => ({
  key: "conversation:1",
  kind: "conversation",
  title: "Untitled",
  score: 0,
  ...over,
});

describe("the snippet contains the match", () => {
  it("centres a window on the word rather than returning the opening", () => {
    /*
     * THE DEFECT THIS PREVENTS. Returning the first N characters of a long
     * message routinely showed a snippet that did not contain the search word
     * at all, which reads as a wrong result.
     */
    const text = `${"filler ".repeat(60)}needle ${"filler ".repeat(60)}`;
    expect(snippetAround(text, "needle")).toContain("needle");
  });

  it("marks that it has cut the text, at both ends", () => {
    const text = `${"a ".repeat(200)}needle ${"b ".repeat(200)}`;
    const snippet = snippetAround(text, "needle");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("returns the opening when the match is not there to centre on", () => {
    expect(snippetAround("short text", "absent")).toBe("short text");
  });

  it("matches without regard to case, the way a person searching does", () => {
    expect(snippetAround("The Needle is here", "needle")).toContain("Needle");
  });
});

describe("a title match outranks a body match", () => {
  it("scores a conversation named after the word above one that mentions it", () => {
    const named = scoreMatch("Tax return", "", "tax");
    const mentioned = scoreMatch("Weekly notes", "I sent the tax form", "tax");
    expect(named).toBeGreaterThan(mentioned);
  });

  it("scores an earlier match above a later one", () => {
    expect(scoreMatch("tax return", "", "tax")).toBeGreaterThan(
      scoreMatch("last year's tax return", "", "tax"),
    );
  });

  it("scores nothing at all when the word is absent", () => {
    expect(scoreMatch("Weekly notes", "nothing relevant", "tax")).toBe(0);
  });
});

describe("ordering", () => {
  it("puts the better score first", () => {
    const rows = [result({ key: "a", score: 10 }), result({ key: "b", score: 90 })];
    expect(sortResults(rows).map((row) => row.key)).toEqual(["b", "a"]);
  });

  it("breaks a tie on recency, because a tie is usually two of the same thing", () => {
    const rows = [
      result({ key: "older", score: 50, createdAt: "2026-01-01" }),
      result({ key: "newer", score: 50, createdAt: "2026-06-01" }),
    ];
    expect(sortResults(rows).map((row) => row.key)).toEqual(["newer", "older"]);
  });

  it("does not mutate what it was given", () => {
    const rows = [result({ key: "a", score: 1 }), result({ key: "b", score: 2 })];
    sortResults(rows);
    expect(rows.map((row) => row.key)).toEqual(["a", "b"]);
  });
});

describe("what the account search is able to find", () => {
  const page = readFileSync("src/routes/_authenticated/ocade.search.tsx", "utf8");

  it("looks in tasks and memories, not only in chat and files", () => {
    /*
     * `PLAN.md` Phase 11 asks for one connected workspace graph. Searching for
     * a task by its title used to return nothing, which reads as "you never
     * wrote that down" rather than "this box does not look there" — and a
     * memory, the most personal thing OCADE holds, was equally unfindable.
     */
    expect(page).toContain('.from("ocade_tasks")');
    expect(page).toContain('.from("ocade_memory")');
  });

  it("keeps the person's text as data in the new queries too", () => {
    /*
     * `.or()` takes raw PostgREST grammar, so interpolating a person's search
     * text into it lets punctuation alter the filter expression even with LIKE
     * wildcards escaped. Every query on this page uses a typed `.ilike`
     * instead. Comments explaining that rule are stripped before the check, so
     * the rule is measured against the code and not against its documentation.
     */
    const code = page.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code).not.toContain(".or(");
    const ilikes = page.match(/\.ilike\(/g) ?? [];
    expect(ilikes.length).toBeGreaterThanOrEqual(8);
  });

  it("bounds every one of them", () => {
    const limits = page.match(/\.limit\(\d+\)/g) ?? [];
    expect(limits.length).toBeGreaterThanOrEqual(8);
  });

  it("sends a task and a memory result somewhere they exist", () => {
    expect(page).toContain('to: "/ocade/tasks"');
    expect(page).toContain('to: "/settings/memory"');
    // And the row honours it rather than dropping the reader into Chat.
    expect(page).toContain("result.to ??");
  });
});
