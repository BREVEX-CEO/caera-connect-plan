/** Plan 14E.2.5: a suggestion that drops a number, quote, path, URL, @name or negation is flagged. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { lostDetails } from "../../src/lib/chat/prompt-details.ts";

test("every concrete detail and negation the suggestion dropped is named", () => {
  const draft =
    'Do not email anyone. Summarise reports/q3/sales.xlsx into "Q3 summary" at 12 pt, ' +
    "cite https://example.com/a and @budget, under 300 words.";
  assert.deepEqual(lostDetails(draft, draft), []);
  const lossy = "Please summarise the sales report into a short summary for the team.";
  const lost = lostDetails(draft, lossy);
  for (const detail of [
    '"Q3 summary"',
    "https://example.com/a",
    "reports/q3/sales.xlsx",
    "@budget",
    "12 pt",
    "300",
  ])
    assert.ok(lost.includes(detail), detail);
  assert.ok(
    lost.some((item) => item.includes("negation")),
    "the dropped 'not' is named",
  );
  assert.deepEqual(
    lostDetails("Never delete files.", "Never delete any of the files, please."),
    [],
  );
});
