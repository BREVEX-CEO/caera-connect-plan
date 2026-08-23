export interface PublicArticle {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  author: string;
  published: string;
  tags: readonly string[];
  thumbnail: string;
  sections: readonly { heading: string; paragraphs: readonly string[] }[];
}

export const PUBLIC_ARTICLES: readonly PublicArticle[] = [
  {
    slug: "why-ocade-starts-local",
    title: "Why OCADE starts local",
    subtitle: "A product boundary, not a privacy slogan",
    description:
      "How OCADE chooses on-device inference, reports unavailable hardware honestly and keeps public-cloud AI out of the fallback chain.",
    author: "Haans Antoni",
    published: "2026-08-23",
    tags: ["Local AI", "Privacy", "Engineering"],
    thumbnail: "/brand/ocade-carcc-wordmark.png",
    sections: [
      {
        heading: "Local is the default route",
        paragraphs: [
          "OCADE is designed to generate Chat replies on hardware the user controls. A desktop companion, browser WebGPU engine or processor-compatible browser engine may serve a request when it is genuinely available.",
          "If none can run, OCADE must explain that state. It does not redirect the conversation to a public AI provider to preserve the appearance of availability.",
        ],
      },
      {
        heading: "Network use stays specific",
        paragraphs: [
          "Sign-in, Private Sync, live web retrieval and future payment services still need a network. Those are named network paths with separate permissions and failure states; they are not a hidden inference route.",
        ],
      },
    ],
  },
  {
    slug: "building-stop-into-cowork",
    title: "Building STOP into Cowork",
    subtitle: "Control is only useful when a person can interrupt it",
    description:
      "Why OCADE treats STOP, PAUSE, TAKE OVER, previews and readback receipts as part of computer work rather than extra controls.",
    author: "Haans Antoni",
    published: "2026-08-23",
    tags: ["Cowork", "Safety", "Product"],
    thumbnail: "/brand/ocade-carcc-wordmark.png",
    sections: [
      {
        heading: "Interruption is a first-class path",
        paragraphs: [
          "A task that can start but cannot be stopped is not supervised automation. OCADE keeps visible interruption controls beside work and propagates cancellation to the active engine and native worker.",
        ],
      },
      {
        heading: "Proof comes after action",
        paragraphs: [
          "A click or command is only an attempted action. OCADE distinguishes that from independent readback, and records a specific failure when the target cannot be verified.",
        ],
      },
    ],
  },
] as const;

export function findPublicArticle(slug: string): PublicArticle | undefined {
  return PUBLIC_ARTICLES.find((article) => article.slug === slug);
}

export function filterPublicArticles(query: string, tag: string): PublicArticle[] {
  const term = query.trim().toLocaleLowerCase();
  return PUBLIC_ARTICLES.filter((article) => {
    const tagMatches = tag === "All" || article.tags.includes(tag);
    const text =
      `${article.title} ${article.subtitle} ${article.description} ${article.tags.join(" ")}`.toLocaleLowerCase();
    return tagMatches && (!term || text.includes(term));
  });
}
