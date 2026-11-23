import { useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Columns3, Download, Search } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { EmptyState } from "./EmptyState";
import { LoadingSkeleton } from "./LoadingSkeleton";

export interface Column<T> { key: string; header: string; cell: (row: T) => ReactNode; sortable?: boolean; align?: "left" | "right"; hidden?: boolean; exportValue?: (row: T) => string | number | boolean }
export interface SortState { sort: string; dir: "asc" | "desc" }
export interface FilterChip { id: string; label: string; active: boolean; onSelect: () => void }

export function DataTable<T>({ columns, rows, rowKey, page, perPage, total, onPageChange, sort, onSortChange, search, onSearchChange, searchPlaceholder = "Search…", loading, error, emptyTitle = "Nothing here yet", toolbar, filters = [], exportRows, exportFileName = "nr-enterprise-export" }: {
  columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string | number;
  page: number; perPage: number; total: number; onPageChange: (p: number) => void;
  sort?: SortState; onSortChange?: (s: SortState) => void;
  search?: string; onSearchChange?: (q: string) => void; searchPlaceholder?: string;
  loading?: boolean; error?: string | null; emptyTitle?: string; toolbar?: ReactNode;
  filters?: FilterChip[]; exportRows?: T[]; exportFileName?: string;
}) {
  const [q, setQ] = useState(search ?? "");
  const [hiddenColumns, setHiddenColumns] = useState<string[]>(() => columns.filter((column) => column.hidden).map((column) => column.key));
  useEffect(() => { setQ(search ?? ""); }, [search]);
  useEffect(() => {
    if (!onSearchChange || q === (search ?? "")) return;
    const t = setTimeout(() => onSearchChange(q), 300);
    return () => clearTimeout(t);
  }, [q, search, onSearchChange]);

  const visible = columns.filter((c) => !hiddenColumns.includes(c.key));
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const sourceRows = exportRows ?? rows;

  const exportExcel = async () => {
    if (!sourceRows.length || !visible.length) return;
    try {
      const XLSX = await import("xlsx");
      const sheet = XLSX.utils.aoa_to_sheet([
        visible.map((column) => column.header),
        ...sourceRows.map((row) => visible.map((column) => exportCell(row, column))),
      ]);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, sheet, "Data");
      const safeName = exportFileName.trim().replace(/[^a-zA-Z0-9-_]+/g, "-") || "nr-enterprise-export";
      XLSX.writeFile(workbook, `${safeName}.xlsx`);
    } catch {
      toast.error("Could not export this table.");
    }
  };

  return (
    <div className="rounded-2xl border bg-card shadow-soft">
      <div className="flex flex-col gap-3 border-b p-4">
        {(onSearchChange || toolbar) && <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {onSearchChange && (
            <label className="relative w-full sm:max-w-xs">
              <span className="sr-only">Search</span>
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="rounded-full pl-9" />
            </label>
          )}
          {toolbar}
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Table filters">
            {filters.map((filter) => <Button key={filter.id} type="button" size="sm" variant={filter.active ? "default" : "outline"} aria-pressed={filter.active} onClick={filter.onSelect}>{filter.label}</Button>)}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button type="button" variant="outline" size="sm" aria-label="Choose visible columns" title="Choose visible columns"><Columns3 /><span className="hidden sm:inline">Columns</span></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end"><DropdownMenuLabel>Visible columns</DropdownMenuLabel><DropdownMenuSeparator />
                {columns.map((column) => <DropdownMenuCheckboxItem key={column.key} checked={!hiddenColumns.includes(column.key)} disabled={!hiddenColumns.includes(column.key) && visible.length === 1}
                  onCheckedChange={(checked) => setHiddenColumns((current) => checked ? current.filter((key) => key !== column.key) : current.includes(column.key) ? current : [...current, column.key])}>{column.header}</DropdownMenuCheckboxItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button type="button" variant="outline" size="sm" disabled={!sourceRows.length} onClick={() => { void exportExcel(); }} title="Export current results to Excel"><Download /><span className="hidden sm:inline">Export</span></Button>
          </div>
        </div>
      </div>
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
                        <Button type="button" variant="ghost" size="sm" className="h-auto gap-1 px-0 font-semibold" aria-label={`Sort by ${c.header}`}
                          onClick={() => onSortChange({ sort: c.key, dir: active && sort?.dir === "asc" ? "desc" : "asc" })}>
                          {c.header}{active && (sort?.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                        </Button>
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

function exportCell<T>(row: T, column: Column<T>): string | number | boolean {
  if (column.exportValue) return column.exportValue(row);
  const value = (row as unknown as Record<string, unknown>)[column.key];
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  return value == null ? "" : String(value);
}
