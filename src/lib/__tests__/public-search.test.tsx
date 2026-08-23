import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "@/routeTree.gen";
import { PUBLIC_SEARCH_INDEX, searchPublicPages } from "@/lib/public-search";

describe("public site search", () => {
  it("searches titles, descriptions and keywords with category and ordering controls", () => {
    expect(searchPublicPages("local AI", "All", "relevance")[0]?.id).toBe("ocade");
    expect(searchPublicPages("privacy", "Legal", "relevance").map((entry) => entry.id)).toContain(
      "privacy",
    );
    expect(searchPublicPages("billing", "Company", "relevance")).toEqual([]);
    expect(searchPublicPages("", "All", "title").map((entry) => entry.title)).toEqual(
      [...PUBLIC_SEARCH_INDEX].map((entry) => entry.title).sort((a, b) => a.localeCompare(b)),
    );
  });

  it("renders search, suggestions, filters, progress status and official results", async () => {
    const router = createRouter({
      routeTree,
      context: { queryClient: new QueryClient() },
      history: createMemoryHistory({ initialEntries: ["/search"] }),
    });
    await router.load();
    const html = renderToStaticMarkup(<RouterProvider router={router} />);

    expect(html).toContain("Search official pages");
    expect(html).toContain("Suggested searches");
    expect(html).toContain("Search category");
    expect(html).toContain("Search result order");
    expect(html).toContain('role="status"');
    expect(html).toContain("OCADE product overview");
    expect(html).toContain("Search text stays in this browser");
  });
});
