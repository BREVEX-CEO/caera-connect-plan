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

export function organizationStructuredData(now: number = Date.now()) {
  const founded = now >= Date.parse(`${PUBLIC_IDENTITY.plannedFoundingDate}T00:00:00+05:30`);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://ocade.in/#organization",
    name: PUBLIC_IDENTITY.brand,
    alternateName: [PUBLIC_IDENTITY.brandAlternateName, PUBLIC_IDENTITY.tagline],
    url: "https://ocade.in/about",
    logo: "https://ocade.in/brand/ocade-carcc-mark.png",
    image: "https://ocade.in/brand/ocade-carcc-wordmark.png",
    slogan: PUBLIC_IDENTITY.tagline,
    ...(founded ? { foundingDate: PUBLIC_IDENTITY.plannedFoundingDate } : {}),
    description:
      "CARCC CADANE is the independent technology enterprise, business brand and venture behind OCADE.",
    founder: {
      "@type": "Person",
      "@id": "https://ocade.in/#haans-antoni",
      name: PUBLIC_IDENTITY.founder,
      alternateName: PUBLIC_IDENTITY.founderAlternateName,
      jobTitle: PUBLIC_IDENTITY.founderRoles,
      url: "https://ocade.in/about",
    },
  };
}

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

export const WEBSITE_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://ocade.in/#website",
  name: `${PUBLIC_IDENTITY.brand} — ${PUBLIC_IDENTITY.product}`,
  alternateName: `${PUBLIC_IDENTITY.product} by ${PUBLIC_IDENTITY.brand}`,
  url: "https://ocade.in/",
  publisher: {
    "@type": "Organization",
    "@id": "https://ocade.in/#organization",
    name: PUBLIC_IDENTITY.brand,
  },
};

export const OCADE_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://ocade.in/#ocade",
  name: PUBLIC_IDENTITY.product,
  alternateName: "Ocade",
  url: "https://ocade.in/",
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web, Windows, macOS, Android, iOS",
  author: {
    "@type": "Organization",
    "@id": "https://ocade.in/#organization",
    name: PUBLIC_IDENTITY.brand,
  },
  creator: {
    "@type": "Person",
    "@id": "https://ocade.in/#haans-antoni",
    name: PUBLIC_IDENTITY.founder,
    alternateName: PUBLIC_IDENTITY.founderAlternateName,
  },
  description: `OCADE, defined by its creator as ${PUBLIC_IDENTITY.productMeaning}, is a local-first AI workspace whose formal public-launch date is ${PUBLIC_IDENTITY.plannedLaunchDate}, with optional private synchronization and permissioned current-information retrieval.`,
};
