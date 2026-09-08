// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import { FaqDirectory } from "@/routes/faq";
import { faqViewMatching, searchArticles } from "@/lib/support/search";

/*
 * A CLIENT, BECAUSE THE FAQ NOW READS SOMETHING.
 *
 * §L's publishing workflow means the FAQ is a view of the catalogue WITH an
 * editor's changes applied, so it asks for those through react-query — the
 * same read `/support` and every article page make, deduped between them.
 *
 * Retries off and a fresh client per render: the query resolves to an empty
 * override list in this environment, and what these tests are about is what
 * the page does with the shipped catalogue underneath it.
 */
const withClient = (node: React.ReactNode) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {node}
  </QueryClientProvider>
);

afterEach(cleanup);

describe("FAQ directory", () => {
  it("renders searchable topic navigation with stable anchors", () => {
    const html = renderToStaticMarkup(withClient(<FaqDirectory />));
    expect(html).toContain('type="search"');
    expect(html).toContain('aria-label="FAQ topics"');
    expect(html).toContain('href="#faq-account-and-sign-in"');
    expect(html).toContain('id="faq-billing-and-plans"');
  });

  it("is a VIEW of the Help Center rather than a second set of answers", () => {
    /*
     * The whole point of the migration PLAN.md §L asks for. Every question on
     * this page is a published help article with its own permanent URL, so the
     * FAQ cannot drift from the article a support reply links to.
     */
    const groups = faqViewMatching("");
    expect(groups.length).toBeGreaterThan(3);
    for (const group of groups) {
      for (const article of group.articles) {
        expect(article.question, `${article.slug} is in the FAQ view`).toBeTruthy();
        expect(article.status).toBe("published");
        expect(article.slug).toMatch(/^[a-z0-9-]+$/);
      }
    }
  });

  it("searches questions, keywords and answers case-insensitively", () => {
    /*
     * Not asserted as an exclusive list. "Payment" legitimately appears in the
     * contact article too — it is the one that says never to put payment
     * secrets in a ticket — and a search that hid it would be hiding a correct
     * result to satisfy a test. What matters is that the BEST match is the
     * billing answer, which is what ranking is for.
     */
    const payment = faqViewMatching("PAYMENT");
    expect(payment.map((group) => group.category.title)).toContain("Billing and plans");
    expect(searchArticles("payment")[0].article.category).toBe("billing-and-plans");

    expect(faqViewMatching("native companion")[0]?.category.title).toBe(
      "Browser and computer control",
    );
  });

  it("filters the visible questions and offers a truthful empty state", () => {
    const view = render(withClient(<FaqDirectory />));
    const search = view.getByLabelText("Search questions and answers");

    fireEvent.change(search, { target: { value: "native companion" } });
    expect(view.getByText("Can OCADE control my computer?")).toBeTruthy();
    expect(view.queryByText("How do I sign in?")).toBeNull();

    fireEvent.change(search, { target: { value: "definitely-no-match" } });
    expect(view.getByText("No matching questions")).toBeTruthy();
    expect(view.getByRole("button", { name: "Show all questions" })).toBeTruthy();
  });
});
