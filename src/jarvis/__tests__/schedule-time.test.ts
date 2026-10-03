import { describe, expect, it } from "vitest";
import { localIso, nextOccurrence, safeZone } from "../schedule-time";

const at = (iso: string) => new Date(iso);

describe("when a schedule runs next", () => {
  it("keeps the same wall-clock time across a clock change", () => {
    // London goes from BST (+01:00) to GMT on 25 October 2026.
    const before = at("2026-10-24T08:00:00Z"); // 09:00 in London
    const next = nextOccurrence(before, "daily", "Europe/London", before)!;
    expect(next.toISOString()).toBe("2026-10-25T09:00:00.000Z"); // still 09:00, now GMT
    expect(localIso(next, "Europe/London")).toBe("2026-10-25T09:00:00+00:00");
  });

  it("skips weekends for weekdays, and a week for weekly", () => {
    const friday = at("2026-10-02T03:30:00Z"); // Friday 09:00 in India
    expect(
      localIso(nextOccurrence(friday, "weekdays", "Asia/Kolkata", friday)!, "Asia/Kolkata"),
    ).toBe("2026-10-05T09:00:00+05:30");
    expect(nextOccurrence(friday, "weekly", "Asia/Kolkata", friday)!.toISOString()).toBe(
      "2026-10-09T03:30:00.000Z",
    );
  });

  it("skips runs missed while OCADE was unreachable, never replaying them", () => {
    const due = at("2026-09-01T07:00:00Z");
    const now = at("2026-09-04T12:00:00Z");
    expect(nextOccurrence(due, "daily", "UTC", now)!.toISOString()).toBe(
      "2026-09-05T07:00:00.000Z",
    );
  });

  it("a one-off has no next run, and an unknown zone is read as UTC", () => {
    expect(
      nextOccurrence(at("2026-09-01T07:00:00Z"), "none", "UTC", at("2026-09-01T08:00:00Z")),
    ).toBeNull();
    expect(safeZone("Mars/Olympus")).toBe("UTC");
    expect(localIso(at("2026-09-30T17:10:00Z"), "Asia/Kolkata")).toBe("2026-09-30T22:40:00+05:30");
    expect(localIso(at("2026-09-30T17:10:00Z"), "America/New_York")).toBe(
      "2026-09-30T13:10:00-04:00",
    );
  });
});
