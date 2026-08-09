import { useEffect, useRef, type ReactNode } from "react";
import { useReveal } from "@/lib/motion/use-reveal";

/**
 * Applies scroll reveal to the direct children of a region.
 *
 * WHY A SCOPE AND NOT A PROP ON EVERY SECTION. Motion should be a property of
 * the application, not something each page opts into one element at a time.
 * Threading a ref through every section of every route guarantees pages get
 * missed, and a product where half the screens animate and half do not looks
 * unfinished rather than restrained. One wrapper per shell covers every route
 * that renders inside it, including routes written later.
 *
 * DIRECT CHILDREN ONLY, and deliberately. Revealing nested elements would
 * animate the same content twice and stagger a paragraph away from its own
 * heading. The unit of motion is the section a reader's eye arrives at.
 *
 * The wrapper renders no element of its own — `display: contents` — so
 * inserting it cannot disturb a grid or flex layout the page already relies on.
 */
export function MotionScope({ children }: { children: ReactNode }) {
  const reveal = useReveal();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !reveal.enabled) return;

    /*
     * Re-scanned when the route changes, because the children are replaced
     * wholesale by the router rather than mutated in place. `observe` ignores
     * elements it already tracks, so a repeat scan costs nothing.
     */
    const scan = () => {
      let index = 0;
      for (const child of Array.from(host.children)) {
        if (!(child instanceof HTMLElement)) continue;
        child.classList.add("ocade-reveal");
        child.style.setProperty("--reveal-delay", `${Math.min(index, 5) * 60}ms`);
        reveal.ref(child);
        index += 1;
      }
    };
    scan();

    // Routes that stream in content after the first paint would otherwise
    // never be observed. Cheap: it fires on child list changes, not on scroll.
    const watcher = new MutationObserver(scan);
    watcher.observe(host, { childList: true });
    return () => watcher.disconnect();
  }, [reveal]);

  return (
    <div ref={hostRef} style={{ display: "contents" }}>
      {children}
    </div>
  );
}
