import { describe, expect, it } from "vitest";
import { resolveSupabaseBrowserConfiguration } from "@/integrations/supabase/client";

describe("Supabase browser configuration", () => {
  it("reports every missing binding without constructing a client", () => {
    expect(resolveSupabaseBrowserConfiguration({})).toEqual({
      configured: false,
      url: undefined,
      publishableKey: undefined,
      missing: ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY"],
    });
  });

  it("accepts public client bindings without a service-role fallback", () => {
    expect(
      resolveSupabaseBrowserConfiguration({
        url: "https://example.supabase.co",
        publishableKey: "sb_publishable_example",
      }),
    ).toEqual({
      configured: true,
      url: "https://example.supabase.co",
      publishableKey: "sb_publishable_example",
      missing: [],
    });
  });
});
