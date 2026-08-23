import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const CAPABILITIES = [
  {
    title: "Private local Chat",
    detail:
      "OCADE routes to an available on-device engine and names an honest unavailable state when this hardware cannot serve the request.",
  },
  {
    title: "Permissioned computer work",
    detail:
      "Control and Cowork paths preview actions, preserve STOP and require a supported signed companion before claiming computer control.",
  },
  {
    title: "Device Only or Private Sync",
    detail:
      "Workspace data can remain local or use the verified private service when it is configured; the product fails closed when that service is missing.",
  },
] as const;

export function wrapCarouselIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function CapabilityCarousel() {
  const [index, setIndex] = useState(0);
  const active = CAPABILITIES[index];

  const move = (delta: number) =>
    setIndex((current) => wrapCarouselIndex(current + delta, CAPABILITIES.length));

  return (
    <section
      aria-label="OCADE capability highlights"
      aria-roledescription="carousel"
      className="rounded-2xl border border-white/7 bg-white/[0.018] p-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            Capability {index + 1} of {CAPABILITIES.length}
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Explore OCADE</h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            aria-label="Previous capability"
            onClick={() => move(-1)}
            className="grid h-10 w-10 place-items-center rounded-full border border-border/70 text-muted-foreground transition hover:border-primary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label="Next capability"
            onClick={() => move(1)}
            className="grid h-10 w-10 place-items-center rounded-full border border-border/70 text-muted-foreground transition hover:border-primary/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} of ${CAPABILITIES.length}: ${active.title}`}
        className="mt-5 min-h-40 rounded-xl border border-primary/20 bg-background/55 p-5 transition-[opacity,transform] duration-300 motion-reduce:transition-none"
      >
        <h3 className="text-lg font-semibold text-foreground">{active.title}</h3>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{active.detail}</p>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2" aria-label="Choose a capability">
        {CAPABILITIES.map((capability, itemIndex) => (
          <button
            key={capability.title}
            type="button"
            aria-label={`Show ${capability.title}`}
            aria-current={itemIndex === index ? "true" : undefined}
            onClick={() => setIndex(itemIndex)}
            className={`h-2.5 rounded-full transition-[width,background-color] duration-300 motion-reduce:transition-none ${
              itemIndex === index
                ? "w-8 bg-primary"
                : "w-2.5 bg-muted-foreground/35 hover:bg-muted-foreground/60"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
