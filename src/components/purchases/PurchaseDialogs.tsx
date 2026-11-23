import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/nre/FormDialog";
import { Field, apiFieldErrors } from "@/components/catalogue/shared";
import { METHODS } from "@/components/sales/InvoiceDialogs";
import { today } from "@/components/sales/SalesDocForm";
import { adminApi } from "@/lib/api";
import { formatBDT, formatQty } from "@/lib/money";
import type { PaidMethod, PurchaseOrder, SupplierPayment } from "@/lib/types";

type Done = () => void | Promise<unknown>;
export interface ReceiveTarget { item_id: number; po_no: string; display_name: string; unit_code: string; qty_pending: string }

/** Receive goods for one PO line. Works for every role; shows quantities only. */
export function ReceiveDialog({ target, onClose, onDone }: { target: ReceiveTarget | null; onClose: () => void; onDone: Done }) {
  const [f, setF] = useState({ quantity: "", batch_no: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (target) { setF({ quantity: String(Number(target.qty_pending)), batch_no: "", note: "" }); setErrors({}); } }, [target]);
  if (!target) return null;
  const submit = async () => {
    setSaving(true); setErrors({});
    try {
      const r = await adminApi.receiveItem(target.item_id, { quantity: f.quantity, batch_no: f.batch_no || null, note: f.note || null });
      toast.success(`Received ${formatQty(f.quantity, target.unit_code)}. ${target.po_no} is now ${r.status === "received" ? "Received" : "Partial"}.`);
      await onDone(); onClose();
    } catch (e) { setErrors(apiFieldErrors(e)); } finally { setSaving(false); }
  };
  return (
    <FormDialog open onOpenChange={(o) => { if (!o) onClose(); }} title="Receive goods" description={`${target.po_no} · ${target.display_name}`} onSubmit={() => void submit()} submitLabel="Receive into stock" submitting={saving}>
      <p className="rounded-xl bg-muted p-3 text-sm">Pending: <strong>{formatQty(target.qty_pending, target.unit_code)}</strong></p>
      <Field id="rc-qty" label="Quantity received *" error={errors["quantity"]}><Input id="rc-qty" inputMode="decimal" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
      <Field id="rc-batch" label="Batch / lot (optional)"><Input id="rc-batch" value={f.batch_no} onChange={(e) => setF({ ...f, batch_no: e.target.value })} /></Field>
      <Field id="rc-note" label="Note"><Textarea id="rc-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
    </FormDialog>
  );
}

export function PurchaseReturnDialog({ target, onClose, onDone }: { target: { item_id: number; display_name: string; unit_code: string; qty_received: string } | null; onClose: () => void; onDone: Done }) {
  const [f, setF] = useState({ quantity: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (target) { setF({ quantity: "", note: "" }); setErrors({}); } }, [target]);
  if (!target) return null;
  const submit = async () => {
    setSaving(true); setErrors({});
    try { await adminApi.returnPurchaseItem(target.item_id, { quantity: f.quantity, note: f.note || null }); toast.success("Return saved and stock reduced."); await onDone(); onClose(); }
    catch (e) { setErrors(apiFieldErrors(e)); } finally { setSaving(false); }
  };
  return (
    <FormDialog open onOpenChange={(o) => { if (!o) onClose(); }} title="Return to supplier" description={target.display_name} onSubmit={() => void submit()} submitLabel="Save return" submitting={saving}>
      <p className="rounded-xl bg-muted p-3 text-sm">Received so far: <strong>{formatQty(target.qty_received, target.unit_code)}</strong></p>
      <Field id="rt-qty" label="Quantity to return *" error={errors["quantity"]}><Input id="rt-qty" inputMode="decimal" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /></Field>
      <Field id="rt-note" label="Reason"><Textarea id="rt-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
    </FormDialog>
  );
}

export function SupplierPaymentDialog({ open, onOpenChange, supplierId, supplierName, payable, purchases, defaultPurchaseId, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; supplierId: number; supplierName: string; payable: string; purchases: Pick<PurchaseOrder, "id" | "po_no">[]; defaultPurchaseId?: number; onDone: Done;
}) {
  const [f, setF] = useState({ payment_date: today(), method: "cash" as PaidMethod, reference_no: "", amount: "", purchase_id: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [voucher, setVoucher] = useState<SupplierPayment | null>(null);
  // Reset only on open so the voucher stays visible after the payable changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) { setF({ payment_date: today(), method: "cash", reference_no: "", amount: "", purchase_id: defaultPurchaseId ? String(defaultPurchaseId) : "", note: "" }); setErrors({}); setVoucher(null); } }, [open]);
  const submit = async () => {
    setSaving(true); setErrors({});
    try {
      const p = await adminApi.paySupplier(supplierId, { payment_date: f.payment_date, method: f.method, reference_no: f.reference_no || null, amount: f.amount, purchase_id: f.purchase_id ? Number(f.purchase_id) : null, note: f.note || null });
      setVoucher(p); toast.success(`Payment saved — voucher ${p.voucher_no}.`); await onDone();
    } catch (e) { setErrors(apiFieldErrors(e)); } finally { setSaving(false); }
  };
  if (voucher) return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Payment made" onSubmit={() => onOpenChange(false)} submitLabel="Done">
      <div className="rounded-2xl border bg-secondary/5 p-4 text-center">
        <p className="text-sm text-muted-foreground">Voucher number</p><p className="text-2xl font-bold" data-testid="voucher-no">{voucher.voucher_no}</p>
        <p className="mt-1 text-sm">{formatBDT(voucher.amount)} · {METHODS[voucher.method]} · {supplierName}</p>
      </div>
      <Button asChild variant="outline" className="w-full"><Link to="/admin/print/$kind/$id" params={{ kind: "voucher", id: String(voucher.id) }}>Print voucher</Link></Button>
    </FormDialog>
  );
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Pay supplier" description={`${supplierName} · Payable ${formatBDT(payable)}`} onSubmit={() => void submit()} submitLabel="Save payment" submitting={saving}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="sp-date" label="Date"><Input id="sp-date" type="date" value={f.payment_date} onChange={(e) => setF({ ...f, payment_date: e.target.value })} /></Field>
        <Field id="sp-method" label="Method" error={errors["method"]}>
          <select id="sp-method" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.method} onChange={(e) => setF({ ...f, method: e.target.value as PaidMethod })}>
            {Object.entries(METHODS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </Field>
        <Field id="sp-amount" label="Amount (৳) *" error={errors["amount"]}><Input id="sp-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field id="sp-ref" label="Reference / cheque no."><Input id="sp-ref" value={f.reference_no} onChange={(e) => setF({ ...f, reference_no: e.target.value })} /></Field>
      </div>
      <Field id="sp-po" label="Against PO (optional)" error={errors["purchase_id"]}>
        <select id="sp-po" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={f.purchase_id} onChange={(e) => setF({ ...f, purchase_id: e.target.value })}>
          <option value="">No specific PO</option>
          {purchases.map((p) => <option key={p.id} value={p.id}>{p.po_no}</option>)}
        </select>
      </Field>
      <Field id="sp-note" label="Note"><Textarea id="sp-note" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
    </FormDialog>
  );
}
