import { useMemo, useState } from "react";

export interface OcadeTableRow { id: string; [key: string]: string }
export interface OcadeTableColumn { key: string; label: string }

export function OcadeDataTable({ caption, columns, rows, onAction, actionLabel = "Details" }: { caption: string; columns: readonly OcadeTableColumn[]; rows: readonly OcadeTableRow[]; onAction?: (row: OcadeTableRow) => void; actionLabel?: string }) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState(columns[0]?.key ?? "id");
  const [ascending, setAscending] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = 3;
  const filtered = useMemo(() => rows.filter((row) => Object.values(row).some((value) => value.toLowerCase().includes(query.toLowerCase()))).sort((a, b) => (ascending ? 1 : -1) * (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "")), [rows, query, sortKey, ascending]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  return <section aria-label={caption}><div className="mb-3 flex flex-wrap gap-2"><label className="text-xs text-muted-foreground">Search table<input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} className="ml-2 min-h-9 rounded-md border border-border/70 bg-background px-3 text-foreground" /></label><label className="text-xs text-muted-foreground">Sort by<select value={sortKey} onChange={(event) => setSortKey(event.target.value)} className="ml-2 min-h-9 rounded-md border border-border/70 bg-background px-2 text-foreground">{columns.map((column) => <option key={column.key} value={column.key}>{column.label}</option>)}</select></label><button type="button" onClick={() => setAscending((value) => !value)} className="min-h-9 rounded-md border border-border/70 px-3 text-xs">{ascending ? "Ascending" : "Descending"}</button></div><div className="overflow-x-auto rounded-xl border border-border/60"><table className="min-w-[560px] w-full text-left text-xs"><caption className="sr-only">{caption}</caption><thead className="bg-muted/40"><tr>{columns.map((column) => <th key={column.key} scope="col" className="p-3 font-medium">{column.label}</th>)}{onAction ? <th scope="col" className="p-3">Actions</th> : null}</tr></thead><tbody>{visible.map((row) => <tr key={row.id} className="border-t border-border/50">{columns.map((column) => <td key={column.key} className="p-3">{row[column.key]}</td>)}{onAction ? <td className="p-3"><button type="button" onClick={() => onAction(row)} className="underline">{actionLabel}</button></td> : null}</tr>)}</tbody></table>{!visible.length ? <p className="p-4 text-sm text-muted-foreground">No rows match this search.</p> : null}</div><nav aria-label={`${caption} pages`} className="mt-3 flex justify-between text-xs"><button type="button" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="min-h-9 rounded-md border border-border/70 px-3 disabled:opacity-40">Previous</button><span>Page {safePage} of {pages}</span><button type="button" disabled={safePage >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="min-h-9 rounded-md border border-border/70 px-3 disabled:opacity-40">Next</button></nav></section>;
}
