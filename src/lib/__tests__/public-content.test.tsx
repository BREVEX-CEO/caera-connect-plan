import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { filterPublicArticles, findPublicArticle, PUBLIC_ARTICLES } from "@/lib/public-content";

describe("truthful public journal and careers content", () => {
  it("provides searchable, tagged original articles and related-post inventory", () => {
    expect(PUBLIC_ARTICLES.length).toBeGreaterThanOrEqual(2);
    expect(filterPublicArticles("local", "All")[0]?.slug).toBe("why-ocade-starts-local");
    expect(findPublicArticle("building-stop-into-cowork")?.author).toBe("Haans Antoni");
  });

  it("renders every required article and directory surface in reachable routes", () => {
    const blog = readFileSync("src/routes/blog.index.tsx", "utf8");
    const post = readFileSync("src/routes/blog.$slug.tsx", "utf8");
    const careers = readFileSync("src/routes/careers.tsx", "utf8");
    const auth = readFileSync("src/routes/auth.tsx", "utf8");
    for (const value of ["Search posts", "Journal topics", "Page 1 of 1", "PrelaunchSubscription"])
      expect(blog).toContain(value);
    for (const value of [
      "BlogPosting",
      "Share this article",
      "Related articles",
      "Comments",
      "Open the OCADE demo",
    ])
      expect(post).toContain(value);
    for (const value of [
      "Company story",
      "Teams and work",
      "Benefits",
      "Open roles",
      "Employee perspectives",
    ])
      expect(careers).toContain(value);
    expect(auth).toContain('to="/blog/$slug"');
    expect(auth).toContain('slug: "why-ocade-starts-local"');
  });
});
