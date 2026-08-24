import { describe, expect, it } from "vitest";

import { oauthTransportForHostname } from "@/integrations/lovable";

describe("OAuth transport selection", () => {
  it.each(["127.0.0.1", "localhost", "ocade.in", "www.ocade.in"])(
    "uses the production Supabase provider on %s",
    (hostname) => {
      expect(oauthTransportForHostname(hostname, "google")).toBe("supabase");
      expect(oauthTransportForHostname(hostname, "apple")).toBe("supabase");
    },
  );

  it.each(["id-preview--project.lovable.app", "project.lovableproject.com", "lovable.dev"])(
    "retains the Lovable preview broker on %s",
    (hostname) => {
      expect(oauthTransportForHostname(hostname, "google")).toBe("lovable");
    },
  );

  it("never sends broker-only providers to Supabase", () => {
    expect(oauthTransportForHostname("ocade.in", "microsoft")).toBe("lovable");
    expect(oauthTransportForHostname("localhost", "lovable")).toBe("lovable");
  });
});
