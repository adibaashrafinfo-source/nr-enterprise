import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Printer, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/nre/EmptyState";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { PageHeader } from "@/components/nre/PageHeader";
import { apiFieldErrors, useCatalogueAccess } from "@/components/catalogue/shared";
import { PurchaseForm, toPurchaseInput } from "@/components/purchases/PurchaseForm";
import { PurchaseReturnDialog, ReceiveDialog, SupplierPaymentDialog, type ReceiveTarget } from "@/components/purchases/PurchaseDialogs";
import { PurchaseStatusPill } from "@/components/purchases/shared";
import { METHODS } from "@/components/sales/InvoiceDialogs";
import { adminApi } from "@/lib/api";
import { addQty, formatBDT, formatQty, toScaled } from "@/lib/money";
import { purchaseQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";
import type { PurchaseItem, PurchaseStatus } from "@/lib/types";

export const Route = createFileRoute("/admin/purchases/$purchaseId")({
  head: () => noIndexPageHead("Purchase order — NR Enterprise Admin", "Receive goods, return items and pay the supplier for a purchase order."),
  component: PurchasePage,
});

const pendingOf = (i: PurchaseItem) => addQty(i.qty_ordered, `-${i.qty_received}`);

function PurchasePage() {
  const id = Number(Route.useParams().purchaseId);
  const { userId, role, ready, canEdit, invalidate } = useCatalogueAccess();
  const q = useQuery({ ...purchaseQuery(userId, role, id), enabled: ready && canEdit && id > 0 });
  const [receive, setReceive] = useState<ReceiveTarget | null>(null);
  const [ret, setRet] = useState<PurchaseItem | null>(null);
  const [paying, setPaying] = useState(false);
  if (ready && !canEdit) return <EmptyState title="Managers only" description="Use Pending receipts to receive goods." />;
  if (q.isLoading || !ready) return <LoadingSkeleton rows={6} />;
  const po = q.data;
  if (!po) return <EmptyState title="Purchase order not found" />;
  const nothingReceived = po.items.every((i) => toScaled(i.qty_received) === 0n);
  const editable = nothingReceived && (po.status === "draft" || po.status === "ordered");
  const receivable = po.status === "ordered" || po.status === "partial";
  const setStatus = async (s: PurchaseStatus) => {
    if (s === "cancelled" && !window.confirm(`Cancel ${po.po_no}?`)) return;
    try { await adminApi.setPurchaseStatus(po.id, s); toast.success("Purchase order updated."); await invalidate(); } catch (e) { apiFieldErrors(e); }
  };

  return (
    <>
      <PageHeader title={`${po.po_no} · ${po.supplier_name}`} description={`Ordered ${po.order_date}${po.expected_date ? ` · Expected ${po.expected_date}` : ""}${po.bill_no ? ` · Bill ${po.bill_no}` : ""}`}
        actions={<>
          <PurchaseStatusPill status={po.status} />
          <Button asChild variant="outline"><Link to="/admin/print/$kind/$id" params={{ kind: "purchase", id: String(po.id) }}><Printer className="size-4" /> Print PO</Link></Button>
          {po.status === "draft" && <Button onClick={() => void setStatus("ordered")}>Place order</Button>}
          {po.status !== "cancelled" && <Button variant="outline" onClick={() => setPaying(true)}><Wallet className="size-4" /> Pay supplier</Button>}
          {nothingReceived && po.status !== "cancelled" && <Button variant="ghost" onClick={() => void setStatus("cancelled")}>Cancel PO</Button>}
        </>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[["PO total", formatBDT(po.total)], ["Received value", formatBDT(po.received_value)], ["Supplier payable", formatBDT(po.supplier.payable_balance)]].map(([l, v]) => (
          <div key={l} className="rounded-2xl border bg-card p-4"><p className="text-sm text-muted-foreground">{l}</p><p className="mt-1 text-xl font-bold tabular-nums">{v}</p></div>
        ))}
      </div>

      {editable ? (
        <PurchaseForm key={`${po.id}-${po.total}-${po.status}`} submitLabels={{ ordered: "Save changes" }}
          initial={{ supplier_id: po.supplier_id, order_date: po.order_date, expected_date: po.expected_date ?? "", bill_no: po.bill_no ?? "", notes: po.notes ?? "",
            lines: po.items.map((i) => ({ variant_id: i.variant_id, display_name: i.display_name, sku: i.sku, unit_code: i.unit_code, qty_ordered: String(Number(i.qty_ordered)), rate: i.rate, last_rate: null })) }}
          onSubmit={async (v) => { await adminApi.updatePurchase(po.id, toPurchaseInput(v)); toast.success("Purchase order saved."); await invalidate(); }} />
      ) : null}

      <h2 className="mb-3 mt-8 text-lg font-semibold">Lines and receiving</h2>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Item</th><th className="p-3 text-right">Ordered</th><th className="p-3 text-right">Received</th><th className="p-3 text-right">Pending</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Amount</th><th className="p-3" /></tr></thead>
          <tbody>{po.items.map((i) => {
            const left = pendingOf(i);
            return (
              <tr key={i.id} className="border-t">
                <td className="p-3"><p className="font-medium">{i.display_name}</p><p className="font-mono text-xs text-muted-foreground">{i.sku}</p></td>
                <td className="p-3 text-right tabular-nums">{formatQty(i.qty_ordered, i.unit_code)}</td>
                <td className="p-3 text-right tabular-nums">{formatQty(i.qty_received, i.unit_code)}</td>
                <td className="p-3 text-right font-semibold tabular-nums">{formatQty(left, i.unit_code)}</td>
                <td className="p-3 text-right tabular-nums">{formatBDT(i.rate, { decimals: true })}</td>
                <td className="p-3 text-right tabular-nums">{formatBDT(i.line_total, { decimals: true })}</td>
                <td className="space-x-1 whitespace-nowrap p-3 text-right">
                  {receivable && toScaled(left) > 0n && <Button size="sm" onClick={() => setReceive({ item_id: i.id, po_no: po.po_no, display_name: i.display_name, unit_code: i.unit_code, qty_pending: left })}>Receive</Button>}
                  {toScaled(i.qty_received) > 0n && <Button size="sm" variant="outline" onClick={() => setRet(i)}>Return</Button>}
                </td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Payments against this PO</h2>
      {po.payments.length ? <ul className="divide-y rounded-2xl border bg-card">{po.payments.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 p-4 text-sm">
          <span className="font-mono">{p.voucher_no} · {p.payment_date} · {METHODS[p.method]}</span>
          <span className="flex items-center gap-3"><b>{formatBDT(p.amount)}</b><Button asChild size="sm" variant="ghost"><Link to="/admin/print/$kind/$id" params={{ kind: "voucher", id: String(p.id) }}>Voucher</Link></Button></span>
        </li>))}</ul> : <p className="text-sm text-muted-foreground">No payments linked to this PO yet.</p>}

      <ReceiveDialog target={receive} onClose={() => setReceive(null)} onDone={invalidate} />
      <PurchaseReturnDialog target={ret ? { item_id: ret.id, display_name: ret.display_name, unit_code: ret.unit_code, qty_received: ret.qty_received } : null} onClose={() => setRet(null)} onDone={invalidate} />
      <SupplierPaymentDialog open={paying} onOpenChange={setPaying} supplierId={po.supplier_id} supplierName={po.supplier_name} payable={po.supplier.payable_balance} purchases={[po]} defaultPurchaseId={po.id} onDone={invalidate} />
    </>
  );
}
