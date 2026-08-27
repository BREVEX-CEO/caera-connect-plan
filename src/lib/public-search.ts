export type PublicSearchCategory = "Company" | "Product" | "Help" | "Legal";

export type PublicSearchHref =
  | "/company"
  | "/founder/haans-antoni"
  | "/products/ocade"
  | "/pricing"
  | "/blog"
  | "/careers"
  | "/compare"
  | "/team"
  | "/press"
  | "/status"
  | "/faq"
  | "/privacy"
  | "/terms"
  | "/settings/support";

export interface PublicSearchEntry {
  id: string;
  title: string;
  summary: string;
  category: PublicSearchCategory;
  href: PublicSearchHref;
  keywords: readonly string[];
  priority?: number;
}

export const PUBLIC_SEARCH_INDEX: readonly PublicSearchEntry[] = [
  {
    id: "company",
    title: "CARCC CADANE company information",
    summary:
      "Verified pre-launch facts about the Bengaluru venture behind OCADE, its current legal status and planned launch.",
    category: "Company",
    href: "/company",
    keywords: ["company", "brand", "Bengaluru", "launch", "incorporation"],
  },
  {
    id: "founder",
    title: "Haans Antoni — founder profile",
    summary:
      "The official founder record for HAANS ANTONI, CEO, Chairman and Founder of the CARCC CADANE venture.",
    category: "Company",
    href: "/founder/haans-antoni",
    keywords: ["founder", "leadership", "CEO", "chairman", "Haans Antoni"],
  },
  {
    id: "ocade",
    title: "OCADE product overview",
    summary:
      "How OCADE combines local inference, optional private synchronization and permissioned computer work.",
    category: "Product",
    href: "/products/ocade",
    keywords: ["OCADE", "local AI", "private", "offline", "computer control"],
    priority: 3,
  },
  {
    id: "pricing",
    title: "OCADE pricing",
    summary:
      "Founder-approved reference prices and planned payment methods. Checkout remains locked during free launch.",
    category: "Product",
    href: "/pricing",
    keywords: ["price", "pricing", "plans", "free launch", "payment"],
  },
  {
    id: "blog",
    title: "OCADE journal",
    summary:
      "Original product and engineering notes about local intelligence, Cowork, privacy and safety.",
    category: "Company",
    href: "/blog",
    keywords: ["blog", "journal", "engineering", "product", "articles"],
  },
  {
    id: "careers",
    title: "Careers at CARCC CADANE",
    summary:
      "Current pre-launch workstreams, location and an honest statement of hiring and benefits status.",
    category: "Company",
    href: "/careers",
    keywords: ["careers", "jobs", "roles", "Bengaluru", "benefits"],
  },
  {
    id: "compare",
    title: "Compare OCADE",
    summary:
      "A factual category comparison of OCADE, typical cloud AI workspaces and standalone local runners.",
    category: "Product",
    href: "/compare",
    keywords: ["compare", "features", "differences", "local", "cloud"],
  },
  {
    id: "team",
    title: "CARCC CADANE team",
    summary: "The current non-fictional team record and work areas behind OCADE.",
    category: "Company",
    href: "/team",
    keywords: ["team", "people", "founder", "work"],
  },
  {
    id: "press",
    title: "CARCC CADANE press kit",
    summary: "Official company facts, OCADE brand assets, key statistics and press-release status.",
    category: "Company",
    href: "/press",
    keywords: ["press", "media", "brand assets", "logo", "statistics"],
  },
  {
    id: "status",
    title: "OCADE status",
    summary: "Current-browser health observations and known pre-launch service dependencies.",
    category: "Help",
    href: "/status",
    keywords: ["status", "health", "incident", "uptime", "maintenance"],
  },
  {
    id: "faq",
    title: "Frequently asked questions",
    summary:
      "Answers about sign-in, device sync, billing, privacy, browser control and deleting account data.",
    category: "Help",
    href: "/faq",
    keywords: ["help", "account", "sync", "billing", "privacy", "delete"],
  },
  {
    id: "support",
    title: "Contact support",
    summary:
      "Open the support form. It reports whether the service accepted a request instead of promising unverified delivery.",
    category: "Help",
    href: "/settings/support",
    keywords: ["support", "contact", "problem", "request", "help"],
  },
  {
    id: "privacy",
    title: "Privacy Notice",
    summary:
      "Read the current pre-launch privacy notice, data modes, device permissions and data-rights process.",
    category: "Legal",
    href: "/privacy",
    keywords: ["privacy", "data", "permissions", "device only", "private sync"],
  },
  {
    id: "terms",
    title: "Terms of Service",
    summary: "Read the current pre-launch terms, free-launch boundary and product-use conditions.",
    category: "Legal",
    href: "/terms",
    keywords: ["terms", "legal", "conditions", "free launch"],
  },
] as const;

export type PublicSearchSort = "relevance" | "title";

export function searchPublicPages(
  query: string,
  category: PublicSearchCategory | "All",
  sort: PublicSearchSort,
): PublicSearchEntry[] {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);

  const scored = PUBLIC_SEARCH_INDEX.filter(
    (entry) => category === "All" || entry.category === category,
  )
    .map((entry) => {
      const title = entry.title.toLocaleLowerCase();
      const haystack =
        `${entry.title} ${entry.summary} ${entry.keywords.join(" ")}`.toLocaleLowerCase();
      if (terms.some((term) => !haystack.includes(term))) return null;
      const score =
        (entry.priority ?? 0) +
        terms.reduce(
          (total, term) =>
            total + (title.includes(term) ? 4 : 0) + countOccurrences(haystack, term),
          0,
        );
      return { entry, score };
    })
    .filter((value): value is { entry: PublicSearchEntry; score: number } => value !== null);

  scored.sort((a, b) =>
    sort === "title"
      ? a.entry.title.localeCompare(b.entry.title)
      : b.score - a.score || a.entry.title.localeCompare(b.entry.title),
  );
  return scored.map(({ entry }) => entry);
}

function countOccurrences(text: string, term: string): number {
  if (!term) return 0;
  let count = 0;
  let position = 0;
  while ((position = text.indexOf(term, position)) >= 0) {
    count += 1;
    position += term.length;
  }
  return count;
}
