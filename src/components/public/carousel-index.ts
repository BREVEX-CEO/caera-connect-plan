/**
 * Wrap a carousel position onto a valid slide.
 *
 * Pure, so stepping past either end can be tested without rendering, and an
 * empty list answers 0 rather than reading undefined.
 */
export function wrapCarouselIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}
