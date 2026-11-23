import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Mail, MessageCircle, Printer, Trash2, Truck, Undo2, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/nre/EmptyState";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { PageHeader } from "@/components/nre/PageHeader";
import { StatusPill } from "@/components/nre/StatusPill";
import { apiFieldErrors, useCatalogueAccess } from "@/components/catalogue/shared";
import { CancelDialog, ChallanDialog, METHODS, PaymentDialog, ReturnDialog } from "@/components/sales/InvoiceDialogs";
import { SalesDocForm } from "@/components/sales/SalesDocForm";
import { fromDoc, toInvoiceInput } from "@/components/sales/doc-convert";
import { adminApi, ApiError } from "@/lib/api";
import { formatBDT, formatQty, toScaled } from "@/lib/money";
import { invoiceQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";
import type { SalesLine } from "@/lib/types";

export const Route = createFileRoute("/admin/invoices/$invoiceId")({
  head: () => noIndexPageHead("Invoice — NR Enterprise Admin", "View, confirm, collect payment and print an invoice."),
  component: InvoicePage,
});

function InvoicePage() {
  const id = Number(Route.useParams().invoiceId);
  const { userId, role, ready, canEdit, invalidate } = useCatalogueAccess();
  const navigate = useNavigate();
  const q = useQuery({ ...invoiceQuery(userId, role, id), enabled: ready && id > 0 });
  const [dialog, setDialog] = useState<"" | "pay" | "cancel" | "challan">("");
  const [returning, setReturning] = useState<SalesLine | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const inv = q.data;
  if (q.isLoading) return <LoadingSkeleton rows={6} />;
  if (!inv) return <EmptyState title="Invoice not found" />;
  const confirmed = inv.status === "due" || inv.status === "partial" || inv.status === "paid";

  const confirm = async () => {
    setConfirmError(null);
    try {
      const r = await adminApi.confirmInvoice(inv.id);
      toast.success(`${inv.invoice_no} confirmed. Stock has been taken out.`);
      r.warnings.forEach((w) => toast.warning(w));
      await invalidate();
    } catch (e) { if (e instanceof ApiError) { setConfirmError(e.message); toast.error(e.message); } else apiFieldErrors(e); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete draft ${inv.invoice_no}?`)) return;
    try { await adminApi.deleteInvoice(inv.id); toast.success("Draft deleted."); await invalidate(); void navigate({ to: "/admin/invoices", search: {} }); } catch (e) { apiFieldErrors(e); }
  };
  const removePayment = async (pid: number, no: string) => {
    if (!window.confirm(`Delete payment ${no}?`)) return;
    try { await adminApi.deletePayment(pid); toast.success("Payment deleted."); await invalidate(); } catch (e) { apiFieldErrors(e); }
  };
  const shareText = `${inv.company.company_name} — Invoice ${inv.invoice_no}\nTotal: ${formatBDT(inv.total, { decimals: true })}\nBalance due: ${formatBDT(inv.balance, { decimals: true })}`;
  const waNumber = (inv.customer.whatsapp ?? inv.customer.phone ?? "").replace(/\D/g, "");
  const print = (kind: "invoice" | "challan" | "receipt", pid: number) => ({ to: "/admin/print/$kind/$id" as const, params: { kind, id: String(pid) } });

  return (
    <>
      <PageHeader title={`${inv.invoice_no} · ${inv.customer_name}`} description={`Date ${inv.invoice_date}${inv.due_date ? ` · Due ${inv.due_date}` : ""}${inv.order_id ? " · from a sales order" : ""}`}
        actions={<>
          <StatusPill status={inv.status} />
          <Button asChild variant="outline"><Link {...print("invoice", inv.id)}><Printer className="size-4" /> Print</Link></Button>
          {inv.status === "draft" && <Button onClick={() => void confirm()}><CheckCircle2 className="size-4" /> Confirm</Button>}
          {inv.status === "draft" && canEdit && <Button variant="ghost" size="icon" aria-label="Delete draft" onClick={() => void remove()}><Trash2 className="size-4" /></Button>}
          {confirmed && toScaled(inv.balance) > 0n && <Button onClick={() => setDialog("pay")}><Wallet className="size-4" /> Receive payment</Button>}
          {confirmed && <Button variant="outline" onClick={() => setDialog("challan")}><Truck className="size-4" /> Delivery challan</Button>}
          {canEdit && inv.status !== "cancelled" && <Button variant="ghost" onClick={() => setDialog("cancel")}><XCircle className="size-4" /> Cancel</Button>}
        </>} />
      {confirmError && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">{confirmError}</div>}

      {inv.status === "draft" ? (
        <SalesDocForm key={`${inv.id}-${inv.total}`} kind="invoice" taxRate={inv.tax_rate ?? "0"} initial={fromDoc(inv, inv.invoice_date, inv.due_date)} submitLabel="Save draft"
          onSubmit={async (v) => { await adminApi.updateInvoice(inv.id, toInvoiceInput(v)); toast.success("Draft saved."); setConfirmError(null); await invalidate(); }} />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-2 rounded-2xl border bg-card p-4 text-sm sm:grid-cols-3">
            <p><span className="text-muted-foreground">Buyer:</span> {inv.buyer_ref ?? "—"}</p><p><span className="text-muted-foreground">PO:</span> {inv.po_no ?? "—"}</p><p><span className="text-muted-foreground">Style:</span> {inv.style_no ?? "—"}</p>
          </div>
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">#</th><th className="p-3">Item</th><th className="p-3 text-right">Qty</th><th className="p-3">Unit</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Disc %</th><th className="p-3 text-right">Amount</th><th className="p-3" /></tr></thead>
              <tbody>{inv.items.map((l, i) => (
                <tr key={l.id} className="border-t">
                  <td className="p-3">{i + 1}</td><td className="p-3">{l.description}{l.returned_qty && toScaled(l.returned_qty) > 0n && <span className="block text-xs text-muted-foreground">Returned: {formatQty(l.returned_qty)}</span>}</td>
                  <td className="p-3 text-right tabular-nums">{formatQty(l.quantity)}</td><td className="p-3">{l.unit_code}</td><td className="p-3 text-right tabular-nums">{l.rate}</td><td className="p-3 text-right">{Number(l.discount_percent)}</td>
                  <td className="p-3 text-right tabular-nums">{formatBDT(l.amount, { decimals: true })}</td>
                  <td className="p-3 text-right">{canEdit && confirmed && toScaled(l.quantity) > toScaled(l.returned_qty ?? "0") && <Button size="sm" variant="ghost" onClick={() => setReturning(l)}><Undo2 className="size-4" /> Return</Button>}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-4">
                <h2 className="mb-2 font-semibold">Payments</h2>
                {inv.payments.length ? <ul className="divide-y text-sm">{inv.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span><span className="font-mono">{p.receipt_no}</span> · {p.payment_date} · {p.method === "credit_note" ? "Credit note" : METHODS[p.method]}{p.reference_no ? ` · ${p.reference_no}` : ""}</span>
                    <span className="flex items-center gap-1"><span className="font-semibold tabular-nums">{formatBDT(p.amount)}</span>
                      <Button asChild size="icon" variant="ghost" aria-label={`Print ${p.receipt_no}`}><Link {...print("receipt", p.id)}><Printer className="size-4" /></Link></Button>
                      {canEdit && <Button size="icon" variant="ghost" aria-label={`Delete ${p.receipt_no}`} onClick={() => void removePayment(p.id, p.receipt_no)}><Trash2 className="size-4" /></Button>}</span>
                  </li>))}</ul> : <p className="text-sm text-muted-foreground">No payments yet.</p>}
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <h2 className="mb-2 font-semibold">Delivery challans</h2>
                {inv.challans.length ? <ul className="space-y-1 text-sm">{inv.challans.map((c) => <li key={c.id}><Link {...print("challan", c.id)} className="font-mono text-secondary hover:underline">{c.challan_no}</Link> · {c.challan_date}{c.vehicle_no ? ` · ${c.vehicle_no}` : ""}</li>)}</ul> : <p className="text-sm text-muted-foreground">No challans yet.</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline"><a href={`https://wa.me/${waNumber}?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"><MessageCircle className="size-4" /> Share on WhatsApp</a></Button>
                <Button asChild variant="outline"><a href={`mailto:${inv.customer.email ?? ""}?subject=${encodeURIComponent(`Invoice ${inv.invoice_no}`)}&body=${encodeURIComponent(shareText)}`}><Mail className="size-4" /> Email</a></Button>
              </div>
              {inv.notes && <p className="whitespace-pre-wrap rounded-2xl border bg-card p-4 text-sm">{inv.notes}</p>}
            </div>
            <div className="space-y-2 self-start rounded-2xl border bg-card p-5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatBDT(inv.subtotal, { decimals: true })}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="tabular-nums">−{formatBDT(inv.discount, { decimals: true })}</span></div>
              {toScaled(inv.tax_amount) > 0n && <div className="flex justify-between"><span className="text-muted-foreground">VAT {inv.tax_rate}%</span><span className="tabular-nums">{formatBDT(inv.tax_amount, { decimals: true })}</span></div>}
              <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span className="tabular-nums">{formatBDT(inv.total, { decimals: true })}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="tabular-nums">{formatBDT(inv.paid, { decimals: true })}</span></div>
              <div className="flex justify-between text-base font-bold"><span>Balance</span><span className="tabular-nums" data-testid="invoice-balance">{formatBDT(inv.balance, { decimals: true })}</span></div>
            </div>
          </div>
        </div>
      )}
      <PaymentDialog open={dialog === "pay"} onOpenChange={(o) => setDialog(o ? "pay" : "")} invoice={inv} onDone={invalidate} />
      <CancelDialog open={dialog === "cancel"} onOpenChange={(o) => setDialog(o ? "cancel" : "")} invoice={inv} onDone={invalidate} />
      <ChallanDialog open={dialog === "challan"} onOpenChange={(o) => setDialog(o ? "challan" : "")} invoice={inv} onDone={invalidate} />
      <ReturnDialog line={returning} onOpenChange={(o) => { if (!o) setReturning(null); }} onDone={invalidate} />
    </>
  );
}
