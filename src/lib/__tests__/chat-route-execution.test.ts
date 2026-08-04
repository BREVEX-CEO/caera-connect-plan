/**
 * REAL execution test for the chat route — the first one in this repository.
 *
 * Every existing test that mentions `routes/api/ocade.chat.ts` opens it with
 * `readFileSync` and asserts on its TEXT. `release/OCADE_TEST_KINDS.json`
 * declares one of them structural-only and calls it "the weakest remaining
 * case". A source-text assertion cannot tell you the handler runs, that it
 * returns the status it appears to return, or that the auth gate is reached
 * before anything else — it only tells you the characters are still on disk.
 *
 * This test imports the real route module, takes the real POST handler, hands
 * it a real `Request`, and asserts on the real `Response`. Nothing is mocked
 * and nothing is stubbed.
 *
 * WHAT IT COVERS, AND WHAT IT DELIBERATELY DOES NOT
 * -------------------------------------------------
 * It covers the authentication and configuration gate: the code that runs
 * BEFORE the handler needs Supabase, a provider key or a network. That gate is
 * the route's security boundary, and until now it had zero execution coverage.
 *
 * It does NOT cover a successful chat turn. Reaching the body-parsing,
 * ownership, allowance and streaming paths requires `supabase.auth.getUser` to
 * return a real user, which needs real credentials and a real network round
 * trip. Faking that would mean mocking the Supabase client, at which point the
 * test proves the mock behaves as written rather than that the route does —
 * exactly the substitution this file exists to stop. Those paths stay
 * uncovered and honestly reported rather than covered by pretence.
 */
import { afterEach, describe, expect, it } from "vitest";
import { Route } from "../../routes/api/ocade.chat";

/**
 * The real POST handler, as the server would invoke it.
 *
 * Routed through `unknown` because TanStack's `RouteOptions` is a deeply
 * generic type that does not structurally overlap with the narrow shape this
 * test needs, so a direct cast is rejected. The narrowing is asserted rather
 * than assumed: the test below fails loudly if `handler` is not callable or
 * does not return a `Response`.
 */
type ChatPostHandler = (ctx: { request: Request }) => Promise<Response>;
const handler = (Route.options as unknown as { server: { handlers: { POST: ChatPostHandler } } })
  .server.handlers.POST;

const url = "http://localhost/api/ocade/chat";

function post(init: { headers?: Record<string, string>; body?: string } = {}): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    body: init.body ?? JSON.stringify({ conversationId: "c1", message: { content: "hello" } }),
  });
}

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe("the chat route executes and refuses unauthenticated callers", () => {
  it("exposes a callable POST handler on the real route module", () => {
    // Guards the cast above. If the route's shape changes and `handler` ends up
    // undefined, every other test here would fail with an opaque "not a
    // function" error; this one names the actual problem.
    expect(typeof handler).toBe("function");
  });

  it("refuses a request with no Authorization header", async () => {
    const response = await handler({ request: post() });

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("Unauthorized");
  });

  it("refuses an Authorization header that is not a bearer token", async () => {
    // A real caller sending Basic auth, or a bare token without the scheme,
    // must be refused rather than have the value used as a bearer.
    for (const header of ["Basic dXNlcjpwYXNz", "some-raw-token", "Bearer", "bearer "]) {
      const response = await handler({ request: post({ headers: { authorization: header } }) });
      expect(response.status, `header: ${header}`).toBe(401);
    }
  });

  it("accepts the bearer scheme case-insensitively before rejecting on configuration", async () => {
    // Proves the token is genuinely parsed rather than the 401 arriving for an
    // unrelated reason: with a token present the handler moves PAST the auth
    // check and fails on configuration instead, which is a different branch.
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_PUBLISHABLE_KEY;

    for (const scheme of ["Bearer", "bearer", "BEARER"]) {
      const response = await handler({
        request: post({ headers: { authorization: `${scheme} a-token` } }),
      });
      expect(response.status, `scheme: ${scheme}`).toBe(500);
      await expect(response.text()).resolves.toBe("Backend misconfigured");
    }
  });

  it("refuses before reading the request body at all", async () => {
    // The auth gate must run first. A body that would throw on parse still
    // produces 401, proving nothing downstream was reached — an unauthenticated
    // caller never gets to influence parsing.
    const response = await handler({ request: post({ body: "{ this is not json" }) });

    expect(response.status).toBe(401);
    await expect(response.text()).resolves.toBe("Unauthorized");
  });

  it("returns a real Response object, not a thrown error or undefined", async () => {
    const response = await handler({ request: post() });

    expect(response).toBeInstanceOf(Response);
    expect(typeof response.status).toBe("number");
  });
});
