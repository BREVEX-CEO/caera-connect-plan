import { describe, expect, it, vi } from "vitest";
import {
  ASSUME_AVAILABLE,
  fetchAuthProviderAvailability,
  readAuthProviderAvailability,
} from "@/lib/auth/provider-availability";

/**
 * THE PROJECT SAYS WHAT THE PROJECT OFFERS.
 *
 * These replace three tests over three build flags. The flags defaulted to
 * `false` in production and nothing kept them in step with the live project,
 * so a correct build could hide a working provider — the live project has
 * Google configured, and a production build with the variable unset offered no
 * Google button — and a stale one could advertise a provider that had since
 * been turned off.
 */
const CONFIGURED = {
  url: "https://project.supabase.co",
  publishableKey: "sb_publishable_test",
  configured: true,
};

describe("what the project reports it offers", () => {
  it("reads each provider from GoTrue's own settings", () => {
    expect(
      readAuthProviderAvailability({ external: { google: true, email: true, phone: false } }),
    ).toEqual({ google: true, emailDelivery: true, phone: false });
  });

  it("offers a provider GoTrue does not report rather than hiding it", () => {
    // An older GoTrue that omits a key has not turned that provider off, and
    // treating silence as "off" would remove a way in that works.
    expect(readAuthProviderAvailability({ external: { google: true } })).toEqual(ASSUME_AVAILABLE);
  });

  it("offers everything when the answer is not a settings document at all", () => {
    expect(readAuthProviderAvailability(null)).toEqual(ASSUME_AVAILABLE);
    expect(readAuthProviderAvailability({})).toEqual(ASSUME_AVAILABLE);
  });
});

describe("asking the project", () => {
  it("sends the publishable key to the project's settings endpoint", async () => {
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ external: { google: true, email: true, phone: false } }),
    );

    expect(await fetchAuthProviderAvailability(CONFIGURED, fetcher)).toEqual({
      google: true,
      emailDelivery: true,
      phone: false,
    });
    const [url, init] = fetcher.mock.calls[0];
    expect(String(url)).toBe("https://project.supabase.co/auth/v1/settings");
    expect(new Headers(init?.headers).get("apikey")).toBe("sb_publishable_test");
  });

  /*
   * A sign-in screen that cannot be used is worse than one that offers a
   * method the project refuses out loud, so every unknown resolves to offering
   * everything. Pressing an unavailable method costs a sanitized refusal and a
   * second; hiding every method costs the account.
   */
  it("offers everything when the project cannot be reached", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new Error("network down");
    });
    expect(await fetchAuthProviderAvailability(CONFIGURED, fetcher)).toEqual(ASSUME_AVAILABLE);
  });

  it("offers everything when the project answers with an error status", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(null, { status: 503 }));
    expect(await fetchAuthProviderAvailability(CONFIGURED, fetcher)).toEqual(ASSUME_AVAILABLE);
  });

  it("does not call out at all when the deployment has no project", async () => {
    const fetcher = vi.fn<typeof fetch>();
    expect(await fetchAuthProviderAvailability({ configured: false }, fetcher)).toEqual(
      ASSUME_AVAILABLE,
    );
    expect(fetcher).not.toHaveBeenCalled();
  });
});
