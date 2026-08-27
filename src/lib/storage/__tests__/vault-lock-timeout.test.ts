import { describe, expect, it } from "vitest";
import { applyStoredLockTimeout, setLockTimeout } from "../vault-session";

/*
 * A PREFERENCE MUST NOT BE ABLE TO LOCK SOMEBODY OUT OF THEIR OWN DATA.
 *
 * Also found by walking the journey. Every unlock path ended by reading
 * `lock_timeout_seconds` off the vault's configuration row and handing it to
 * a setter that throws on anything non-finite — after the key had already
 * been derived. A row without that value therefore failed the whole unlock
 * with "The vault lock timeout is invalid", which tells the person nothing
 * about the fact that their work is unreachable, and cannot be acted on.
 */
describe("the auto-lock delay", () => {
  it("takes a stored value when the stored value makes sense", () => {
    expect(() => applyStoredLockTimeout(900)).not.toThrow();
    expect(() => applyStoredLockTimeout(60)).not.toThrow();
    expect(() => applyStoredLockTimeout(86_400)).not.toThrow();
  });

  it.each([null, undefined, "900", NaN, Infinity, 0, -1, 5, 999_999])(
    "falls back rather than throwing on a stored %s",
    (stored) => {
      expect(() => applyStoredLockTimeout(stored)).not.toThrow();
    },
  );

  it("still rejects nonsense a person types into the setting", () => {
    expect(() => setLockTimeout(Number.NaN)).toThrow(/invalid/i);
  });
});
