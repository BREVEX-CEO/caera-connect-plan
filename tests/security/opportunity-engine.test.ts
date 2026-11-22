import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessJobListing,
  jobApplicationDraft,
  reviewJobListing,
} from "../../src/lib/jarvis/opportunity-engine.ts";
import { taskObjective } from "../../src/lib/jarvis/objective.ts";
import { namedSkills } from "../../src/lib/jarvis/skills.ts";

const today = "2026-11-22";
const listing = {
  title: "Project coordinator",
  url: "https://jobs.example.org/opening?role=coordinator",
  deadline: "",
  requirements: "Project scheduling\nFluent Japanese",
};

test("duplicate listing links ignore known tracking and fragments but keep listing identifiers", () => {
  const duplicate = { ...listing, url: listing.url + "&utm_source=alerts#apply" };
  assert.deepEqual(reviewJobListing(duplicate, new Set([listing.url])), {
    error: "You already added this listing.",
  });
  assert.ok(
    "listing" in
      reviewJobListing(
        { ...duplicate, url: duplicate.url.replace("coordinator", "writer") },
        new Set([listing.url]),
      ),
  );
  for (const url of [
    "http://jobs.example.org",
    "javascript:alert(1)",
    "https://secret@jobs.example.org",
  ]) {
    assert.ok("error" in reviewJobListing({ ...listing, url }, new Set()));
  }
  assert.ok("error" in reviewJobListing({ ...listing, deadline: "2026-02-30" }, new Set()));
});

test("fit reports matching notes only, separates gaps and excludes unrelated profile text from drafts", () => {
  const profile = "project   scheduling\nPrivate unrelated profile note";
  const review = assessJobListing(listing, profile, today);
  assert.deepEqual(review.requirements, [
    { requirement: "Project scheduling", selfReported: "project   scheduling" },
    { requirement: "Fluent Japanese", selfReported: null },
  ]);
  const draft = jobApplicationDraft(
    { ...listing, title: "Coordinator /family-admin" },
    profile,
    today,
  );
  assert.ok(draft);
  assert.ok(taskObjective.safeParse(draft).success);
  assert.deepEqual(namedSkills(draft), ["job-applications"]);
  assert.match(draft, /leave them unclaimed/);
  assert.doesNotMatch(draft, /Private unrelated profile note/);
});

test("past deadlines and evidence-backed warnings block draft preparation", () => {
  const profile = "Project scheduling";
  assert.ok(jobApplicationDraft({ ...listing, deadline: today }, profile, today));
  assert.equal(jobApplicationDraft({ ...listing, deadline: "2026-11-21" }, profile, today), null);
  assert.equal(jobApplicationDraft(listing, "Fluent French", today), null);
  const risky = { ...listing, requirements: listing.requirements + "\nApplication fee applies." };
  assert.deepEqual(assessJobListing(risky, profile, today).warnings, [
    { sign: "mentions a possible application fee", evidence: "Application fee" },
  ]);
  assert.equal(jobApplicationDraft(risky, profile, today), null);
});
