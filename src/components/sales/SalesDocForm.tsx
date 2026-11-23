import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Field, apiFieldErrors, useCatalogueAccess } from "@/components/catalogue/shared";
import { addMoney, formatBDT, previewLineAmount, subMoney, toScaled } from "@/lib/money";
import { customersQuery } from "@/lib/queries";
import type { SalesLine } from "@/lib/types";
import { LinesEditor, emptyLine } from "./LinesEditor";

export interface DocValues { customer_id: number; date: string; second_date: string | null; buyer_ref: string | null; po_no: string | null; style_no: string | null; discount: string; notes: string | null; items: SalesLine[] }
export const today = () => new Date().toISOString().slice(0, 10);
export const newDoc = (customerId = 0): DocValues => ({ customer_id: customerId, date: today(), second_date: null, buyer_ref: null, po_no: null, style_no: null, discount: "0", notes: null, items: [emptyLine()] });
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

/** Header + lines + totals preview for sales orders and invoices. */
export function SalesDocForm({ kind, initial, taxRate = "0", submitLabel, onSubmit }: {
  kind: "order" | "invoice"; initial: DocValues; taxRate?: string; submitLabel: string; onSubmit: (v: DocValues) => Promise<unknown>;
}) {
  const { userId, role, ready } = useCatalogueAccess();
  const customers = useQuery({ ...customersQuery(userId, role, { per_page: 100 }), enabled: ready });
  const [v, setV] = useState<DocValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const cust = customers.data?.data.find((c) => c.id === v.customer_id);
  const text = (k: "buyer_ref" | "po_no" | "style_no" | "notes") => ({ id: `doc-${k}`, value: v[k] ?? "", onChange: (e: { target: { value: string } }) => setV((x) => ({ ...x, [k]: e.target.value })) });

  const lines = v.items.filter((l) => l.description || l.variant_id);
  const subtotal = addMoney(...lines.map((l) => (l.quantity && l.rate ? previewLineAmount(l.quantity, l.rate, l.discount_percent || "0") : "0")));
  const net = toScaled(subtotal) > toScaled(v.discount || "0") ? subMoney(subtotal, v.discount || "0") : "0.00";
  const tax = toScaled(taxRate) > 0n ? previewLineAmount(net, (Number(taxRate) / 100).toFixed(4)) : "0.00";

  const submit = async () => {
    setSaving(true); setErrors({});
    try { await onSubmit({ ...v, items: lines }); } catch (e) { setErrors(apiFieldErrors(e)); } finally { setSaving(false); }
  };

  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <div className="grid gap-4 rounded-2xl border bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="doc-customer" label="Customer *" error={errors["customer_id"]}>
          <Select value={v.customer_id ? String(v.customer_id) : ""} onValueChange={(c) => setV((x) => ({ ...x, customer_id: Number(c) }))}>
            <SelectTrigger id="doc-customer" aria-label="Customer"><SelectValue placeholder="Choose a customer" /></SelectTrigger>
            <SelectContent>{(customers.data?.data ?? []).filter((c) => c.is_active || c.id === v.customer_id).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name} · {c.code}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field id="doc-date" label={kind === "order" ? "Order date" : "Invoice date"} error={errors["invoice_date"]}><Input id="doc-date" type="date" value={v.date} onChange={(e) => setV((x) => ({ ...x, date: e.target.value }))} /></Field>
        <Field id="doc-second" label={kind === "order" ? "Delivery date" : "Due date"} hint={kind === "invoice" && !v.second_date && cust ? `Leave empty for ${addDays(v.date, cust.credit_days)} (${cust.credit_days} credit days).` : undefined}>
          <Input id="doc-second" type="date" value={v.second_date ?? ""} onChange={(e) => setV((x) => ({ ...x, second_date: e.target.value || null }))} />
        </Field>
        <Field id="doc-buyer_ref" label="Buyer / brand"><Input {...text("buyer_ref")} placeholder="e.g. H&M" /></Field>
        <Field id="doc-po_no" label="Buyer PO no."><Input {...text("po_no")} /></Field>
        <Field id="doc-style_no" label="Style no."><Input {...text("style_no")} /></Field>
      </div>
      <LinesEditor lines={v.items} onChange={(items) => setV((x) => ({ ...x, items }))} errors={errors} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Field id="doc-notes" label="Notes"><Textarea {...text("notes")} rows={3} /></Field>
        <div className="space-y-2 rounded-2xl border bg-card p-5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatBDT(subtotal, { decimals: true })}</span></div>
          <div className="flex items-center justify-between gap-3"><label htmlFor="doc-discount" className="text-muted-foreground">Discount (৳)</label><Input id="doc-discount" inputMode="decimal" className="h-8 w-28 text-right" value={v.discount} onChange={(e) => setV((x) => ({ ...x, discount: e.target.value }))} /></div>
          {errors["discount"] && <p className="text-right text-xs text-destructive">{errors["discount"]}</p>}
          {toScaled(taxRate) > 0n && <div className="flex justify-between"><span className="text-muted-foreground">VAT {taxRate}%</span><span className="tabular-nums">{formatBDT(tax, { decimals: true })}</span></div>}
          <div className="flex justify-between border-t pt-2 text-base font-bold"><span>Total</span><span className="tabular-nums" data-testid="doc-total">{formatBDT(addMoney(net, tax), { decimals: true })}</span></div>
          <p className="text-xs text-muted-foreground">Preview only — the saved total is worked out by the system.</p>
        </div>
      </div>
      <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? "Saving…" : submitLabel}</Button></div>
    </form>
  );
}
