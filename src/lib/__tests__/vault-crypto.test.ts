import { describe, expect, it } from "vitest";
import { formatRecoveryKit, generateRecoveryKey, parseRecoveryKit } from "../storage/vault-crypto";

describe("vault recovery kits", () => {
  it("round-trips every bit of a 256-bit recovery key", () => {
    const raw = Uint8Array.from({ length: 32 }, (_, index) => (index * 37 + 19) % 256);
    const kit = formatRecoveryKit(raw);

    expect(parseRecoveryKit(kit)).toEqual(raw);
    expect(kit.replace(/-/g, "")).toHaveLength(52);
  });

  it("round-trips freshly generated recovery keys", () => {
    const raw = generateRecoveryKey();
    expect(parseRecoveryKit(formatRecoveryKit(raw))).toEqual(raw);
  });

  it("rejects truncated, extended, or non-canonical recovery material", () => {
    const kit = formatRecoveryKit(new Uint8Array(32));
    expect(parseRecoveryKit(kit.slice(0, -1))).toBeNull();
    expect(parseRecoveryKit(`${kit}A`)).toBeNull();
    expect(parseRecoveryKit(`${kit.slice(0, -1)}B`)).toBeNull();
  });
});
