import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * FOUR PLACES WHERE THE SCREEN SAID SOMETHING THAT WAS NOT SO.
 *
 * None of them is a crash, and every one of them costs somebody something:
 *
 *   - Help said Offline "sends nothing anywhere". An ordinary offline chat
 *     creates a conversation, stores the question and the answer, and copies an
 *     attachment to Library. Somebody choosing Offline FOR PRIVACY was reading a
 *     promise the product does not keep — the inference is local, the record is
 *     not, and those are different claims.
 *   - Help sent people to Data Controls to delete their account. The control is
 *     under Account; Data Controls deletes content and keeps the account.
 *   - The public header put five links and a wordmark in one row, so at 375 px
 *     the document was 425 px wide and Privacy sat off the edge of the screen.
 *   - `/library` and `/cowork` answered `index,follow` — account destinations
 *     inviting a crawler to index a redirect to sign-in.
 *
 * Copy and layout have no runtime assertion to make, so what is checked is the
 * text and the classes that carry the claim.
 */
const HELP = readFileSync("src/routes/help.tsx", "utf8");
const PUBLIC_PAGE = readFileSync("src/components/shell/PublicPage.tsx", "utf8");
const ROWS = readFileSync("src/components/settings/rows.tsx", "utf8");
const PANEL = readFileSync("src/components/settings/settings-panel.tsx", "utf8");
const AUTHED = readFileSync("src/routes/_authenticated/route.tsx", "utf8");

describe("what Help says about Offline", () => {
  it("does not promise that nothing leaves the device", () => {
    expect(HELP).not.toMatch(/sends\s+nothing\s+anywhere/);
    expect(HELP).not.toMatch(/nothing\s+anywhere/);
  });

  it("separates where the thinking happens from where the chat is kept", () => {
    expect(HELP).toMatch(/not sent to any AI provider/);
    expect(HELP).toMatch(/saved to your\s+account/);
    // And names the control that does make it true.
    expect(HELP).toMatch(/temporary chat/);
  });

  it("sends somebody deleting their account to the screen that does it", () => {
    const answer = HELP.slice(HELP.indexOf("How do I delete my account?"));
    expect(answer.slice(0, 400)).toMatch(/use Account/);
  });
});

describe("a phone can reach every public page", () => {
  it("wraps the header instead of pushing links off the screen", () => {
    expect(PUBLIC_PAGE).toContain("flex-col");
    expect(PUBLIC_PAGE).toContain("sm:flex-row");
    expect(PUBLIC_PAGE).toMatch(/flex flex-wrap[^"]*sm:flex-nowrap/);
    // The old header: one fixed-height row at every width.
    expect(PUBLIC_PAGE).not.toMatch(/flex h-14 \$\{column\}/);
  });
});

describe("settings on a phone", () => {
  it("lets a row and its control stack rather than squeeze", () => {
    expect(ROWS).toMatch(/flex flex-col[^"]*sm:flex-row/);
  });

  it("puts the categories in a scrolling strip rather than a tall column", () => {
    expect(PANEL).toMatch(/overflow-x-auto[^"]*sm:block/);
  });
});

describe("what a crawler is invited to index", () => {
  it("is nothing behind sign-in, decided once on the parent route", () => {
    expect(AUTHED).toMatch(/robots.*noindex/s);
  });
});
