import { describe, expect, it } from "vitest";
import { ModelInstallationAuthority } from "../installation-authority";

/**
 * REMOVING OFFLINE INTELLIGENCE IS A DECISION, NOT A COOLDOWN.
 *
 * It used to expire after twenty-four hours. On the first visit after that,
 * OCADE quietly downloaded half a gigabyte again to a device whose owner had
 * explicitly removed it — no prompt, no choice, just a large transfer somebody
 * had already said no to, possibly on a metered connection.
 *
 * `PLAN.md`: "Offline remains disabled until the user explicitly chooses
 * Install Offline." `CLAUDE.md`: "never auto-reinstall it after updates,
 * restarts, sign-in cycles, or deploys." Both are absolute, and a timestamp
 * comparison is what quietly turned them into "for a day".
 *
 * The clock is driven a year forward here, because the defect was invisible to
 * any test that did not wait.
 */
function authorityWithIntent(removedAt: number | null, now: () => number) {
  let intent = removedAt;
  return new ModelInstallationAuthority({
    now,
    readIntent: () => intent,
    writeIntent: (at: number | null) => {
      intent = at;
    },
  } as unknown as ConstructorParameters<typeof ModelInstallationAuthority>[0]);
}

const DAY = 24 * 60 * 60 * 1000;

describe("an explicit removal", () => {
  it("is still being honoured a year later", () => {
    const removedAt = 1_000_000;
    const authority = authorityWithIntent(removedAt, () => removedAt + 365 * DAY);
    expect(authority.uninstallIntentActive()).toBe(true);
  });

  it("is still being honoured immediately after it is made", () => {
    const removedAt = 1_000_000;
    const authority = authorityWithIntent(removedAt, () => removedAt);
    expect(authority.uninstallIntentActive()).toBe(true);
  });

  it("does not exist when nobody removed anything", () => {
    const authority = authorityWithIntent(null, () => 1_000_000);
    expect(authority.uninstallIntentActive()).toBe(false);
  });

  it("is not something the clock can undo", () => {
    // The old rule was `now - at < COOLDOWN`. Anything that reintroduces a
    // comparison against the clock fails here rather than in a month.
    const removedAt = 1_000_000;
    for (const elapsed of [0, DAY - 1, DAY, DAY + 1, 30 * DAY, 3650 * DAY]) {
      const authority = authorityWithIntent(removedAt, () => removedAt + elapsed);
      expect(authority.uninstallIntentActive(), `after ${elapsed}ms`).toBe(true);
    }
  });
});
