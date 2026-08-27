import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("anonymous demo navigation", () => {
  it("keeps Settings inside the demo and warms it for offline routing", () => {
    const source = readFileSync("src/components/ocade/demo/DemoSidebarNav.tsx", "utf8");
    expect(source).toContain('to="/demo/settings"');
    expect(source).toContain('preload="render"');
    expect(source).not.toContain('to="/settings"');
  });

  it("does not initialize account session state inside the demo workspace shell", () => {
    const source = readFileSync("src/components/shell/WorkspaceShell.tsx", "utf8");
    expect(source).toContain("<WorkspaceShellInner {...props} user={null} />");
    expect(source).toContain("function AccountWorkspaceShell");
    expect(source).toContain("{isDemo ? null : <WelcomeTour />}");
  });

  it("routes public support links to the signed-out help page", () => {
    const footer = readFileSync("src/components/shell/SiteFooter.tsx", "utf8");
    const faq = readFileSync("src/routes/faq.tsx", "utf8");
    expect(footer).toContain('{ to: "/support", label: "Support" }');
    expect(faq).toContain('to="/support"');
    /*
     * THIS USED TO REQUIRE `mailto:support@ocade.in` ON THE PAGE.
     *
     * That mailbox is not active, and a support page that prints an address
     * nobody reads is worse than one that does not: the person writes, waits,
     * and hears nothing. Support runs on tickets, so the page links to tickets
     * — and this asserts the absence of the dead address as well as the
     * presence of the route that works.
     */
    const support = readFileSync("src/routes/support.tsx", "utf8");
    expect(support).toContain('to="/settings/support"');
    expect(support).not.toMatch(/mailto:/);
  });
});
