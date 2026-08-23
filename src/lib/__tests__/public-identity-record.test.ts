import { describe, expect, it } from "vitest";
import {
  FOUNDER_STRUCTURED_DATA,
  OCADE_STRUCTURED_DATA,
  PUBLIC_IDENTITY,
  WEBSITE_STRUCTURED_DATA,
  organizationStructuredData,
} from "../public-identity";

describe("official CARCC CADANE and OCADE identity record", () => {
  it("keeps the current founder-authored public identity exact", () => {
    expect(PUBLIC_IDENTITY).toMatchObject({
      brand: "CARCC CADANE",
      brandAlternateName: "Carcc Cadane",
      tagline: "Command the Next Era.",
      product: "OCADE",
      productPronunciation: "OH-kayd",
      productMeaning: "Orbital-scale command and autonomous decision engine",
      founder: "Haans Antoni",
      founderAlternateName: "HAANS ANTONI",
      founderRoles: "CEO, Chairman and Founder",
      plannedFoundingDate: "2026-08-28",
    });
  });

  it("links the organization, founder and product as stable entities", () => {
    expect(organizationStructuredData(Date.parse("2026-08-28T00:00:00+05:30"))).toMatchObject({
      "@id": "https://ocade.in/#organization",
      foundingDate: "2026-08-28",
      founder: { "@id": "https://ocade.in/#haans-antoni" },
    });
    expect(organizationStructuredData(Date.parse("2026-08-27T23:59:59+05:30"))).not.toHaveProperty(
      "foundingDate",
    );
    expect(FOUNDER_STRUCTURED_DATA.mainEntity).toMatchObject({
      "@id": "https://ocade.in/#haans-antoni",
      worksFor: { "@id": "https://ocade.in/#organization" },
    });
    expect(OCADE_STRUCTURED_DATA).toMatchObject({
      "@id": "https://ocade.in/#ocade",
      creator: { "@id": "https://ocade.in/#haans-antoni" },
      author: { "@id": "https://ocade.in/#organization" },
    });
    expect(WEBSITE_STRUCTURED_DATA).toMatchObject({
      "@id": "https://ocade.in/#website",
      publisher: { "@id": "https://ocade.in/#organization" },
    });
  });
});
