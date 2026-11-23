import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Boxes, ClipboardList, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/nre/DataTable";
import { PageHeader } from "@/components/nre/PageHeader";
import { StatusPill } from "@/components/nre/StatusPill";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { AdjustStockDialog } from "@/components/stock/AdjustStockDialog";
import { formatBDT, formatQty } from "@/lib/money";
import { adminCategoriesQuery, stockQuery, stockValueQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";
import type { StockRow } from "@/lib/types";

export const Route = createFileRoute("/admin/stock/")({
  head: () => noIndexPageHead("Stock — NR Enterprise Admin", "Review NR Enterprise inventory balances, stock levels and movements."),
  component: StockOverview,
});

const PER_PAGE = 25;

function StockOverview() {
  const { userId, role, ready, canEdit, invalidate } = useCatalogueAccess();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [categoryId, setCategoryId] = useState(0);
  const [status, setStatus] = useState<"" | "ok" | "low" | "out">("");
  const [adjust, setAdjust] = useState<{ open: boolean; id?: number }>({ open: false });
  const query = { page, per_page: PER_PAGE, ...(q ? { q } : {}), ...(categoryId ? { category_id: categoryId } : {}), ...(status ? { status } : {}) };
  const stock = useQuery({ ...stockQuery(userId, role, query), enabled: ready });
  const all = useQuery({ ...stockQuery(userId, role, { per_page: 100 }), enabled: ready && canEdit });
  const value = useQuery({ ...stockValueQuery(userId, role), enabled: ready && canEdit });
  const categories = useQuery({ ...adminCategoriesQuery(userId, role), enabled: ready });

  const columns: Column<StockRow>[] = [
    { key: "name", header: "Product / variant", exportValue: (r) => r.display_name, cell: (r) => (
      <Link to="/admin/stock/$variantId" params={{ variantId: String(r.variant_id) }} className="font-semibold hover:underline">{r.display_name}<span className="block font-mono text-xs font-normal text-muted-foreground">{r.sku}</span></Link>) },
    { key: "category", header: "Category", exportValue: (r) => r.category_name, cell: (r) => r.category_name },
    { key: "unit", header: "Unit", exportValue: (r) => r.unit_code, cell: (r) => r.unit_code },
    { key: "qty", header: "In stock", align: "right", exportValue: (r) => r.qty_on_hand, cell: (r) => <span className="tabular-nums">{formatQty(r.qty_on_hand)}</span> },
    { key: "reorder", header: "Reorder level", align: "right", exportValue: (r) => r.reorder_level, cell: (r) => <span className="tabular-nums">{formatQty(r.reorder_level)}</span> },
    { key: "status", header: "Status", exportValue: (r) => r.status, cell: (r) => <StatusPill status={r.status} /> },
    { key: "price", header: "Selling price", align: "right", exportValue: (r) => r.selling_price, cell: (r) => formatBDT(r.selling_price) },
    ...(canEdit ? [{ key: "actions", header: "", align: "right" as const, cell: (r: StockRow) => (
      <Button size="icon" variant="ghost" aria-label={`Adjust ${r.display_name}`} onClick={() => setAdjust({ open: true, id: r.variant_id })}><SlidersHorizontal className="size-4" /></Button>) }] : []),
  ];
  const chip = (id: typeof status, label: string) => ({ id: id || "all", label, active: status === id, onSelect: () => { setStatus(id); setPage(1); } });

  return (
    <>
      <PageHeader title="Stock" description="Stock comes in when goods are received and goes out when invoices are confirmed."
        actions={canEdit && <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline"><Link to="/admin/stock/opening"><ClipboardList className="size-4" /> Opening stock</Link></Button>
          <Button onClick={() => setAdjust({ open: true })}><SlidersHorizontal className="size-4" /> Adjust stock</Button>
        </div>} />
      {canEdit && (
        <div className="mb-6 rounded-2xl border bg-card p-5">
          <div className="flex items-center gap-3"><Boxes className="size-5 text-secondary" /><p className="text-sm text-muted-foreground">Stock value (at purchase cost)</p></div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{value.data ? formatBDT(value.data.total) : value.isError ? "Unavailable" : "…"}</p>
          {!!value.data?.by_category.length && <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">{value.data.by_category.map((c) => <li key={c.category_id}>{c.category_name}: <span className="font-medium text-foreground">{formatBDT(c.value)}</span></li>)}</ul>}
        </div>
      )}
      <DataTable columns={columns} rows={stock.data?.data ?? []} rowKey={(r) => r.variant_id} page={page} perPage={PER_PAGE} total={stock.data?.meta.total ?? 0}
        onPageChange={setPage} search={q} onSearchChange={(v) => { setQ(v); setPage(1); }} searchPlaceholder="Search product or SKU…"
        loading={stock.isLoading} error={stock.error ? "Could not load stock." : null} exportFileName="nr-stock"
        emptyTitle={status || q || categoryId ? "No stock matches" : "No variants yet — add variants to products first"}
        filters={[chip("", "All"), chip("ok", "In stock"), chip("low", "Low"), chip("out", "Out")]}
        toolbar={
          <Select value={String(categoryId)} onValueChange={(v) => { setCategoryId(Number(v)); setPage(1); }}>
            <SelectTrigger className="w-full rounded-full sm:w-56" aria-label="Filter by category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">All categories</SelectItem>
              {(categories.data ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        } />
      {canEdit && <AdjustStockDialog open={adjust.open} onOpenChange={(o) => setAdjust((a) => ({ ...a, open: o }))} variants={all.data?.data ?? []} {...(adjust.id ? { initialVariantId: adjust.id } : {})} onDone={invalidate} />}
    </>
  );
}
