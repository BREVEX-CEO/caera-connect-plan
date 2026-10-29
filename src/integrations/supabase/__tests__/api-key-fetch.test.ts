import { afterEach, describe, expect, it, vi } from "vitest";
import { createSupabaseFetch } from "../configuration";

afterEach(() => vi.unstubAllGlobals());

function capture() {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", request);
  return request;
}

describe("the shared Supabase API-key fetch boundary", () => {
  it.each(["sb_publishable_test_fixture", "sb_secret_test_fixture"])(
    "sends opaque %s only as an API key",
    async (key) => {
      const request = capture();
      await createSupabaseFetch(key)("https://project.invalid/rest/v1/items", {
        headers: { Authorization: `Bearer ${key}` },
      });
      const headers = new Headers(request.mock.calls[0]![1]!.headers);
      expect(headers.get("apikey")).toBe(key);
      expect(headers.has("authorization")).toBe(false);
    },
  );

  it.each(["sb_publishable_test_fixture", "sb_secret_test_fixture"])(
    "preserves the caller's distinct session JWT with %s",
    async (key) => {
      const request = capture();
      await createSupabaseFetch(key)("https://project.invalid/rest/v1/items", {
        headers: { Authorization: "Bearer user.session.jwt" },
      });
      const headers = new Headers(request.mock.calls[0]![1]!.headers);
      expect(headers.get("authorization")).toBe("Bearer user.session.jwt");
      expect(headers.get("apikey")).toBe(key);
    },
  );

  it("preserves legacy JWT-key authorization", async () => {
    const request = capture();
    await createSupabaseFetch("legacy.api.jwt")("https://project.invalid/rest/v1/items", {
      headers: { Authorization: "Bearer legacy.api.jwt" },
    });
    const headers = new Headers(request.mock.calls[0]![1]!.headers);
    expect(headers.get("authorization")).toBe("Bearer legacy.api.jwt");
    expect(headers.get("apikey")).toBe("legacy.api.jwt");
  });

  it("merges Request and init headers without mutating either input", async () => {
    const request = capture();
    const input = new Request("https://project.invalid/rest/v1/items", {
      headers: { Authorization: "Bearer old.session.jwt", "x-kept": "request", "x-choice": "old" },
    });
    const overrides = new Headers({
      Authorization: "Bearer current.session.jwt",
      "x-choice": "new",
      apikey: "untrusted-override",
    });
    await createSupabaseFetch("sb_publishable_test_fixture")(input, { headers: overrides });
    const headers = new Headers(request.mock.calls[0]![1]!.headers);
    expect(headers.get("authorization")).toBe("Bearer current.session.jwt");
    expect(headers.get("x-kept")).toBe("request");
    expect(headers.get("x-choice")).toBe("new");
    expect(headers.get("apikey")).toBe("sb_publishable_test_fixture");
    expect(input.headers.get("authorization")).toBe("Bearer old.session.jwt");
    expect(overrides.get("apikey")).toBe("untrusted-override");
  });

  it("removes an opaque bearer inherited from Request headers", async () => {
    const request = capture();
    const key = "sb_publishable_test_fixture";
    const input = new Request("https://project.invalid/rest/v1/items", {
      headers: { Authorization: `Bearer ${key}` },
    });
    await createSupabaseFetch(key)(input);
    expect(new Headers(request.mock.calls[0]![1]!.headers).has("authorization")).toBe(false);
    expect(input.headers.get("authorization")).toBe(`Bearer ${key}`);
  });

  it("preserves cancellation, method, body and response identity", async () => {
    const response = new Response("kept");
    const request = vi.fn<typeof fetch>().mockResolvedValue(response);
    vi.stubGlobal("fetch", request);
    const controller = new AbortController();
    const input = "https://project.invalid/rest/v1/items";
    const result = await createSupabaseFetch("sb_publishable_test_fixture")(input, {
      method: "POST",
      body: "payload",
      credentials: "omit",
      signal: controller.signal,
    });
    expect(request.mock.calls[0]![0]).toBe(input);
    expect(request.mock.calls[0]![1]).toMatchObject({
      method: "POST",
      body: "payload",
      credentials: "omit",
      signal: controller.signal,
    });
    expect(result).toBe(response);
  });

  it("propagates transport refusal without retrying or changing authority", async () => {
    const error = new Error("transport refused");
    const request = vi.fn<typeof fetch>().mockRejectedValue(error);
    vi.stubGlobal("fetch", request);
    await expect(
      createSupabaseFetch("sb_publishable_test_fixture")("https://project.invalid/rest/v1/items"),
    ).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("adds no bearer credential when the caller supplied none", async () => {
    const request = capture();
    await createSupabaseFetch("sb_publishable_test_fixture")("https://project.invalid/rest/v1/items");
    const headers = new Headers(request.mock.calls[0]![1]!.headers);
    expect(headers.get("apikey")).toBe("sb_publishable_test_fixture");
    expect(headers.has("authorization")).toBe(false);
  });
});
