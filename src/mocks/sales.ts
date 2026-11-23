// Mock Sales group (docs/NRE_BACKEND_API.md 4.3-4.8): totals, draft-only edits, stock check on confirm, payment status sync.
import { ApiError } from "@/lib/api-error";
import { addMoney, addQty, formatQty, previewLineAmount, subMoney, toScaled } from "@/lib/money";
import type { Challan, ChallanInput, CompanyBlock, Invoice, InvoiceDetail, InvoiceInput, OrderStatus, Payment, PaymentInput, PaymentMethod, SalesLine, SalesOrder, SalesOrderInput, User, VariantPick } from "@/lib/types";
import { customerPayments, setOrderCounter } from "./parties";
import * as db from "./seed";
import { lastRate } from "./purchases";
import { findEntry, onHand, post } from "./stock";
import { variantEntries } from "./catalogue";

type Query = Record<string, string | number | undefined>;
export const orders: SalesOrder[] = [];
export const challans: Challan[] = [];
setOrderCounter((id) => orders.filter((o) => o.customer_id === id).length);
let lineId = 1000;

export const company: CompanyBlock = {
  company_name: db.settings.company_name, address: db.settings.address, phones: db.settings.phones, emails: db.settings.emails,
  logo_url: db.settings.logo_url, whatsapp: db.settings.whatsapp, bin: null, tax_enabled: false, tax_rate: "0.00",
  bank_details: "Bank: (set in Settings) · bKash: (set in Settings)", footer: "Thank you for your business.",
};

