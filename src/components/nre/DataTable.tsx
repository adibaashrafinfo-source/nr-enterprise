import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";

export interface Column<T> { key: string; header: string; cell: (row: T) => ReactNode; sortable?: boolean; align?: "left" | "right"; hidden?: boolean }
export interface SortState { sort: string; dir: "asc" | "desc" }

export function DataTable<T>({ columns, rows, rowKey, page, perPage, total, onPageChange, sort, onSortChange, search, onSearchChange, searchPlaceholder = "Search…", loading, error, emptyTitle = "Nothing here yet", toolbar }: {
  columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string | number;
  page: number; perPage: number; total: number; onPageChange: (p: number) => void;
  sort?: SortState; onSortChange?: (s: SortState) => void;
  search?: string; onSearchChange?: (q: string) => void; searchPlaceholder?: string;
  loading?: boolean; error?: string | null; emptyTitle?: string; toolbar?: ReactNode;
}) {
  const [q, setQ] = useState(search ?? "");
  useEffect(() => {
    if (!onSearchChange || q === (search ?? "")) return;
    const t = setTimeout(() => onSearchChange(q), 300);
    return () => clearTimeout(t);
  }, [q, search, onSearchChange]);

  const visible = columns.filter((c) => !c.hidden);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;

  return (
    <div className="rounded-2xl border bg-card shadow-soft">
      {(onSearchChange || toolbar) && (
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          {onSearchChange && (
            <label className="relative w-full sm:max-w-xs">
              <span className="sr-only">Search</span>
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="rounded-full pl-9" />
            </label>
          )}
          {toolbar}
        </div>
      )}
      {loading ? <div className="p-4"><LoadingSkeleton rows={6} /></div>
        : error ? <div className="p-4"><EmptyState title="Couldn't load this list" description={error} /></div>
        : rows.length === 0 ? <div className="p-4"><EmptyState title={emptyTitle} /></div>
        : (
          <Table>
            <TableHeader>
              <TableRow>
                {visible.map((c) => {
                  const active = sort?.sort === c.key;
                  return (
                    <TableHead key={c.key} className={cn(c.align === "right" && "text-right")}>
                      {c.sortable && onSortChange ? (
                        <button type="button" className="inline-flex items-center gap-1 font-semibold hover:text-foreground"
                          onClick={() => onSortChange({ sort: c.key, dir: active && sort?.dir === "asc" ? "desc" : "asc" })}>
                          {c.header}{active && (sort?.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                        </button>
                      ) : c.header}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={rowKey(r)}>
                  {visible.map((c) => <TableCell key={c.key} className={cn(c.align === "right" && "text-right tabular-nums")}>{c.cell(r)}</TableCell>)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm text-muted-foreground">
        <span>{from}–{Math.min(page * perPage, total)} of {total}</span>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}><ChevronLeft /></Button>
          <Button variant="ghost" size="icon" aria-label="Next page" disabled={page >= pages} onClick={() => onPageChange(page + 1)}><ChevronRight /></Button>
        </div>
      </div>
    </div>
  );
}
