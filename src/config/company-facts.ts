/**
 * Canonical current company and product facts.
 *
 * Public UI, SEO, legal copy, and release tests must derive their identity
 * claims from this authority. Historical evidence and compatibility
 * identifiers are deliberately outside its scope.
 */
export const COMPANY_FACTS = {
  companyName: "CARCC CADANE",
  companyAlternateName: "Carcc Cadane",
  productName: "OCADE",
  productFormalName: "OCADE BY CARCC CADANE",
  tagline: "Command the Next Era.",
  founderName: "Haans Antoni",
  founderDisplayName: "HAANS ANTONI",
  founderLeadershipStatement: "HAANS ANTONI — CEO, Chairman and Founder",
  founderRoles: "CEO, Chairman and Founder",
  foundingDateIso: "2026-08-28",
  foundingDateLabel: "28 August 2026",
  launchAtIso: "2026-08-27T22:58:00Z",
  location: "Bengaluru, Karnataka, India",
  status: "launched",
  /**
   * The one origin OCADE is canonically reached at.
   *
   * Derived from the request until now, in three places that all serve
   * crawlers: the sitemap on `www.ocade.in` advertised `www` URLs for pages
   * whose sessions, storage and model live on the apex, so a crawler could be
   * sent to a second origin of the same product. The Worker redirects `www`
   * here, and these two agree with it by construction.
   */
  siteOrigin: "https://ocade.in",
} as const;
