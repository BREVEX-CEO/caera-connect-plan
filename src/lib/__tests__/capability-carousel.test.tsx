import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CapabilityCarousel } from "@/components/public/CapabilityCarousel";
import { wrapCarouselIndex } from "@/components/public/carousel-index";

describe("the public OCADE capability carousel", () => {
  it("wraps previous, next and direct navigation indexes", () => {
    expect(wrapCarouselIndex(-1, 3)).toBe(2);
    expect(wrapCarouselIndex(3, 3)).toBe(0);
    expect(wrapCarouselIndex(1, 3)).toBe(1);
    expect(wrapCarouselIndex(4, 0)).toBe(0);
  });

  it("renders aligned controls, a focused slide and visual progress", () => {
    const html = renderToStaticMarkup(<CapabilityCarousel />);
    expect(html).toContain('aria-roledescription="carousel"');
    expect(html).toContain('aria-label="Previous capability"');
    expect(html).toContain('aria-label="Next capability"');
    expect(html).toContain('aria-roledescription="slide"');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain("min-h-40");
    expect(html).toContain("motion-reduce:transition-none");
  });
});
