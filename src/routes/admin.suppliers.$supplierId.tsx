import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/nre/EmptyState";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { PageHeader } from "@/components/nre/PageHeader";
import { apiFieldErrors, useCatalogueAccess } from "@/components/catalogue/shared";
import { LedgerTable } from "@/components/parties/LedgerTable";
import { SupplierFormDialog } from "@/components/parties/SupplierFormDialog";
import { adminApi } from "@/lib/api";
import { formatBDT } from "@/lib/money";
import { adminProductsQuery, supplierLedgerQuery, supplierQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/suppliers/$supplierId")({
  head: () => noIndexPageHead("Supplier — NR Enterprise Admin", "Supplier profile, purchases, payments and ledger."),
  component: SupplierProfile,
});

const soon = () => toast.info("This comes with purchases in a later phase.");

function SupplierProfile() {
  const id = Number(Route.useParams().supplierId);
  const { userId, role, ready, canEdit, invalidate } = useCatalogueAccess();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [range, setRange] = useState({ from: "", to: "" });
  const s = useQuery({ ...supplierQuery(userId, role, id), enabled: ready && canEdit && id > 0 });
  const ledger = useQuery({ ...supplierLedgerQuery(userId, role, id, { ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) }), enabled: ready && canEdit && id > 0 });
  const products = useQuery({ ...adminProductsQuery(userId, role, { per_page: 100 }), enabled: ready && canEdit });
  const data = s.data;

  const remove = async () => {
    if (!data || !window.confirm(`Delete “${data.name}”? Suppliers with documents are archived instead.`)) return;
    try { const r = await adminApi.deleteSupplier(id); toast.success(r.archived ? "Supplier has documents, so it was archived." : "Supplier deleted."); await invalidate(); void navigate({ to: "/admin/suppliers" }); }
    catch (e) { apiFieldErrors(e); }
  };

  if (s.isLoading) return <LoadingSkeleton rows={6} />;
  if (!data) return <EmptyState title="Supplier not found" description="It may have been deleted." />;
  const supplied = (products.data?.data ?? []).filter((p) => data.product_ids.includes(p.id));

  return (
    <>
      <div data-print-hide>
        <PageHeader title={data.name} description={`${data.code}${data.payment_terms ? ` · Terms: ${data.payment_terms}` : ""}`}
          actions={<>
            <Button variant="outline" onClick={soon}>New purchase</Button>
            <Button onClick={soon}>Make payment</Button>
            <Button variant="ghost" size="icon" aria-label="Edit supplier" onClick={() => setEditing(true)}><Pencil className="size-4" /></Button>
            <Button variant="ghost" size="icon" aria-label="Delete supplier" onClick={() => void remove()}><Trash2 className="size-4" /></Button>
          </>} />
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          {[["Payable", formatBDT(data.payable_balance)], ["Total purchased", formatBDT(data.total_purchased)], ["Paid", formatBDT(data.paid)]].map(([l, v]) => (
            <div key={l} className="rounded-2xl border bg-card p-4"><p className="text-sm text-muted-foreground">{l}</p><p className="mt-1 text-xl font-bold tabular-nums">{v}</p></div>
          ))}
        </div>
      </div>
      <Tabs defaultValue="ledger">
        <TabsList data-print-hide className="mb-4 flex-wrap">
          <TabsTrigger value="purchases">Purchases</TabsTrigger><TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger><TabsTrigger value="products">Products ({data.product_ids.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="purchases">{data.purchases.length ? <ul className="divide-y rounded-2xl border bg-card">{data.purchases.map((p) => <li key={p.id} className="flex justify-between p-4 text-sm"><span className="font-mono">{p.po_no} · {p.date}</span><span>{formatBDT(p.received_value)}</span></li>)}</ul> : <EmptyState title="No purchases yet" description="Purchase orders arrive in a later phase." />}</TabsContent>
        <TabsContent value="payments">{data.payments.length ? <ul className="divide-y rounded-2xl border bg-card">{data.payments.map((p) => <li key={p.id} className="flex justify-between p-4 text-sm"><span className="font-mono">{p.voucher_no} · {p.payment_date}</span><span>{formatBDT(p.amount)}</span></li>)}</ul> : <EmptyState title="No payments yet" description="Payments you make will appear here." />}</TabsContent>
        <TabsContent value="ledger"><LedgerTable title={`Supplier ledger — ${data.name} (${data.code})`} rows={ledger.data} loading={ledger.isLoading} debitLabel="Purchased" creditLabel="Paid" range={range} onRangeChange={setRange} /></TabsContent>
        <TabsContent value="products">{supplied.length ? <ul className="flex flex-wrap gap-2">{supplied.map((p) => <li key={p.id}><Link to="/admin/products/$productId" params={{ productId: String(p.id) }} className="inline-block rounded-full border bg-card px-3 py-1 text-sm hover:bg-muted">{p.name}</Link></li>)}</ul> : <EmptyState title="No products linked" description="Use Edit to choose the products this supplier provides." />}</TabsContent>
      </Tabs>
      <p data-print-hide className="mt-6"><Link to="/admin/suppliers" className="text-sm text-secondary hover:underline">← All suppliers</Link></p>
      <SupplierFormDialog open={editing} onOpenChange={setEditing} supplier={data} onSaved={invalidate} />
    </>
  );
}