const METHODS: PaymentMethod[] = ["cash", "bkash", "nagad", "bank", "cheque"];
const QTY = /^\d+(\.\d{1,3})?$/; const MONEY = /^\d+(\.\d{1,2})?$/; const DATE = /^\d{4}-\d{2}-\d{2}$/;
const manager = (u: User) => u.role === "admin" || u.role === "manager";
const needManager = (u: User, msg: string) => { if (!manager(u)) throw new ApiError(403, "forbidden", msg); };
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const nextNo = (prefix: string, list: string[]) => `${prefix}-${String(list.reduce((m, x) => Math.max(m, Number(x.split("-")[1]) || 0), 0) + 1).padStart(4, "0")}`;
const paginate = <T,>(list: T[], q: Query) => {
  const page = Math.max(1, Number(q["page"] ?? 1)); const per_page = Math.min(100, Math.max(1, Number(q["per_page"] ?? 25)));
  return { data: list.slice((page - 1) * per_page, page * per_page), meta: { page, per_page, total: list.length } };
};
const customerOf = (id: number) => { const c = db.customers.find((x) => x.id === Number(id)); if (!c) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", { customer_id: "Choose a customer." }); return c; };

function cleanLines(items: unknown): SalesLine[] {
  const list = Array.isArray(items) ? (items as Partial<SalesLine>[]) : [];
  const fields: Record<string, string> = {};
  if (!list.length) fields["items"] = "Add at least one line.";
  const lines = list.map((l, i) => {
    if (!str(l.description)) fields[`items.${i}.description`] = "Description is required.";
    if (!QTY.test(String(l.quantity ?? "")) || toScaled(l.quantity) <= 0n) fields[`items.${i}.quantity`] = "Enter a quantity above 0.";
    if (!MONEY.test(String(l.rate ?? ""))) fields[`items.${i}.rate`] = "Enter a rate.";
    const disc = String(l.discount_percent || "0");
    if (!/^\d+(\.\d{1,2})?$/.test(disc) || Number(disc) > 100) fields[`items.${i}.discount_percent`] = "0 to 100.";
    if (l.variant_id) findEntry(Number(l.variant_id));
    return { id: ++lineId, variant_id: l.variant_id ? Number(l.variant_id) : null, description: str(l.description) ?? "", unit_code: str(l.unit_code) ?? "pcs",
      quantity: addQty(String(l.quantity ?? "0")), rate: Number(l.rate || 0).toFixed(2), discount_percent: Number(disc).toFixed(2), returned_qty: "0.000",
      amount: previewLineAmount(String(l.quantity ?? "0"), String(l.rate ?? "0"), disc) };
  });
  if (Object.keys(fields).length) throw new ApiError(422, "validation_error", fields["items"] ?? "Please fix the highlighted fields.", fields);
  return lines;
}
function totals(items: SalesLine[], discount: string, taxRate: string) {
  const subtotal = addMoney(...items.map((l) => l.amount ?? "0"));
  const net = toScaled(subtotal) > toScaled(discount) ? subMoney(subtotal, discount) : "0.00";
  const tax_amount = toScaled(taxRate) > 0n ? previewLineAmount(net, (Number(taxRate) / 100).toFixed(4)) : "0.00";
  return { subtotal, tax_amount, total: addMoney(net, tax_amount) };
}
function header<T extends SalesOrderInput | InvoiceInput>(b: Partial<T>) {
  const fields: Record<string, string> = {};
  if (!b.customer_id) fields["customer_id"] = "Choose a customer.";
  if (b.discount && !MONEY.test(String(b.discount))) fields["discount"] = "Enter an amount.";
  if (Object.keys(fields).length) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", fields);
  const c = customerOf(Number(b.customer_id));
  return { customer_id: c.id, customer_name: c.name, buyer_ref: str(b.buyer_ref), po_no: str(b.po_no), style_no: str(b.style_no), discount: Number(b.discount || 0).toFixed(2), notes: str(b.notes) };
}
const findInvoice = (id: number) => { const i = db.invoices.find((x) => x.id === id); if (!i) throw new ApiError(404, "not_found", "Invoice not found."); return i; };
const findOrder = (id: number) => { const o = orders.find((x) => x.id === id); if (!o) throw new ApiError(404, "not_found", "Order not found."); return o; };

/** 4.4 payment sync: paid = sum of payments, status from paid vs total. */
function sync(inv: Invoice) {
  inv.paid = addMoney(...customerPayments.filter((p) => p.invoice_id === inv.id).map((p) => p.amount));
  inv.balance = subMoney(inv.total, inv.paid);
  if (inv.status === "due" || inv.status === "partial" || inv.status === "paid")
    inv.status = toScaled(inv.paid) >= toScaled(inv.total) && toScaled(inv.total) > 0n ? "paid" : toScaled(inv.paid) > 0n ? "partial" : "due";
}
function detail(inv: Invoice): InvoiceDetail {
  const c = db.customers.find((x) => x.id === inv.customer_id)!;
  return { ...inv, items: inv.items ?? [], payments: customerPayments.filter((p) => p.invoice_id === inv.id), challans: challans.filter((x) => x.invoice_id === inv.id),
    customer: { ...c, total_sales: "0.00", due_balance: "0.00", invoice_count: 0, order_count: 0 }, company };
}
function addPayment(inv: Invoice, b: Partial<PaymentInput> & { method?: PaymentMethod }, allowCreditNote = false): Payment {
  const p: Payment = { id: customerPayments.length + 1, receipt_no: nextNo("RC", customerPayments.map((x) => x.receipt_no)), payment_date: str(b.payment_date) ?? today(),
    customer_id: inv.customer_id, customer_name: inv.customer_name, invoice_id: inv.id, invoice_no: inv.invoice_no, amount: Number(b.amount).toFixed(2),
    method: allowCreditNote ? "credit_note" : b.method ?? "cash", reference_no: str(b.reference_no), note: str(b.note) };
  customerPayments.push(p); sync(inv);
  return p;
}

export const isSalesPath = (path: string) => /^\/(orders|invoices|invoice-items|payments|challans|variants\/search)(\/|$)/.test(path);

export function salesRequest(method: string, path: string, query: Query, body: unknown, user: User): unknown {
  const route = `${method} ${path}`;
  const b = (body ?? {}) as Record<string, unknown>;
  let m: RegExpMatchArray | null;

  if (route === "GET /variants/search") {
    const term = String(query["q"] ?? "").toLowerCase(); const inStock = String(query["in_stock"] ?? "") === "1";
    const list: VariantPick[] = variantEntries().filter(({ variant }) => variant.is_active).map(({ product, variant }) => ({
      id: variant.id, sku: variant.sku, display_name: `${product.name} — ${variant.name}`, unit_code: product.unit_code, selling_price: variant.selling_price, qty_on_hand: addQty(variant.stock_qty),
      ...(user.role === "staff" ? {} : { last_purchase_rate: lastRate(variant.id) ?? variant.purchase_price ?? null }) }))
      .filter((v) => (!term || `${v.display_name} ${v.sku}`.toLowerCase().includes(term)) && (!inStock || toScaled(v.qty_on_hand) > 0n));
    return { data: list.slice(0, 20) };
  }

  // Orders
  if (route === "GET /orders") {
    const st = String(query["status"] ?? ""); const cid = Number(query["customer_id"] ?? 0); const term = String(query["q"] ?? "").toLowerCase();
    const from = String(query["from"] ?? ""); const to = String(query["to"] ?? "");
    return paginate([...orders].reverse().filter((o) => (!st || o.status === st) && (!cid || o.customer_id === cid) && (!from || o.order_date >= from) && (!to || o.order_date <= to)
      && (!term || `${o.order_no} ${o.customer_name} ${o.po_no ?? ""} ${o.style_no ?? ""}`.toLowerCase().includes(term))), query);
  }
  if (route === "POST /orders") {
    const h = header<SalesOrderInput>(b as Partial<SalesOrderInput>); const items = cleanLines(b["items"]);
    const t = totals(items, h.discount, "0");
    const o: SalesOrder = { ...h, id: orders.length + 1, order_no: nextNo("SO", orders.map((x) => x.order_no)), order_date: str(b["order_date"]) ?? today(), delivery_date: str(b["delivery_date"]), status: "quotation", items, subtotal: t.subtotal, total: t.total, invoice_id: null };
    orders.push(o);
    return { data: o };
  }
  if ((m = path.match(/^\/orders\/(\d+)(\/status|\/convert)?$/))) {
    const o = findOrder(Number(m[1]));
    if (!m[2] && method === "GET") return { data: { ...o, company } };
    if (!m[2] && method === "PUT") {
      if (o.status !== "quotation" && o.status !== "confirmed") throw new ApiError(409, "conflict", "Only quotations and confirmed orders can be edited.");
      const h = header<SalesOrderInput>(b as Partial<SalesOrderInput>); const items = cleanLines(b["items"]); const t = totals(items, h.discount, "0");
      Object.assign(o, h, { order_date: str(b["order_date"]) ?? o.order_date, delivery_date: str(b["delivery_date"]), items, subtotal: t.subtotal, total: t.total });
      return { data: o };
    }
    if (m[2] === "/status" && method === "POST") {
      const next = String(b["status"] ?? "") as OrderStatus;
      const flow: Record<string, OrderStatus> = { quotation: "confirmed", confirmed: "delivered" };
      if (next === "cancelled") { needManager(user, "Only managers and admins can cancel orders."); if (o.status === "invoiced") throw new ApiError(409, "conflict", "An invoiced order cannot be cancelled."); }
      else if (flow[o.status] !== next) throw new ApiError(409, "conflict", `Cannot move an order from ${o.status} to ${next}.`);
      o.status = next;
      return { data: o };
    }
    if (m[2] === "/convert" && method === "POST") {
      if (o.status === "invoiced" || o.status === "cancelled") throw new ApiError(409, "conflict", "This order is already invoiced or cancelled.");
      const existing = db.invoices.find((i) => i.order_id === o.id && i.status === "draft");
      if (existing) return { data: { invoice_id: existing.id } };
      const taxRate = company.tax_enabled ? company.tax_rate : "0.00";
      const items = o.items.map((l) => ({ ...l, id: ++lineId, returned_qty: "0.000" }));
      const t = totals(items, o.discount, taxRate);
      const inv: Invoice = { id: db.invoices.reduce((mx, x) => Math.max(mx, x.id), 0) + 1, invoice_no: nextNo("INV", db.invoices.map((x) => x.invoice_no)), invoice_date: today(), due_date: null,
        customer_id: o.customer_id, customer_name: o.customer_name, status: "draft", order_id: o.id, buyer_ref: o.buyer_ref, po_no: o.po_no, style_no: o.style_no, notes: o.notes,
        discount: o.discount, tax_rate: taxRate, ...t, paid: "0.00", balance: t.total, items };
      db.invoices.push(inv); o.invoice_id = inv.id;
      return { data: { invoice_id: inv.id } };
    }
  }

  // Invoices
  if (route === "GET /invoices") {
    const st = String(query["status"] ?? ""); const cid = Number(query["customer_id"] ?? 0); const term = String(query["q"] ?? "").toLowerCase();
    const from = String(query["from"] ?? ""); const to = String(query["to"] ?? "");
    const list = [...db.invoices].sort((a, c) => c.id - a.id).filter((i) => (!st || i.status === st) && (!cid || i.customer_id === cid) && (!from || i.invoice_date >= from) && (!to || i.invoice_date <= to)
      && (!term || `${i.invoice_no} ${i.customer_name}`.toLowerCase().includes(term)));
    return paginate(list.map(({ items: _i, ...rest }) => rest), query);
  }
  if (route === "POST /invoices") {
    const h = header<InvoiceInput>(b as Partial<InvoiceInput>); const items = cleanLines(b["items"]);
    const taxRate = company.tax_enabled ? company.tax_rate : "0.00"; const t = totals(items, h.discount, taxRate);
    const date = str(b["invoice_date"]) ?? today();
    if (!DATE.test(date)) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", { invoice_date: "Choose a date." });
    const inv: Invoice = { ...h, id: db.invoices.reduce((mx, x) => Math.max(mx, x.id), 0) + 1, invoice_no: nextNo("INV", db.invoices.map((x) => x.invoice_no)), invoice_date: date, due_date: str(b["due_date"]),
      status: "draft", order_id: null, tax_rate: taxRate, ...t, paid: "0.00", balance: t.total, items };
    db.invoices.push(inv);
    return { data: detail(inv) };
  }
  if ((m = path.match(/^\/invoices\/(\d+)(\/confirm|\/cancel|\/payments|\/challans)?$/))) {
    const inv = findInvoice(Number(m[1]));
    if (!m[2] && method === "GET") return { data: detail(inv) };
    if (!m[2] && method === "PUT") {
      if (inv.status !== "draft") throw new ApiError(409, "conflict", "Only draft invoices can be edited.");
      const h = header<InvoiceInput>(b as Partial<InvoiceInput>); const items = cleanLines(b["items"]); const t = totals(items, h.discount, inv.tax_rate ?? "0");
      Object.assign(inv, h, { invoice_date: str(b["invoice_date"]) ?? inv.invoice_date, due_date: str(b["due_date"]), items, ...t, paid: "0.00", balance: t.total });
      return { data: detail(inv) };
    }
    if (!m[2] && method === "DELETE") {
      needManager(user, "Only managers and admins can delete invoices.");
      if (inv.status !== "draft") throw new ApiError(409, "conflict", "Only draft invoices can be deleted.");
      db.invoices.splice(db.invoices.indexOf(inv), 1);
      return { data: { ok: true } };
    }
    if (m[2] === "/confirm") {
      if (inv.status !== "draft") throw new ApiError(409, "conflict", "Only draft invoices can be confirmed.");
      const items = inv.items ?? [];
      if (!items.length) throw new ApiError(409, "conflict", "Add at least one line before confirming.");
      const stocked = items.filter((l) => l.variant_id).sort((a, c) => a.variant_id! - c.variant_id!);
      const need = new Map<number, string>();
      for (const l of stocked) need.set(l.variant_id!, addQty(need.get(l.variant_id!) ?? "0", l.quantity));
      for (const l of stocked) {
        const avail = onHand(l.variant_id!);
        if (toScaled(avail) < toScaled(need.get(l.variant_id!)!))
          throw new ApiError(409, "STOCK_SHORT", `Insufficient stock for "${l.description}": available ${formatQty(avail)}, needed ${formatQty(need.get(l.variant_id!)!)}`, { quantity: `Only ${formatQty(avail)} in stock.` });
      }
      for (const l of stocked) post(user, l.variant_id!, "sale_out", `-${l.quantity}`, `Invoice ${inv.invoice_no}`, { reference_type: "invoice", reference_id: inv.id, buyer: inv.buyer_ref ?? null, style_no: inv.style_no ?? null });
      const c = db.customers.find((x) => x.id === inv.customer_id)!;
      inv.due_date = inv.due_date ?? addDays(inv.invoice_date, c.credit_days);
      inv.status = "due"; sync(inv);
      if (inv.order_id) { const o = orders.find((x) => x.id === inv.order_id); if (o) o.status = "invoiced"; }
      const warnings: string[] = [];
      if (toScaled(c.credit_limit) > 0n) {
        const due = subMoney(addMoney(c.opening_balance, ...db.invoices.filter((i) => i.customer_id === c.id && ["due", "partial", "paid"].includes(i.status)).map((i) => i.total)), addMoney(...customerPayments.filter((p) => p.customer_id === c.id).map((p) => p.amount)));
        if (toScaled(due) > toScaled(c.credit_limit)) warnings.push(`${c.name} is now over their credit limit (due ${due}, limit ${c.credit_limit}).`);
      }
      return { data: { ...detail(inv), warnings } };
    }
    if (m[2] === "/cancel") {
      needManager(user, "Only managers and admins can cancel invoices.");
      const reason = str(b["reason"]);
      if (!reason) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", { reason: "A reason is required." });
      if (inv.status === "cancelled") throw new ApiError(409, "conflict", "This invoice is already cancelled.");
      if (customerPayments.some((p) => p.invoice_id === inv.id)) throw new ApiError(409, "HAS_PAYMENTS", "Invoice has payments. Remove or reassign them first");
      if (inv.status !== "draft") for (const l of inv.items ?? []) {
        const back = subMoney(l.quantity, l.returned_qty ?? "0");
        if (l.variant_id && toScaled(back) > 0n) post(user, l.variant_id, "cancel_reverse", back, `Cancelled ${inv.invoice_no}`, { reference_type: "invoice", reference_id: inv.id });
      }
      inv.status = "cancelled"; inv.notes = [inv.notes, `Cancelled: ${reason}`].filter(Boolean).join("\n");
      return { data: detail(inv) };
    }
    if (m[2] === "/payments" && method === "POST") {
      if (inv.status === "draft" || inv.status === "cancelled") throw new ApiError(409, "conflict", "Payments can only be added to confirmed invoices.");
      const fields: Record<string, string> = {};
      if (!MONEY.test(String(b["amount"] ?? "")) || toScaled(String(b["amount"])) <= 0n) fields["amount"] = "Enter an amount above 0.";
      else if (toScaled(String(b["amount"])) > toScaled(inv.balance)) fields["amount"] = `Cannot be more than the balance (${inv.balance}).`;
      if (!METHODS.includes(b["method"] as PaymentMethod)) fields["method"] = "Choose a method.";
      if (b["payment_date"] && !DATE.test(String(b["payment_date"]))) fields["payment_date"] = "Choose a date.";
      if (Object.keys(fields).length) throw new ApiError(fields["amount"]?.startsWith("Cannot") ? 409 : 422, "validation_error", fields["amount"]?.startsWith("Cannot") ? fields["amount"] : "Please fix the highlighted fields.", fields);
      return { data: addPayment(inv, b as Partial<PaymentInput>) };
    }
    if (m[2] === "/challans" && method === "POST") {
      if (inv.status === "draft" || inv.status === "cancelled") throw new ApiError(409, "conflict", "Confirm the invoice before making a delivery challan.");
      const ch: Challan = { id: challans.length + 1, challan_no: nextNo("CH", challans.map((x) => x.challan_no)), challan_date: str(b["challan_date"]) ?? today(), invoice_id: inv.id,
        vehicle_no: str(b["vehicle_no"]), driver_name: str(b["driver_name"]), received_by: str(b["received_by"]), note: str(b["note"]) };
      challans.push(ch);
      return { data: ch };
    }
  }
  if (method === "POST" && (m = path.match(/^\/invoice-items\/(\d+)\/return$/))) {
    needManager(user, "Only managers and admins can record sales returns.");
    const id = Number(m[1]);
    const inv = db.invoices.find((i) => i.items?.some((l) => l.id === id));
    const line = inv?.items?.find((l) => l.id === id);
    if (!inv || !line) throw new ApiError(404, "not_found", "Invoice line not found.");
    if (!["due", "partial", "paid"].includes(inv.status)) throw new ApiError(409, "conflict", "Returns are only possible on confirmed invoices.");
    const qty = String(b["quantity"] ?? "");
    const left = subMoney(line.quantity, line.returned_qty ?? "0");
    if (!QTY.test(qty) || toScaled(qty) <= 0n || toScaled(qty) > toScaled(left))
      throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", { quantity: `Enter 1 to ${formatQty(left)}.` });
    if (line.variant_id) post(user, line.variant_id, "sale_return_in", qty, str(b["note"]) ?? `Return on ${inv.invoice_no}`, { reference_type: "invoice_return", reference_id: id });
    line.returned_qty = addQty(line.returned_qty ?? "0", qty);
    const amount = previewLineAmount(qty, line.rate, line.discount_percent);
    const credit = addPayment(inv, { amount, note: str(b["note"]) ?? `Return of ${formatQty(qty)} × ${line.description}` }, true);
    if (toScaled(inv.paid) > toScaled(inv.total)) { inv.balance = subMoney(inv.total, inv.paid); }
    return { data: { invoice: detail(inv), credit_note: credit } };
  }

  // Payments
  if (route === "GET /payments") {
    const cid = Number(query["customer_id"] ?? 0); const meth = String(query["method"] ?? "");
    return paginate([...customerPayments].reverse().filter((p) => (!cid || p.customer_id === cid) && (!meth || p.method === meth)), query);
  }
  if ((m = path.match(/^\/payments\/(\d+)$/))) {
    const p = customerPayments.find((x) => x.id === Number(m![1]));
    if (!p) throw new ApiError(404, "not_found", "Payment not found.");
    const inv = p.invoice_id ? db.invoices.find((i) => i.id === p.invoice_id) : undefined;
    if (method === "GET") return { data: { ...p, invoice: inv ? detail(inv) : null, company } };
    needManager(user, "Only managers and admins can change payments.");
    if (method === "DELETE") { customerPayments.splice(customerPayments.indexOf(p), 1); if (inv) sync(inv); return { data: { ok: true } }; }
    if (method === "PUT") {
      const amt = String(b["amount"] ?? p.amount);
      const room = inv ? addMoney(inv.balance, p.amount) : amt;
      if (!MONEY.test(amt) || toScaled(amt) <= 0n || toScaled(amt) > toScaled(room)) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", { amount: `Enter up to ${room}.` });
      Object.assign(p, { amount: Number(amt).toFixed(2), reference_no: str(b["reference_no"]) ?? p.reference_no, note: str(b["note"]) ?? p.note });
      if (inv) sync(inv);
      return { data: p };
    }
  }
  if (method === "GET" && (m = path.match(/^\/challans\/(\d+)$/))) {
    const ch = challans.find((x) => x.id === Number(m![1]));
    if (!ch) throw new ApiError(404, "not_found", "Challan not found.");
    const inv = findInvoice(ch.invoice_id); const d = detail(inv);
    return { data: { ...ch, invoice_no: inv.invoice_no, invoice_date: inv.invoice_date, buyer_ref: inv.buyer_ref ?? null, po_no: inv.po_no ?? null, style_no: inv.style_no ?? null, customer: d.customer, company,
      items: (inv.items ?? []).map(({ description, unit_code, quantity }) => ({ description, unit_code, quantity })) } };
  }
  throw new ApiError(404, "not_found", `No mock for ${route}`);
}
