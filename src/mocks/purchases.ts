// Mock Purchases group (docs/NRE_BACKEND_API.md 4.10/4.11): PO numbering, receiving into stock, returns, supplier payments.
import { ApiError } from "@/lib/api-error";
import { addMoney, addQty, mulMoney, subMoney, toScaled } from "@/lib/money";
import type { PendingReceipt, PurchaseDetail, PurchaseItem, PurchaseOrder, PurchaseStatus, ReorderSuggestion, SupplierPayment, User } from "@/lib/types";
import * as db from "./seed";
import { company } from "./sales";
import { supplierPayments, supplierPurchases } from "./parties";
import { findEntry, onHand, post } from "./stock";
import { variantEntries } from "./catalogue";

type Query = Record<string, string | number | undefined>;
type Po = Omit<PurchaseOrder, "total" | "received_value"> & { items: PurchaseItem[] };
export const purchases: Po[] = [];
let itemSeq = 0;

const QTY = /^\d+(\.\d{1,3})?$/;
const MONEY = /^\d+(\.\d{1,2})?$/;
const METHODS = ["cash", "bkash", "nagad", "bank", "cheque"];
const today = () => new Date().toISOString().slice(0, 10);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const nextNo = (prefix: string, list: string[]) => `${prefix}-${String(list.reduce((m, x) => Math.max(m, Number(x.split("-")[1]) || 0), 0) + 1).padStart(4, "0")}`;
const pending = (i: PurchaseItem) => addQty(i.qty_ordered, `-${i.qty_received}`);
const view = (po: Po): PurchaseOrder => {
  const { items, ...h } = po;
  return { ...h, total: addMoney(...items.map((i) => i.line_total)), received_value: addMoney(...items.map((i) => mulMoney(i.qty_received, i.rate))) };
};
const supplierOf = (id: number) => {
  const s = db.suppliers.find((x) => x.id === id);
  if (!s) throw new ApiError(422, "validation_error", "Choose a supplier.", { supplier_id: "Choose a supplier." });
  return s;
};
const findPo = (id: number) => {
  const po = purchases.find((p) => p.id === id);
  if (!po) throw new ApiError(404, "not_found", "Purchase order not found.");
  return po;
};
const findItem = (id: number) => {
  for (const po of purchases) { const item = po.items.find((i) => i.id === id); if (item) return { po, item }; }
  throw new ApiError(404, "not_found", "Purchase line not found.");
};
/** Latest rate this variant was bought at (v_last_purchase_rate). */
export const lastRate = (variantId: number): string | null => {
  for (let i = purchases.length - 1; i >= 0; i--) {
    const po = purchases[i]!;
    if (po.status === "cancelled") continue;
    const it = po.items.find((x) => x.variant_id === variantId);
    if (it) return it.rate;
  }
  return null;
};

function cleanLines(raw: unknown): PurchaseItem[] {
  const list = Array.isArray(raw) ? raw as { variant_id?: number; qty_ordered?: string; rate?: string }[] : [];
  const fields: Record<string, string> = {};
  if (!list.length) fields["items"] = "Add at least one line.";
  const items = list.map((l, idx) => {
    if (!QTY.test(String(l.qty_ordered ?? "")) || toScaled(String(l.qty_ordered)) <= 0n) fields[`items.${idx}.qty_ordered`] = "Enter a quantity above 0.";
    if (!MONEY.test(String(l.rate ?? ""))) fields[`items.${idx}.rate`] = "Enter a rate.";
    let entry;
    try { entry = findEntry(Number(l.variant_id)); } catch { fields[`items.${idx}.variant_id`] = "Choose an item."; }
    if (!entry || fields[`items.${idx}.qty_ordered`] || fields[`items.${idx}.rate`]) return null;
    const qty = addQty(String(l.qty_ordered));
    return { id: 0, variant_id: entry.variant.id, display_name: `${entry.product.name} — ${entry.variant.name}`, sku: entry.variant.sku, unit_code: entry.product.unit_code,
      qty_ordered: qty, qty_received: "0.000", rate: Number(l.rate).toFixed(2), line_total: mulMoney(qty, String(l.rate)) } satisfies PurchaseItem;
  });
  if (Object.keys(fields).length) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", fields);
  return (items as PurchaseItem[]).map((i) => ({ ...i, id: ++itemSeq }));
}
function header(b: Record<string, unknown>) {
  const s = supplierOf(Number(b["supplier_id"]));
  return { supplier_id: s.id, supplier_name: s.name, order_date: str(b["order_date"]) ?? today(), expected_date: str(b["expected_date"]), bill_no: str(b["bill_no"]), notes: str(b["notes"]) };
}
/** Ledger rows for the supplier: received value raises the payable, returns lower it. */
const logReceipt = (po: Po, value: string) => { supplierPurchases.push({ id: supplierPurchases.length + 1, po_no: po.po_no, date: today(), supplier_id: po.supplier_id, received_value: value }); };

