export function OcadeBreadcrumbs({ items }: { items: readonly { label: string; to?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="overflow-hidden text-xs text-muted-foreground">
      <ol className="flex min-w-0 items-center gap-2">
        {items.map((item, index) => <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">{index ? <span aria-hidden>/</span> : null}{item.to ? <a href={item.to} className="max-w-40 truncate underline-offset-4 hover:underline">{item.label}</a> : <span aria-current="page" className="max-w-48 truncate text-foreground">{item.label}</span>}</li>)}
      </ol>
    </nav>
  );
}
