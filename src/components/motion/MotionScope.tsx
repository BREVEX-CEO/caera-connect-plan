import { useEffect, useRef, type ReactNode } from "react";
import { useReveal } from "@/lib/motion/use-reveal";
import "@/motion-upgrades.css";

/**
 * Shared motion boundary for workspace routes. New direct children receive both
 * the existing scroll-reveal behavior and a restrained route-entry animation,
 * so newly-added pages inherit the product motion language automatically.
 */
export function MotionScope({ children }: { children: ReactNode }) {
  const reveal = useReveal();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scan = () => {
      let index = 0;
      for (const child of Array.from(host.children)) {
        if (!(child instanceof HTMLElement)) continue;
        child.classList.add("ocade-route-enter");
        if (reveal.enabled) {
          child.classList.add("ocade-reveal");
          child.style.setProperty("--reveal-delay", `${Math.min(index, 5) * 60}ms`);
          reveal.ref(child);
        }
        index += 1;
      }
    };

    scan();
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
