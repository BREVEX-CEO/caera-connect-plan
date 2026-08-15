import { describe, expect, it } from "vitest";
import {
  FOUNDER_STRUCTURED_DATA,
  OCADE_STRUCTURED_DATA,
  ORGANIZATION_STRUCTURED_DATA,
  PUBLIC_IDENTITY,
} from "../public-identity";

describe("official CAERA CADANE and OCADE identity record", () => {
  it("keeps the founder-authored meanings and pronunciations exact", () => {
    expect(PUBLIC_IDENTITY).toMatchObject({
      brand: "CAERA CADANE",
      brandPronunciation: "KAY-rah kuh-DAYN",
      brandPronunciationSimple: "Kay-ra Ka-dane",
      brandMeaning: "Crown Era / Sovereign New Age; Command Domain / Capital Dynasty Network",
      tagline: "Command the Next Era.",
      product: "OCADE",
      productPronunciation: "OH-kayd",
      productMeaning: "Orbital-scale command and autonomous decision engine",
      founder: "Haans Antoni",
      founderRoles: "Founder, Chairman & CEO",
    });
  });

  it("links the organization, founder and product as stable entities", () => {
    expect(ORGANIZATION_STRUCTURED_DATA).toMatchObject({
      "@id": "https://ocade.in/#organization",
      founder: { "@id": "https://ocade.in/#haans-antoni" },
    });
    expect(FOUNDER_STRUCTURED_DATA.mainEntity).toMatchObject({
      "@id": "https://ocade.in/#haans-antoni",
      worksFor: { "@id": "https://ocade.in/#organization" },
    });
    expect(OCADE_STRUCTURED_DATA).toMatchObject({
      "@id": "https://ocade.in/#ocade",
      creator: { "@id": "https://ocade.in/#haans-antoni" },
      author: { "@id": "https://ocade.in/#organization" },
    });
  });
});
