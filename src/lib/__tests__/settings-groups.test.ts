import { describe, expect, it } from "vitest";
import { SETTINGS_GROUPS } from "../settings-sections";

/*
 * A SETTINGS SCREEN GROWS INTO A CONTROL PANEL ONE DEFENSIBLE HEADING AT A TIME.
 *
 * Nobody ever adds a bad group. Each one arrives with a good reason: a new
 * subsystem shipped, and its controls did not obviously belong under any
 * existing heading, so it got a heading. Repeat that eight times and the
 * reader — who came to change one switch — is scanning sixteen headings, none
 * of which is wrong and none of which is where they are looking.
 *
 * The eight below are the whole list. Anything new goes inside one of them, or
 * into Advanced, which exists so the other seven can stay short enough to read
 * at a glance. This test is the thing that makes that a rule rather than an
 * intention.
 */

const EXPECTED = [
  "General",
  "Account & Security",
  "Appearance",
  "Chat & Voice",
  "Privacy & Data",
  "Devices & Control",
  "Plan",
  "Advanced",
];

describe("settings has exactly the eight groups", () => {
  it("names them, in order", () => {
    expect(SETTINGS_GROUPS.map((g) => g.label)).toEqual(EXPECTED);
  });

  it("adds no ninth", () => {
    // Stated separately from the order assertion so a failure reads as
    // "someone added a group", which is the mistake being prevented.
    expect(SETTINGS_GROUPS).toHaveLength(8);
  });

  it("keeps one group id per group", () => {
    const ids = SETTINGS_GROUPS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hides only Advanced behind the reveal", () => {
    const advanced = SETTINGS_GROUPS.filter((g) => g.advanced);
    expect(advanced.map((g) => g.label)).toEqual(["Advanced"]);
  });

  it("gives every group something to show", () => {
    for (const group of SETTINGS_GROUPS) {
      expect(group.items.length, `${group.label} is empty`).toBeGreaterThan(0);
    }
  });

  it("routes every section to a distinct slug", () => {
    const slugs = SETTINGS_GROUPS.flatMap((g) => g.items.map((i) => i.slug));
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keeps the seven visible groups short enough to scan", () => {
    // Advanced is exempt: it is the overflow, and its length is the price of
    // the others being readable.
    for (const group of SETTINGS_GROUPS) {
      if (group.advanced) continue;
      expect(group.items.length, `${group.label} has too many rows`).toBeLessThanOrEqual(4);
    }
  });

  it("describes every section, because the search box reads descriptions", () => {
    for (const group of SETTINGS_GROUPS) {
      for (const item of group.items) {
        expect(item.description.length, `${item.label} has no description`).toBeGreaterThan(10);
      }
    }
  });
});
