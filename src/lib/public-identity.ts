import { COMPANY_FACTS } from "@/config/company-facts";

export const PUBLIC_IDENTITY = {
  brand: COMPANY_FACTS.companyName,
  brandAlternateName: COMPANY_FACTS.companyAlternateName,
  tagline: COMPANY_FACTS.tagline,
  product: COMPANY_FACTS.productName,
  productPronunciation: "OH-kayd",
  productMeaning: "Orbital-scale command and autonomous decision engine",
  founder: COMPANY_FACTS.founderName,
  founderAlternateName: COMPANY_FACTS.founderDisplayName,
  founderRoles: COMPANY_FACTS.founderRoles,
  plannedFoundingDate: COMPANY_FACTS.foundingDateIso,
  plannedLaunchDate: COMPANY_FACTS.foundingDateLabel,
  status: COMPANY_FACTS.status,
};

export const FOUNDER_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  mainEntity: {
    "@type": "Person",
    "@id": "https://ocade.in/#haans-antoni",
    name: PUBLIC_IDENTITY.founder,
    alternateName: PUBLIC_IDENTITY.founderAlternateName,
    jobTitle: PUBLIC_IDENTITY.founderRoles,
    url: "https://ocade.in/about",
    worksFor: {
      "@type": "Organization",
      "@id": "https://ocade.in/#organization",
      name: PUBLIC_IDENTITY.brand,
    },
  },
};
