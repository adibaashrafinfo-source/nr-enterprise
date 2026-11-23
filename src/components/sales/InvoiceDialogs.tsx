import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/nre/FormDialog";
import { Field, apiFieldErrors } from "@/components/catalogue/shared";
import { adminApi } from "@/lib/api";
import { formatBDT, formatQty, subMoney } from "@/lib/money";
import type { InvoiceDetail, Payment, PaymentMethod, SalesLine } from "@/lib/types";
import { today } from "./SalesDocForm";

export const METHODS: Record<Exclude<PaymentMethod, "credit_note">, string> = { cash: "Cash", bkash: "bKash", nagad: "Nagad", bank: "Bank", cheque: "Cheque" };
type Done = () => void | Promise<unknown>;

export function PaymentDialog({ open, onOpenChange, invoice, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; invoice: InvoiceDetail; onDone: Done }) {
  const [f, setF] = useState({ payment_date: today(), method: "cash" as PaymentMethod, reference_no: "", amount: "", note: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  // Reset only when the dialog opens; the balance changes after saving and must not wipe the receipt.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) { setF({ payment_date: today(), method: "cash", reference_no: "", amount: invoice.balance, note: "" }); setErrors({}); setReceipt(null); } }, [open]);
  const submit = async () => {
    setSaving(true); setErrors({});
    try { const p = await adminApi.receivePayment(invoice.id, { ...f, reference_no: f.reference_no || null, note: f.note || null }); setReceipt(p); toast.success(`Payment saved — receipt ${p.receipt_no}.`); await onDone(); }
    catch (e) { setErrors(apiFieldErrors(e)); } finally { setSaving(false); }
  };
  if (receipt) return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Payment received" onSubmit={() => onOpenChange(false)} submitLabel="Done">
      <div className="rounded-2xl border bg-secondary/5 p-4 text-center">
        <p className="text-sm text-muted-foreground">Receipt number</p><p className="text-2xl font-bold" data-testid="receipt-no">{receipt.receipt_no}</p>
        <p className="mt-1 text-sm">{formatBDT(receipt.amount)} · {METHODS[receipt.method as keyof typeof METHODS] ?? receipt.method}</p>
      </div>
      <Button asChild variant="outline" className="w-full"><Link to="/admin/print/$kind/$id" params={{ kind: "receipt", id: String(receipt.id) }}>Print money receipt</Link></Button>
    </FormDialog>
  );
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Receive payment — ${invoice.invoice_no}`} description={`Balance due: ${formatBDT(invoice.balance, { decimals: true })}`} onSubmit={() => void submit()} submitting={saving} submitLabel="Save payment">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="pay-date" label="Date" error={errors["payment_date"]}><Input id="pay-date" type="date" value={f.payment_date} onChange={(e) => setF({ ...f, payment_date: e.target.value })} /></Field>
        <Field id="pay-method" label="Method" error={errors["method"]}>
          <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v as PaymentMethod })}><SelectTrigger id="pay-method"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(METHODS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
        </Field>
        <Field id="pay-amount" label="Amount (৳) *" error={errors["amount"]}><Input id="pay-amount" inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field id="pay-ref" label="Reference no." hint="Transaction ID or cheque no."><Input id="pay-ref" value={f.reference_no} onChange={(e) => setF({ ...f, reference_no: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field id="pay-note" label="Note"><Textarea id="pay-note" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field></div>
      </div>
    </FormDialog>
  );
}

export function CancelDialog({ open, onOpenChange, invoice, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; invoice: InvoiceDetail; onDone: Done }) {
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setReason(""); setErrors({}); } }, [open]);
  const submit = async () => {
    setSaving(true); setErrors({});
    try { await adminApi.cancelInvoice(invoice.id, reason); toast.success("Invoice cancelled. Stock has been put back."); onOpenChange(false); await onDone(); }
    catch (e) { const f = apiFieldErrors(e); setErrors(Object.keys(f).length ? f : { reason: e instanceof Error ? e.message : "" }); } finally { setSaving(false); }
  };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Cancel ${invoice.invoice_no}`} description="Stock on this invoice goes back into the store. This cannot be undone." onSubmit={() => void submit()} submitting={saving} submitLabel="Cancel invoice">
      <Field id="cancel-reason" label="Reason *" error={errors["reason"]}><Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </FormDialog>
  );
}

export function ReturnDialog({ line, onOpenChange, onDone }: { line: SalesLine | null; onOpenChange: (o: boolean) => void; onDone: Done }) {
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (line) { setQty(""); setNote(""); setErrors({}); } }, [line]);
  if (!line) return null;
  const left = subMoney(line.quantity, line.returned_qty ?? "0");
  const submit = async () => {
    setSaving(true); setErrors({});
    try { const r = await adminApi.returnInvoiceItem(line.id!, qty.trim(), note); toast.success(`Return saved. Credit note ${r.credit_note.receipt_no} for ${formatBDT(r.credit_note.amount)}.`); onOpenChange(false); await onDone(); }
    catch (e) { setErrors(apiFieldErrors(e)); } finally { setSaving(false); }
  };
  return (
    <FormDialog open onOpenChange={onOpenChange} title="Sales return" description={`${line.description} — up to ${formatQty(left, line.unit_code)} can be returned.`} onSubmit={() => void submit()} submitting={saving} submitLabel="Save return">
      <Field id="ret-qty" label="Quantity returned *" error={errors["quantity"]}><Input id="ret-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} /></Field>
      <Field id="ret-note" label="Note"><Textarea id="ret-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </FormDialog>
  );
}

export function ChallanDialog({ open, onOpenChange, invoice, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; invoice: InvoiceDetail; onDone: Done }) {
  const [f, setF] = useState({ challan_date: today(), vehicle_no: "", driver_name: "", received_by: "", note: "" });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  useEffect(() => { if (open) setF({ challan_date: today(), vehicle_no: "", driver_name: "", received_by: "", note: "" }); }, [open]);
  const submit = async () => {
    setSaving(true);
    try {
      const n = (s: string) => s.trim() || null;
      const ch = await adminApi.createChallan(invoice.id, { challan_date: f.challan_date, vehicle_no: n(f.vehicle_no), driver_name: n(f.driver_name), received_by: n(f.received_by), note: n(f.note) });
      toast.success(`Delivery challan ${ch.challan_no} created.`); onOpenChange(false); await onDone();
      void navigate({ to: "/admin/print/$kind/$id", params: { kind: "challan", id: String(ch.id) } });
    } catch (e) { apiFieldErrors(e); } finally { setSaving(false); }
  };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={`Delivery challan — ${invoice.invoice_no}`} description="The printed challan lists the items without prices." onSubmit={() => void submit()} submitting={saving} submitLabel="Create challan">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="ch-date" label="Date"><Input id="ch-date" type="date" value={f.challan_date} onChange={(e) => setF({ ...f, challan_date: e.target.value })} /></Field>
        <Field id="ch-vehicle" label="Vehicle no."><Input id="ch-vehicle" value={f.vehicle_no} onChange={(e) => setF({ ...f, vehicle_no: e.target.value })} /></Field>
        <Field id="ch-driver" label="Driver"><Input id="ch-driver" value={f.driver_name} onChange={(e) => setF({ ...f, driver_name: e.target.value })} /></Field>
        <Field id="ch-received" label="Received by"><Input id="ch-received" value={f.received_by} onChange={(e) => setF({ ...f, received_by: e.target.value })} /></Field>
        <div className="sm:col-span-2"><Field id="ch-note" label="Note"><Textarea id="ch-note" rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field></div>
      </div>
    </FormDialog>
  );
}
