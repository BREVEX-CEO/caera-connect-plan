export const PUBLIC_IDENTITY = {
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
  location: "Bengaluru, Karnataka, India",
  plannedLaunchDate: "28 August 2026",
  status: "pre-launch" as const,
};

export const ORGANIZATION_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://ocade.in/#organization",
  name: PUBLIC_IDENTITY.brand,
  alternateName: ["Caera Cadane", PUBLIC_IDENTITY.tagline],
  url: "https://ocade.in/company",
  slogan: PUBLIC_IDENTITY.tagline,
  description: `CAERA CADANE is the pre-launch venture created by Haans Antoni and the brand behind OCADE. The founder defines the name as ${PUBLIC_IDENTITY.brandMeaning}.`,
  founder: {
    "@type": "Person",
    "@id": "https://ocade.in/#haans-antoni",
    name: PUBLIC_IDENTITY.founder,
    jobTitle: PUBLIC_IDENTITY.founderRoles,
    url: "https://ocade.in/founder/haans-antoni",
  },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Bengaluru",
    addressRegion: "Karnataka",
    addressCountry: "IN",
  },
};

export const FOUNDER_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "ProfilePage",
  mainEntity: {
    "@type": "Person",
    "@id": "https://ocade.in/#haans-antoni",
    name: PUBLIC_IDENTITY.founder,
    jobTitle: PUBLIC_IDENTITY.founderRoles,
    url: "https://ocade.in/founder/haans-antoni",
    worksFor: {
      "@type": "Organization",
      "@id": "https://ocade.in/#organization",
      name: PUBLIC_IDENTITY.brand,
    },
  },
};

export const OCADE_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://ocade.in/#ocade",
  name: PUBLIC_IDENTITY.product,
  alternateName: "Ocade",
  url: "https://ocade.in/products/ocade",
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
  },
  description: `OCADE, defined by its creator as ${PUBLIC_IDENTITY.productMeaning}, is a pre-launch workspace whose intelligence runs on your own device, with optional private synchronization.`,
};
