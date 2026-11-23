import type { InvoiceInput, SalesLine, SalesOrderInput } from "@/lib/types";
import type { DocValues } from "./SalesDocForm";

const clean = (items: SalesLine[]) => items.map(({ variant_id, description, unit_code, quantity, rate, discount_percent }) => ({ variant_id, description, unit_code, quantity: quantity.trim(), rate: rate.trim(), discount_percent: discount_percent.trim() || "0" }));
const n = (s: string | null) => (s && s.trim() ? s.trim() : null);
export const toOrderInput = (v: DocValues): SalesOrderInput => ({ customer_id: v.customer_id, order_date: v.date, delivery_date: v.second_date, buyer_ref: n(v.buyer_ref), po_no: n(v.po_no), style_no: n(v.style_no), discount: v.discount.trim() || "0", notes: n(v.notes), items: clean(v.items) });
export const toInvoiceInput = (v: DocValues): InvoiceInput => ({ customer_id: v.customer_id, invoice_date: v.date, due_date: v.second_date, buyer_ref: n(v.buyer_ref), po_no: n(v.po_no), style_no: n(v.style_no), discount: v.discount.trim() || "0", notes: n(v.notes), items: clean(v.items) });
export const fromDoc = (d: { customer_id: number; buyer_ref?: string | null; po_no?: string | null; style_no?: string | null; discount: string; notes?: string | null; items?: SalesLine[] }, date: string, second: string | null | undefined): DocValues => ({
  customer_id: d.customer_id, date, second_date: second ?? null, buyer_ref: d.buyer_ref ?? null, po_no: d.po_no ?? null, style_no: d.style_no ?? null, discount: d.discount, notes: d.notes ?? null,
  items: (d.items ?? []).map((l) => ({ ...l, quantity: String(Number(l.quantity)), rate: l.rate, discount_percent: String(Number(l.discount_percent)) })),
});