export const isPurchasePath = (path: string) => /^\/(purchases|purchase-items|receiving|supplier-payments)(\/|$)/.test(path) || /^\/suppliers\/\d+\/payments$/.test(path);

export function purchaseRequest(method: string, path: string, query: Query, body: unknown, user: User): unknown {
  const route = `${method} ${path}`;
  const b = (body ?? {}) as Record<string, unknown>;
  const manager = user.role === "admin" || user.role === "manager";
  const needManager = () => { if (!manager) throw new ApiError(403, "forbidden", "Only managers and admins can see purchase orders and rates."); };
  let m: RegExpMatchArray | null;

  // Staff-safe: no rates or values in this response.
  if (route === "GET /receiving/pending") {
    const rows: PendingReceipt[] = purchases.filter((p) => p.status === "ordered" || p.status === "partial").flatMap((po) => po.items.filter((i) => toScaled(pending(i)) > 0n).map((i) => ({
      item_id: i.id, purchase_id: po.id, po_no: po.po_no, supplier_name: po.supplier_name, expected_date: po.expected_date, variant_id: i.variant_id,
      display_name: i.display_name, sku: i.sku, unit_code: i.unit_code, qty_ordered: i.qty_ordered, qty_received: i.qty_received, qty_pending: pending(i),
    })));
    return { data: rows };
  }
  if ((m = path.match(/^\/purchase-items\/(\d+)\/receive$/)) && method === "POST") {
    const { po, item } = findItem(Number(m[1]));
    if (po.status !== "ordered" && po.status !== "partial") throw new ApiError(409, "invalid_status", "Only ordered or partly received POs can be received.");
    const q = String(b["quantity"] ?? "");
    const left = pending(item);
    if (!QTY.test(q) || toScaled(q) <= 0n || toScaled(q) > toScaled(left)) throw new ApiError(409, "invalid_quantity", `Invalid quantity: pending is ${Number(left)}`, { quantity: `Pending is ${Number(left)}.` });
    item.qty_received = addQty(item.qty_received, q);
    post(user, item.variant_id, "purchase_in", q, str(b["note"]), { reference_type: "purchase_order", reference_id: po.id, batch: str(b["batch_no"]) });
    po.status = po.items.some((i) => toScaled(pending(i)) > 0n) ? "partial" : "received";
    logReceipt(po, mulMoney(q, item.rate));
    return { data: { item_id: item.id, qty_received: item.qty_received, qty_pending: pending(item), status: po.status } };
  }

  needManager();

  if (route === "GET /purchases/reorder-suggestions") {
    const rows: ReorderSuggestion[] = variantEntries().filter(({ variant }) => variant.is_active && toScaled(variant.stock_qty) <= toScaled(variant.reorder_level)).map(({ product, variant }) => {
      const level = addQty(variant.reorder_level); const qty = addQty(variant.stock_qty);
      const gap = addQty(level, `-${qty}`);
      const suggested = toScaled(level) > 0n ? addQty(gap, level) : "1.000";
      const lastPo = [...purchases].reverse().find((p) => p.status !== "cancelled" && p.items.some((i) => i.variant_id === variant.id));
      return { variant_id: variant.id, display_name: `${product.name} — ${variant.name}`, sku: variant.sku, unit_code: product.unit_code, qty_on_hand: qty, reorder_level: level,
        suggested_qty: suggested, last_rate: lastRate(variant.id) ?? variant.purchase_price ?? null, supplier_id: lastPo?.supplier_id ?? null };
    });
    return { data: rows };
  }
  if (route === "GET /purchases") {
    const st = String(query["status"] ?? ""); const sup = Number(query["supplier_id"] ?? 0); const term = String(query["q"] ?? "").toLowerCase();
    const from = str(query["from"]); const to = str(query["to"]);
    const list = purchases.map(view).filter((p) => (!st || p.status === st) && (!sup || p.supplier_id === sup) && (!from || p.order_date >= from) && (!to || p.order_date <= to)
      && (!term || `${p.po_no} ${p.supplier_name} ${p.bill_no ?? ""}`.toLowerCase().includes(term))).reverse();
    const page = Math.max(1, Number(query["page"] ?? 1)); const per_page = Math.min(100, Math.max(1, Number(query["per_page"] ?? 25)));
    return { data: list.slice((page - 1) * per_page, page * per_page), meta: { page, per_page, total: list.length } };
  }
  if (route === "POST /purchases") {
    const h = header(b); const items = cleanLines(b["items"]);
    const po: Po = { ...h, id: purchases.length + 1, po_no: nextNo("PO", purchases.map((p) => p.po_no)), status: b["status"] === "draft" ? "draft" : "ordered", items };
    purchases.push(po);
    return { data: detail(po) };
  }
  if ((m = path.match(/^\/purchases\/(\d+)(\/status)?$/))) {
    const po = findPo(Number(m[1]));
    const received = po.items.some((i) => toScaled(i.qty_received) > 0n);
    if (m[2] && method === "POST") {
      const s = b["status"] as PurchaseStatus;
      if (s === "ordered" && po.status === "draft") po.status = "ordered";
      else if (s === "cancelled" && !received && po.status !== "cancelled") po.status = "cancelled";
      else throw new ApiError(409, "invalid_status", received ? "Goods were already received, so this PO cannot be cancelled." : "That status change is not allowed.");
      return { data: detail(po) };
    }
    if (method === "GET") return { data: detail(po) };
    if (method === "PUT") {
      if (received || (po.status !== "draft" && po.status !== "ordered")) throw new ApiError(409, "locked", "Only draft or ordered POs with nothing received can be edited.");
      Object.assign(po, header(b), { items: cleanLines(b["items"]) });
      return { data: detail(po) };
    }
  }
  if ((m = path.match(/^\/purchase-items\/(\d+)\/return$/)) && method === "POST") {
    const { po, item } = findItem(Number(m[1]));
    const q = String(b["quantity"] ?? "");
    if (!QTY.test(q) || toScaled(q) <= 0n || toScaled(q) > toScaled(item.qty_received)) throw new ApiError(409, "invalid_quantity", `Invalid quantity: received is ${Number(item.qty_received)}`, { quantity: `Received is ${Number(item.qty_received)}.` });
    if (toScaled(onHand(item.variant_id)) < toScaled(q)) throw new ApiError(409, "insufficient_stock", `Only ${Number(onHand(item.variant_id))} in stock, so ${Number(q)} cannot be returned.`, { quantity: "Not enough stock on hand." });
    item.qty_received = addQty(item.qty_received, `-${q}`);
    post(user, item.variant_id, "purchase_return_out", `-${q}`, str(b["note"]), { reference_type: "purchase_order", reference_id: po.id });
    if (po.status === "received") po.status = "partial";
    logReceipt(po, `-${mulMoney(q, item.rate)}`);
    return { data: { item_id: item.id, qty_received: item.qty_received, qty_pending: pending(item), status: po.status } };
  }
  if ((m = path.match(/^\/suppliers\/(\d+)\/payments$/)) && method === "POST") {
    const s = supplierOf(Number(m[1]));
    const fields: Record<string, string> = {};
    const amount = String(b["amount"] ?? "");
    if (!MONEY.test(amount) || toScaled(amount) <= 0n) fields["amount"] = "Enter an amount above 0.";
    if (!METHODS.includes(String(b["method"]))) fields["method"] = "Choose a method.";
    const poId = b["purchase_id"] ? Number(b["purchase_id"]) : null;
    const po = poId ? findPo(poId) : null;
    if (po && po.supplier_id !== s.id) fields["purchase_id"] = "That PO belongs to another supplier.";
    if (Object.keys(fields).length) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", fields);
    const p: SupplierPayment = { id: supplierPayments.length + 1, voucher_no: nextNo("SV", supplierPayments.map((x) => x.voucher_no)), supplier_id: s.id, supplier_name: s.name,
      payment_date: str(b["payment_date"]) ?? today(), method: b["method"] as SupplierPayment["method"], reference_no: str(b["reference_no"]), amount: Number(amount).toFixed(2),
      purchase_id: po?.id ?? null, po_no: po?.po_no ?? null, note: str(b["note"]) };
    supplierPayments.push(p);
    return { data: p };
  }
  if ((m = path.match(/^\/supplier-payments\/(\d+)$/)) && method === "GET") {
    const p = supplierPayments.find((x) => x.id === Number(m![1]));
    if (!p) throw new ApiError(404, "not_found", "Voucher not found.");
    const s = db.suppliers.find((x) => x.id === p.supplier_id)!;
    const paid = addMoney(...supplierPayments.filter((x) => x.supplier_id === s.id).map((x) => x.amount));
    const bought = addMoney(...supplierPurchases.filter((x) => x.supplier_id === s.id).map((x) => x.received_value));
    return { data: { ...p, supplier: { ...s, total_purchased: bought, paid, payable_balance: subMoney(addMoney(s.opening_balance, bought), paid) }, company } };
  }
  throw new ApiError(404, "not_found", `No mock for ${route}`);
}

function detail(po: Po): PurchaseDetail {
  const s = db.suppliers.find((x) => x.id === po.supplier_id)!;
  const paid = addMoney(...supplierPayments.filter((x) => x.supplier_id === s.id).map((x) => x.amount));
  const bought = addMoney(...supplierPurchases.filter((x) => x.supplier_id === s.id).map((x) => x.received_value));
  return { ...view(po), items: po.items.map((i) => ({ ...i })), payments: supplierPayments.filter((p) => p.purchase_id === po.id),
    supplier: { ...s, total_purchased: bought, paid, payable_balance: subMoney(addMoney(s.opening_balance, bought), paid) }, company };
}
