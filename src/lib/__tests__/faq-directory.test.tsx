// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { FaqDirectory } from "@/routes/faq";
import { FAQ_GROUPS, filterFaqGroups } from "@/lib/public-faq";

afterEach(cleanup);

describe("FAQ directory", () => {
  it("renders searchable topic navigation with stable anchors", () => {
    const html = renderToStaticMarkup(<FaqDirectory />);
    expect(html).toContain('type="search"');
    expect(html).toContain('aria-label="FAQ topics"');
    expect(html).toContain('href="#faq-account-and-sign-in"');
    expect(html).toContain('id="faq-technical-and-privacy"');
  });

  it("searches topic names, questions and answers case-insensitively", () => {
    expect(filterFaqGroups(FAQ_GROUPS, "PAYMENT").map((group) => group.title)).toEqual([
      "Billing and plans",
    ]);
    expect(filterFaqGroups(FAQ_GROUPS, "native companion")[0]?.title).toBe("Technical and privacy");
  });

  it("filters the visible questions and offers a truthful empty state", () => {
    const view = render(<FaqDirectory />);
    const search = view.getByLabelText("Search questions and answers");

    fireEvent.change(search, { target: { value: "native companion" } });
    expect(view.getByText("Can OCADE control my computer?")).toBeTruthy();
    expect(view.queryByText("How do I sign in?")).toBeNull();

    fireEvent.change(search, { target: { value: "definitely-no-match" } });
    expect(view.getByText("No matching questions")).toBeTruthy();
    expect(view.getByRole("button", { name: "Show all questions" })).toBeTruthy();
  });
});
