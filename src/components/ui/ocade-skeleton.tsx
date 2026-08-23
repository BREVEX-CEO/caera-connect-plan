export function OcadeSkeleton({ lines = 3, label = "Loading content" }: { lines?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3 rounded-xl border border-border/50 p-4">
      <span className="sr-only">{label}</span>
      <div className="h-4 w-2/5 rounded bg-muted motion-safe:animate-pulse" />
      {Array.from({ length: Math.max(1, lines) }, (_, index) => <div key={index} className={`h-3 rounded bg-muted/70 motion-safe:animate-pulse ${index === lines - 1 ? "w-3/5" : "w-full"}`} />)}
    </div>
  );
}
