import { describe, expect, it } from "vitest";
import { cloudflareProviderRequest } from "../../../../supabase/functions/_shared/gateway";

const config = () => ({
  accountId: "a".repeat(32),
  gatewayId: "ocade-qualification",
  token: "fixture-token",
  key: "fixture-key",
  model: "gemma-4-26b-a4b-it",
  body: { contents: [] },
  signal: new AbortController().signal,
});

describe("credential confinement at the Cloudflare gateway", () => {
  it("uses authenticated native streaming, no cache/log payloads, one upstream attempt and no redirects", async () => {
    const request = cloudflareProviderRequest(config())!;
    const url = new URL(request.url);
    expect(url.origin).toBe("https://gateway.ai.cloudflare.com");
    expect(url.pathname).toBe(
      `/v1/${"a".repeat(32)}/ocade-qualification/google-ai-studio/v1beta/models/gemma-4-26b-a4b-it:streamGenerateContent`,
    );
    expect(url.search).toBe("?alt=sse");
    expect(request.redirect).toBe("error");
    expect(request.headers.get("x-goog-api-key")).toBe("fixture-key");
    expect(request.headers.get("cf-aig-authorization")).toBe("Bearer fixture-token");
    expect(request.headers.get("cf-aig-max-attempts")).toBe("1");
    expect(request.headers.get("cf-aig-skip-cache")).toBe("true");
    expect(request.headers.get("cf-aig-collect-log")).toBe("false");
    expect(request.headers.get("cf-aig-collect-log-payload")).toBe("false");
    expect(await request.json()).toEqual({ contents: [] });
    expect(request.url).not.toMatch(/fixture-key|fixture-token/);
  });
  it.each([
    { accountId: "" },
    { accountId: "https://attacker.example" },
    { gatewayId: "../escape" },
    { gatewayId: "a".repeat(65) },
    { token: "" },
    { token: "bad\r\nheader" },
    { token: "bad\u0000header" },
    { key: "bad\u007fkey" },
    { token: "non-ascii-🔑" },
    { key: "" },
    { key: "bad key" },
    { model: "latest" },
    { gatewayId: "ocade?key=stolen" },
  ])("refuses incomplete/hostile config before any network request: %j", (patch) => {
    expect(cloudflareProviderRequest({ ...config(), ...patch })).toBeNull();
  });
  it("propagates STOP to the upstream request", () => {
    const controller = new AbortController();
    const request = cloudflareProviderRequest({ ...config(), signal: controller.signal })!;
    controller.abort();
    expect(request.signal.aborted).toBe(true);
  });
});
