export const PUBLIC_IDENTITY = {
  brand: "CAERA CADANE",
  product: "OCADE",
  founder: "Haans Antoni",
  founderRoles: "Founder, Chairman & CEO",
  location: "Bengaluru, Karnataka, India",
  plannedLaunchDate: "28 August 2026",
  status: "pre-launch" as const,
};

export const ORGANIZATION_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: PUBLIC_IDENTITY.brand,
  description:
    "CAERA CADANE is the brand behind OCADE, a privacy-conscious, local-first AI workspace in development.",
  founder: {
    "@type": "Person",
    name: PUBLIC_IDENTITY.founder,
    jobTitle: PUBLIC_IDENTITY.founderRoles,
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
    name: PUBLIC_IDENTITY.founder,
    jobTitle: PUBLIC_IDENTITY.founderRoles,
    worksFor: { "@type": "Organization", name: PUBLIC_IDENTITY.brand },
  },
};

export const OCADE_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: PUBLIC_IDENTITY.product,
  applicationCategory: "ProductivityApplication",
  operatingSystem: "Web, Windows, macOS, Android, iOS",
  author: { "@type": "Organization", name: PUBLIC_IDENTITY.brand },
  description:
    "OCADE is a pre-launch, local-first AI workspace with optional private synchronization and cloud-assisted features.",
};
