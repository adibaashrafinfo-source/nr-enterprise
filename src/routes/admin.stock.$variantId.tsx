import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/nre/DataTable";
import { PageHeader } from "@/components/nre/PageHeader";
import { StatusPill } from "@/components/nre/StatusPill";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { AdjustStockDialog } from "@/components/stock/AdjustStockDialog";
import { formatQty } from "@/lib/money";
import { stockMovementsQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";
import type { StockLedgerRow, StockMovementType } from "@/lib/types";

export const Route = createFileRoute("/admin/stock/$variantId")({
  head: () => noIndexPageHead("Stock card — NR Enterprise Admin", "Stock movement history for one NR Enterprise product variant."),
  component: StockCard,
});

const TYPES: Record<StockMovementType, string> = { opening: "Opening", purchase_in: "Purchase in", sale_out: "Sale out", sales_return: "Sales return", sale_return_in: "Sales return", cancel_reverse: "Invoice cancelled", adjustment_in: "Adjustment in", adjustment_out: "Adjustment out" };
const DOC_PATH = { invoice: "/admin/invoices", invoice_item: "/admin/invoices", invoice_return: "/admin/invoices", purchase_order: "/admin/purchases" } as const;
const PER_PAGE = 25;

function StockCard() {
  const variantId = Number(Route.useParams().variantId);
  const { userId, role, ready, canEdit, invalidate } = useCatalogueAccess();
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [adjusting, setAdjusting] = useState(false);
  const query = { page, per_page: PER_PAGE, ...(type ? { type } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) };
  const res = useQuery({ ...stockMovementsQuery(userId, role, variantId, query), enabled: ready && variantId > 0 });
  const v = res.data?.variant;

  const signed = (q: string) => (q.startsWith("-") ? `−${formatQty(q.slice(1))}` : `+${formatQty(q)}`);
  const columns: Column<StockLedgerRow>[] = [
    { key: "date", header: "Date", exportValue: (r) => r.created_at, cell: (r) => new Date(r.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) },
    { key: "type", header: "Type", exportValue: (r) => TYPES[r.type], cell: (r) => TYPES[r.type] },
    { key: "qty", header: "Quantity", align: "right", exportValue: (r) => r.quantity, cell: (r) => <span className={`font-semibold tabular-nums ${r.quantity.startsWith("-") ? "text-destructive" : "text-secondary"}`}>{signed(r.quantity)}</span> },
    { key: "doc", header: "Document", exportValue: (r) => (r.reference_type ? `${r.reference_type} #${r.reference_id}` : ""), cell: (r) => r.reference_type && r.reference_id
      ? <a href={DOC_PATH[r.reference_type]} className="text-secondary hover:underline">{r.reference_type.replace("_", " ")} #{r.reference_id}</a> : "—" },
    { key: "buyer", header: "Buyer", exportValue: (r) => r.buyer ?? "", cell: (r) => r.buyer ?? "—" },
    { key: "style", header: "Style no", exportValue: (r) => r.style_no ?? "", cell: (r) => r.style_no ?? "—" },
    { key: "batch", header: "Batch", exportValue: (r) => r.batch ?? "", cell: (r) => r.batch ?? "—" },
    { key: "user", header: "User", exportValue: (r) => r.user_name, cell: (r) => r.user_name },
    { key: "note", header: "Note", exportValue: (r) => r.note ?? "", cell: (r) => <span className="text-muted-foreground">{r.note ?? "—"}</span> },
  ];

  return (
    <>
      <PageHeader title={v?.display_name ?? "Stock card"} {...(v ? { description: `${v.sku} · ${v.category_name}` } : {})}
        actions={<div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/admin/stock">Back to stock</Link></Button>
          {canEdit && v && <Button onClick={() => setAdjusting(true)}><SlidersHorizontal className="size-4" /> Adjust</Button>}
        </div>} />
      {v && (
        <div className="mb-6 flex flex-wrap items-center gap-6 rounded-2xl border bg-card p-5">
          <div><p className="text-sm text-muted-foreground">Current stock</p><p className="text-3xl font-bold tabular-nums" data-testid="current-stock">{formatQty(v.qty_on_hand, v.unit_code)}</p></div>
          <div><p className="text-sm text-muted-foreground">Reorder level</p><p className="text-lg font-semibold tabular-nums">{formatQty(v.reorder_level, v.unit_code)}</p></div>
          <StatusPill status={v.status} />
        </div>
      )}
      <DataTable columns={columns} rows={res.data?.data ?? []} rowKey={(r) => r.id} page={page} perPage={PER_PAGE} total={res.data?.meta.total ?? 0} onPageChange={setPage}
        loading={res.isLoading} error={res.error ? "Could not load this stock card." : null} emptyTitle="No stock movements yet" exportFileName={`nr-stock-card-${v?.sku ?? variantId}`}
        toolbar={<div className="flex flex-wrap gap-2">
          <Select value={type || "all"} onValueChange={(t) => { setType(t === "all" ? "" : t); setPage(1); }}>
            <SelectTrigger className="w-full rounded-full sm:w-48" aria-label="Filter by type"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">All types</SelectItem>{Object.entries(TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" aria-label="From date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-auto rounded-full" />
          <Input type="date" aria-label="To date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-auto rounded-full" />
        </div>} />
      {canEdit && v && <AdjustStockDialog open={adjusting} onOpenChange={setAdjusting} variants={[v]} initialVariantId={v.variant_id} onDone={invalidate} />}
    </>
  );
}
