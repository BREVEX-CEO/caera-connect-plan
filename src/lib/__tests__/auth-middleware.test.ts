import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Server-function auth middleware.
 *
 * This is the gate every authenticated server function passes through. The one
 * property that matters above all others: it must NEVER call `next()` unless a
 * structurally valid Bearer token produced verified claims with a subject. Any
 * path that reaches the handler without that is an authentication bypass.
 *
 * So every test below asserts BOTH that the rejection throws AND that `next`
 * was never invoked — a middleware that throws after already calling through
 * would still have run the protected code.
 *
 * The module is generated ("Do not edit it directly"), so it is pinned by tests
 * rather than modified.
 */

const getRequest = vi.fn();
const getClaims = vi.fn();

vi.mock("@tanstack/react-start/server", () => ({ getRequest: () => getRequest() }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({ auth: { getClaims: (t: string) => getClaims(t) } })),
}));

const { requireSupabaseAuth } = await import("@/integrations/supabase/auth-middleware");

type Handler = (args: { next: (arg?: unknown) => unknown }) => Promise<unknown>;
const handler = (requireSupabaseAuth as unknown as { options: { server: Handler } }).options.server;

const VALID_JWT = "header.payload.signature";

function requestWith(headers: Record<string, string> | null) {
  if (headers === null) return {};
  return { headers: new Headers(headers) };
}

let next: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  next = vi.fn((arg?: unknown) => ({ passed: true, arg }));
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_testkey";
  getRequest.mockReturnValue(requestWith({ authorization: `Bearer ${VALID_JWT}` }));
  getClaims.mockResolvedValue({ data: { claims: { sub: "user-123", role: "authenticated" } } });
});

/** Run the middleware and assert it refused without ever calling through. */
async function expectRejection(pattern: RegExp) {
  await expect(handler({ next })).rejects.toThrow(pattern);
  expect(next, "next() must not run when authentication fails").not.toHaveBeenCalled();
}

describe("environment configuration fails closed", () => {
  it("refuses when SUPABASE_URL is missing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.SUPABASE_URL;
    await expectRejection(/Missing Supabase environment variable/);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("SUPABASE_URL"));
    error.mockRestore();
  });

  it("refuses when the publishable key is missing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    await expectRejection(/Missing Supabase environment variable/);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("SUPABASE_PUBLISHABLE_KEY"));
    error.mockRestore();
  });

  it("names every missing variable so the operator can fix it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;
    await expect(handler({ next })).rejects.toThrow(/SUPABASE_URL.*SUPABASE_PUBLISHABLE_KEY/);
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/SUPABASE_URL.*SUPABASE_PUBLISHABLE_KEY/),
    );
    error.mockRestore();
  });
});

describe("the authorization header is required", () => {
  it("refuses a request with no headers at all", async () => {
    getRequest.mockReturnValue(requestWith(null));
    await expectRejection(/Unauthorized/);
  });

  it("refuses when getRequest returns nothing", async () => {
    getRequest.mockReturnValue(undefined);
    await expectRejection(/Unauthorized/);
  });

  it("refuses a request with no authorization header", async () => {
    getRequest.mockReturnValue(requestWith({}));
    await expectRejection(/No authorization header/);
  });
});

describe("only Bearer tokens are accepted", () => {
  it("refuses HTTP Basic credentials", async () => {
    getRequest.mockReturnValue(requestWith({ authorization: "Basic dXNlcjpwYXNz" }));
    await expectRejection(/Only Bearer tokens/);
  });

  it("refuses a bare token with no scheme", async () => {
    getRequest.mockReturnValue(requestWith({ authorization: VALID_JWT }));
    await expectRejection(/Only Bearer tokens/);
  });

  it("is case-sensitive about the Bearer scheme", async () => {
    getRequest.mockReturnValue(requestWith({ authorization: `bearer ${VALID_JWT}` }));
    await expectRejection(/Only Bearer tokens/);
  });

  it("refuses an empty Bearer token", async () => {
    getRequest.mockReturnValue(requestWith({ authorization: "Bearer " }));
    await expectRejection(/Unauthorized/);
  });
});

describe("the token must be structurally a JWT", () => {
  for (const [label, token] of [
    ["an opaque string", "not-a-jwt"],
    ["only two segments", "header.payload"],
    ["four segments", "a.b.c.d"],
    ["just dots", ".."],
  ] as const) {
    it(`refuses ${label}`, async () => {
      getRequest.mockReturnValue(requestWith({ authorization: `Bearer ${token}` }));
      if (token === "..") {
        // Three empty segments still reach verification, which must reject it.
        getClaims.mockResolvedValue({ error: new Error("bad"), data: null });
      }
      await expectRejection(/Unauthorized/);
    });
  }

  it("never asks Supabase to verify a malformed token", async () => {
    getRequest.mockReturnValue(requestWith({ authorization: "Bearer not-a-jwt" }));
    await expect(handler({ next })).rejects.toThrow();
    expect(getClaims).not.toHaveBeenCalled();
  });
});

describe("claims must verify", () => {
  it("refuses when verification returns an error", async () => {
    getClaims.mockResolvedValue({ error: new Error("signature mismatch"), data: null });
    await expectRejection(/Invalid token/);
  });

  it("refuses when verification returns no claims", async () => {
    getClaims.mockResolvedValue({ data: { claims: null } });
    await expectRejection(/Invalid token/);
  });

  it("refuses claims that carry no subject", async () => {
    getClaims.mockResolvedValue({ data: { claims: { role: "authenticated" } } });
    await expectRejection(/No user ID/);
  });

  it("does not leak the token or the verification error to the caller", async () => {
    getClaims.mockResolvedValue({ error: new Error("secret internal detail"), data: null });
    await expect(handler({ next })).rejects.toThrow(/^Unauthorized: Invalid token$/);
  });

  it("verifies the token that was actually presented", async () => {
    await handler({ next });
    expect(getClaims).toHaveBeenCalledWith(VALID_JWT);
  });
});

describe("a valid token passes through", () => {
  it("calls next exactly once", async () => {
    await handler({ next });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("puts the verified subject on the context as userId", async () => {
    await handler({ next });
    const context = (next.mock.calls[0][0] as { context: Record<string, unknown> }).context;
    expect(context.userId).toBe("user-123");
  });

  it("takes the user id from the VERIFIED claims, never from the raw request", async () => {
    // A caller cannot smuggle a different identity: the id comes from claims.sub.
    getClaims.mockResolvedValue({ data: { claims: { sub: "real-user" } } });
    getRequest.mockReturnValue(
      requestWith({ authorization: `Bearer ${VALID_JWT}`, "x-user-id": "attacker" }),
    );
    await handler({ next });
    const context = (next.mock.calls[0][0] as { context: Record<string, unknown> }).context;
    expect(context.userId).toBe("real-user");
  });

  it("exposes a scoped supabase client and the claims on the context", async () => {
    await handler({ next });
    const context = (next.mock.calls[0][0] as { context: Record<string, unknown> }).context;
    expect(context.supabase).toBeTruthy();
    expect(context.claims).toMatchObject({ sub: "user-123" });
  });
});
