export function OcadeBreadcrumbs({ items }: { items: readonly { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="overflow-hidden text-xs text-muted-foreground">
      <ol className="flex min-w-0 items-center gap-2">
        {items.map((item, index) => (
          <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
            {index ? <span aria-hidden>/</span> : null}
            {item.to ? (
              /*
               * A breadcrumb is small type, and small type makes a small target:
               * this link measured 43x16 on a phone, under the 24-pixel minimum.
               * The text stays the size the design wants; the tappable box does
               * not have to match it.
               */
              <a
                href={item.to}
                className="inline-flex min-h-6 max-w-40 items-center truncate py-1 underline-offset-4 hover:underline"
              >
                {item.label}
              </a>
            ) : (
              <span aria-current="page" className="max-w-48 truncate text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
