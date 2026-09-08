// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import qrcode from "qrcode-generator";
import { QrCode } from "@/components/ui/QrCode";

/**
 * A QR CODE THAT DOES NOT SCAN LOOKS EXACTLY LIKE ONE THAT DOES.
 *
 * That is what makes this worth testing rather than eyeballing. The failure
 * modes here are all invisible on screen: a missing quiet zone, a transparent
 * background that renders dark-on-dark in the dark theme, a grid drawn
 * transposed. Each produces a convincing square that a phone will not read, and
 * the person hits it at the exact moment they are trying to secure their
 * account.
 *
 * The rendered SVG is decoded back into a module grid and compared against the
 * encoder's own output, so the assertion is about what a scanner would see
 * rather than about how the component is written.
 */

const URI = "otpauth://totp/OCADE:person@example.com?secret=JBSWY3DPEHPK3PXP&issuer=OCADE";

/** Read the drawn dark modules back out of the SVG, as a scanner would. */
function darkModulesFrom(container: HTMLElement): Set<string> {
  const cells = new Set<string>();
  for (const rect of Array.from(container.querySelectorAll("rect"))) {
    if (rect.getAttribute("fill") !== "#000000") continue;
    cells.add(`${rect.getAttribute("x")},${rect.getAttribute("y")}`);
  }
  return cells;
}

describe("the QR code encodes what it was given", () => {
  it("draws exactly the modules the encoder produced, in the right places", () => {
    const { container } = render(<QrCode value={URI} title="Set-up code" />);

    // The independent expectation: encode the same payload here and compare.
    const expected = qrcode(0, "M");
    expected.addData(URI);
    expected.make();
    const count = expected.getModuleCount();

    const drawn = darkModulesFrom(container);
    const quiet = 4;
    let expectedDark = 0;
    for (let row = 0; row < count; row += 1) {
      for (let column = 0; column < count; column += 1) {
        if (!expected.isDark(row, column)) continue;
        expectedDark += 1;
        /*
         * x is the COLUMN and y is the ROW. Swapping them transposes the grid,
         * which for a QR code means the finder patterns land in the wrong
         * corners — a square that looks entirely plausible and scans as
         * nothing.
         */
        expect(drawn.has(`${column + quiet},${row + quiet}`), `module ${row},${column}`).toBe(true);
      }
    }
    expect(drawn.size).toBe(expectedDark);
  });

  it("encodes a different payload differently", () => {
    // Guards against a component that renders a fixed or cached pattern.
    const first = darkModulesFrom(render(<QrCode value={URI} title="a" />).container);
    const second = darkModulesFrom(
      render(<QrCode value={`${URI}&digits=6`} title="b" />).container,
    );
    expect([...first].join("|")).not.toBe([...second].join("|"));
  });
});

describe("the things that stop a code scanning", () => {
  it("keeps the specified four-module quiet zone on every side", () => {
    /*
     * Not padding for looks. A scanner locates the code by finding where it
     * stops; drawn flush to a dark container it cannot, and the code fails to
     * read for a reason nobody can see.
     */
    const { container } = render(<QrCode value={URI} title="Set-up code" />);
    const svg = container.querySelector("svg")!;
    const [, , width, height] = svg.getAttribute("viewBox")!.split(" ").map(Number);

    const encoded = qrcode(0, "M");
    encoded.addData(URI);
    encoded.make();
    expect(width).toBe(encoded.getModuleCount() + 8);
    expect(height).toBe(width);

    for (const cell of darkModulesFrom(container)) {
      const [x, y] = cell.split(",").map(Number);
      expect(x!).toBeGreaterThanOrEqual(4);
      expect(y!).toBeGreaterThanOrEqual(4);
      expect(x!).toBeLessThan(width! - 4);
      expect(y!).toBeLessThan(height! - 4);
    }
  });

  it("paints its own light background rather than borrowing the page's", () => {
    /*
     * THE DARK-THEME FAILURE. With a transparent background this renders dark
     * modules on OCADE's dark surface — invisible to a scanner, which expects
     * dark on light — and the code simply never reads for half the users.
     */
    const { container } = render(<QrCode value={URI} title="Set-up code" />);
    const background = container.querySelector("rect")!;
    expect(background.getAttribute("fill")).toBe("#ffffff");
    // And it covers the whole square, quiet zone included.
    const svg = container.querySelector("svg")!;
    const [, , width] = svg.getAttribute("viewBox")!.split(" ").map(Number);
    expect(Number(background.getAttribute("width"))).toBe(width);
  });

  it("is announced to assistive technology as an image with a purpose", () => {
    const { container } = render(<QrCode value={URI} title="Set-up code for your app" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("Set-up code for your app");
  });

  it("never puts the secret into a network request", () => {
    /*
     * The URI contains the account's TOTP secret. Rendering it through an image
     * service would hand the second factor to a third party in the very act of
     * setting it up.
     */
    const { container } = render(<QrCode value={URI} title="Set-up code" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.innerHTML).not.toMatch(/https?:\/\//);
  });
});
