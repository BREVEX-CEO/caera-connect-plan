import { describe, expect, it } from "vitest";
import { resolveAuthProviderAvailability } from "@/lib/auth/provider-availability";

describe("production authentication provider availability", () => {
  it("fails closed when production credentials and delivery are not attested", () => {
    expect(resolveAuthProviderAvailability({ MODE: "production", PROD: true })).toEqual({
      google: false,
      phone: false,
      emailDelivery: false,
    });
  });

  it("only opens providers whose matching public readiness flag is exact", () => {
    expect(
      resolveAuthProviderAvailability({
        MODE: "production",
        PROD: true,
        VITE_AUTH_GOOGLE_ENABLED: "true",
        VITE_AUTH_PHONE_ENABLED: "yes",
        VITE_AUTH_EMAIL_DELIVERY_READY: true,
      }),
    ).toEqual({ google: true, phone: false, emailDelivery: true });
  });

  it("keeps provider forms reachable in local development and tests", () => {
    expect(resolveAuthProviderAvailability({ MODE: "test", PROD: false })).toEqual({
      google: true,
      phone: true,
      emailDelivery: true,
    });
  });
});
