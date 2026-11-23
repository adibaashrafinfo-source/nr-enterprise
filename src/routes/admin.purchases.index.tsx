import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PackageCheck, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/nre/DataTable";
import { EmptyState } from "@/components/nre/EmptyState";
import { PageHeader } from "@/components/nre/PageHeader";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { PURCHASE_STATUS, PurchaseStatusPill, encodeLines } from "@/components/purchases/shared";
import { formatBDT, formatQty } from "@/lib/money";
import { purchasesQuery, reorderSuggestionsQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";
import type { PurchaseOrder, PurchaseStatus, ReorderSuggestion } from "@/lib/types";

export const Route = createFileRoute("/admin/purchases/")({
  head: () => noIndexPageHead("Purchases — NR Enterprise Admin", "Supplier purchase orders, receiving and reorder suggestions."),
  component: PurchasesPage,
});

const PER_PAGE = 25;
function PurchasesPage() {
  const { userId, role, ready, canEdit } = useCatalogueAccess();
  const [q, setQ] = useState(""); const [page, setPage] = useState(1); const [status, setStatus] = useState<PurchaseStatus | "">("");
  const list = useQuery({ ...purchasesQuery(userId, role, { page, per_page: PER_PAGE, ...(q ? { q } : {}), ...(status ? { status } : {}) }), enabled: ready && canEdit });
  const reorder = useQuery({ ...reorderSuggestionsQuery(userId, role), enabled: ready && canEdit });
  if (ready && !canEdit) return <Navigate to="/admin/purchases/receiving" replace />;

  const columns: Column<PurchaseOrder>[] = [
    { key: "no", header: "PO no.", exportValue: (p) => p.po_no, cell: (p) => <Link to="/admin/purchases/$purchaseId" params={{ purchaseId: String(p.id) }} className="font-mono text-sm font-semibold hover:underline">{p.po_no}</Link> },
    { key: "date", header: "Order date", exportValue: (p) => p.order_date, cell: (p) => p.order_date },
    { key: "sup", header: "Supplier", exportValue: (p) => p.supplier_name, cell: (p) => p.supplier_name },
    { key: "exp", header: "Expected", exportValue: (p) => p.expected_date ?? "", cell: (p) => p.expected_date ?? "—" },
    { key: "bill", header: "Bill no.", exportValue: (p) => p.bill_no ?? "", cell: (p) => p.bill_no ?? "—" },
    { key: "total", header: "Total", align: "right", exportValue: (p) => p.total, cell: (p) => formatBDT(p.total) },
    { key: "recv", header: "Received value", align: "right", exportValue: (p) => p.received_value, cell: (p) => formatBDT(p.received_value) },
    { key: "status", header: "Status", exportValue: (p) => PURCHASE_STATUS[p.status], cell: (p) => <PurchaseStatusPill status={p.status} /> },
  ];
  const chip = (s: PurchaseStatus | "", label: string) => ({ id: s || "all", label, active: status === s, onSelect: () => { setStatus(s); setPage(1); } });
  const suggestions = reorder.data ?? [];
  const bySupplier = suggestions.find((s) => s.supplier_id)?.supplier_id;

  return (
    <>
      <PageHeader title="Purchases" description="Order from suppliers, receive goods into stock and pay suppliers."
        actions={<>
          <Button asChild variant="outline"><Link to="/admin/purchases/receiving"><PackageCheck className="size-4" /> Pending receipts</Link></Button>
          <Button asChild><Link to="/admin/purchases/new" search={{}}><Plus className="size-4" /> New PO</Link></Button>
        </>} />
      <Tabs defaultValue="orders">
        <TabsList className="mb-4"><TabsTrigger value="orders">Purchase orders</TabsTrigger><TabsTrigger value="reorder">Reorder suggestions ({suggestions.length})</TabsTrigger></TabsList>
        <TabsContent value="orders">
          <DataTable columns={columns} rows={list.data?.data ?? []} rowKey={(p) => p.id} page={page} perPage={PER_PAGE} total={list.data?.meta.total ?? 0} onPageChange={setPage}
            search={q} onSearchChange={(v) => { setQ(v); setPage(1); }} searchPlaceholder="Search PO, supplier, bill no.…" loading={list.isLoading} error={list.error ? "Could not load purchase orders." : null}
            emptyTitle="No purchase orders yet" exportFileName="nr-purchases"
            filters={[chip("", "All"), chip("draft", "Draft"), chip("ordered", "Ordered"), chip("partial", "Partial"), chip("received", "Received"), chip("cancelled", "Cancelled")]} />
        </TabsContent>
        <TabsContent value="reorder">
          {suggestions.length === 0 ? <EmptyState title="Nothing to reorder" description="Items at or below their reorder level will appear here." /> : (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button asChild><Link to="/admin/purchases/new" search={{ lines: encodeLines(suggestions.map((s) => ({ variant_id: s.variant_id, qty: s.suggested_qty, rate: s.last_rate }))), ...(bySupplier ? { supplier_id: bySupplier } : {}) }}>
                  <ShoppingCart className="size-4" /> Create PO for all ({suggestions.length})</Link></Button>
              </div>
              <div className="overflow-x-auto rounded-2xl border bg-card">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Item</th><th className="p-3 text-right">On hand</th><th className="p-3 text-right">Reorder level</th><th className="p-3 text-right">Suggested</th><th className="p-3 text-right">Last rate</th><th className="p-3" /></tr></thead>
                  <tbody>{suggestions.map((s: ReorderSuggestion) => (
                    <tr key={s.variant_id} className="border-t">
                      <td className="p-3"><p className="font-medium">{s.display_name}</p><p className="font-mono text-xs text-muted-foreground">{s.sku}</p></td>
                      <td className="p-3 text-right tabular-nums">{formatQty(s.qty_on_hand, s.unit_code)}</td>
                      <td className="p-3 text-right tabular-nums">{formatQty(s.reorder_level, s.unit_code)}</td>
                      <td className="p-3 text-right font-semibold tabular-nums">{formatQty(s.suggested_qty, s.unit_code)}</td>
                      <td className="p-3 text-right tabular-nums">{s.last_rate ? formatBDT(s.last_rate, { decimals: true }) : "—"}</td>
                      <td className="p-3 text-right"><Button asChild size="sm" variant="outline"><Link to="/admin/purchases/new" search={{ lines: encodeLines([{ variant_id: s.variant_id, qty: s.suggested_qty, rate: s.last_rate }]), ...(s.supplier_id ? { supplier_id: s.supplier_id } : {}) }}>Create PO</Link></Button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
