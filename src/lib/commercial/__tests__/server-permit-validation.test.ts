import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => {
  return { supabaseAdmin: { rpc: mocks.rpc } };
});

import { assertActiveGenerationPermit } from "../usage.functions";

const permit = {
  userId: "account-1",
  permitId: "11111111-1111-4111-8111-111111111111",
  generationId: "generation-1",
  idempotencyKey: "request-1",
  surface: "cowork" as const,
  source: "server" as const,
};

describe("server-side intelligence transport permit validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("atomically claims every identity for one live reserved transport", async () => {
    mocks.rpc.mockResolvedValue({ data: true, error: null });

    await expect(assertActiveGenerationPermit(permit)).resolves.toBeUndefined();

    expect(mocks.rpc).toHaveBeenCalledWith("ocade_claim_generation_transport", {
      p_user_id: permit.userId,
      p_permit_id: permit.permitId,
      p_generation_id: permit.generationId,
      p_idempotency_key: permit.idempotencyKey,
      p_surface: "cowork",
    });
  });

  it("rejects a missing, expired, settled, replayed, or cross-account permit", async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(assertActiveGenerationPermit(permit)).rejects.toThrow(
      /missing|expired|settled|already claimed/i,
    );
  });

  it("fails closed when the atomic claim RPC errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "database unavailable" } });
    await expect(assertActiveGenerationPermit(permit)).rejects.toThrow(/missing|expired|settled/i);
  });

  it("never lets a client present an offline block as server transport authority", async () => {
    await expect(
      assertActiveGenerationPermit({ ...permit, source: "offline_lease" }),
    ).rejects.toThrow(/offline permits cannot authorize/i);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
