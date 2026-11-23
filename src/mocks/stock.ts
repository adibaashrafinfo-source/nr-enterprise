// In-memory stock ledger mirroring docs/NRE_BACKEND_API.md 4.2/4.9: balance = sum of movements, rows are never edited.
import { ApiError } from "@/lib/api-error";
import { addMoney, addQty, formatQty, mulMoney, toScaled } from "@/lib/money";
import type { OpeningStockInput, StockAdjustInput, StockLedgerRow, StockMovementType, StockRow, StockStatus, User } from "@/lib/types";
import { variantEntries } from "./catalogue";

type Query = Record<string, string | number | undefined>;
const ledger: StockLedgerRow[] = [];
let nextId = 0;
const QTY = /^-?\d+(\.\d{1,3})?$/;

const canManage = (u: User) => u.role === "admin" || u.role === "manager";
const status = (qty: string, reorder: string): StockStatus => (toScaled(qty) <= 0n ? "out" : toScaled(qty) <= toScaled(reorder) ? "low" : "ok");

function rows(): StockRow[] {
  return variantEntries().filter(({ variant }) => variant.is_active).map(({ product, variant }) => ({
    variant_id: variant.id, product_id: product.id, sku: variant.sku,
    display_name: `${product.name} — ${variant.name}`, product_name: product.name,
    category_id: product.category.id, category_name: product.category.name, unit_code: product.unit_code,
    qty_on_hand: addQty(variant.stock_qty), reorder_level: variant.reorder_level, selling_price: variant.selling_price,
    status: status(variant.stock_qty, variant.reorder_level),
  }));
}
export const findEntry = (id: number) => {
  const e = variantEntries().find((x) => x.variant.id === id);
  if (!e) throw new ApiError(404, "not_found", "Variant not found.", { variant_id: "Choose a variant." });
  return e;
};

export function post(user: User, variantId: number, type: StockMovementType, quantity: string, note: string | null, ref: Partial<Pick<StockLedgerRow, "reference_type" | "reference_id" | "buyer" | "style_no" | "batch">> = {}): StockLedgerRow {
  const { variant } = findEntry(variantId);
  variant.stock_qty = addQty(variant.stock_qty, quantity);
  const row: StockLedgerRow = { id: ++nextId, variant_id: variantId, type, quantity: addQty(quantity), reference_type: null, reference_id: null, buyer: null, style_no: null, batch: null, ...ref, user_name: user.full_name, note, created_at: new Date().toISOString() };
  ledger.push(row);
  return row;
}

const paginate = <T,>(list: T[], q: Query) => {
  const page = Math.max(1, Number(q["page"] ?? 1));
  const per_page = Math.min(100, Math.max(1, Number(q["per_page"] ?? 25)));
  return { data: list.slice((page - 1) * per_page, page * per_page), meta: { page, per_page, total: list.length } };
};

export const isStockPath = (path: string) => /^\/stock(\/|$)/.test(path);
export const lowStockCount = () => rows().filter((r) => r.status !== "ok").length;
export const stockValueTotal = () => addMoney(...variantEntries().filter(({ variant }) => toScaled(variant.stock_qty) > 0n).map(({ variant }) => mulMoney(variant.stock_qty, variant.purchase_price ?? "0")));

export function stockRequest(method: string, path: string, query: Query, body: unknown, user: User): unknown {
  const route = `${method} ${path}`;
  const manage = () => { if (!canManage(user)) throw new ApiError(403, "forbidden", "Only managers and admins can change stock."); };
  let m: RegExpMatchArray | null;

  if (route === "GET /stock") {
    const term = String(query["q"] ?? "").toLowerCase();
    const cat = Number(query["category_id"] ?? 0);
    const st = String(query["status"] ?? "");
    return paginate(rows().filter((r) => (!st || r.status === st) && (!cat || r.category_id === cat) && (!term || `${r.display_name} ${r.sku}`.toLowerCase().includes(term))), query);
  }
  if (route === "GET /stock/value") {
    manage();
    const by = new Map<number, { category_id: number; category_name: string; value: string }>();
    for (const { product, variant } of variantEntries()) {
      if (toScaled(variant.stock_qty) <= 0n) continue;
      const cur = by.get(product.category.id) ?? { category_id: product.category.id, category_name: product.category.name, value: "0.00" };
      cur.value = addMoney(cur.value, mulMoney(variant.stock_qty, variant.purchase_price ?? "0"));
      by.set(product.category.id, cur);
    }
    return { data: { total: stockValueTotal(), by_category: [...by.values()] } };
  }
  if (method === "GET" && (m = path.match(/^\/stock\/(\d+)\/movements$/))) {
    const id = Number(m[1]);
    const variant = rows().find((r) => r.variant_id === id);
    if (!variant) throw new ApiError(404, "not_found", "Variant not found.");
    const type = String(query["type"] ?? ""); const from = String(query["from"] ?? ""); const to = String(query["to"] ?? "");
    const list = ledger.filter((r) => r.variant_id === id && (!type || r.type === type) && (!from || r.created_at.slice(0, 10) >= from) && (!to || r.created_at.slice(0, 10) <= to)).reverse();
    return { ...paginate(list, query), variant };
  }
  if (route === "POST /stock/opening") {
    manage();
    const b = (body ?? {}) as Partial<OpeningStockInput>;
    const fields: Record<string, string> = {};
    if (!b.variant_id) fields["variant_id"] = "Choose a variant.";
    if (!QTY.test(String(b.quantity ?? "")) || toScaled(b.quantity) <= 0n) fields["quantity"] = "Enter a quantity above 0.";
    if (b.cost && !/^\d+(\.\d{1,2})?$/.test(b.cost)) fields["cost"] = "Enter a cost, e.g. 1.25.";
    if (Object.keys(fields).length) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", fields);
    const { variant } = findEntry(Number(b.variant_id));
    if (b.cost) variant.purchase_price = Number(b.cost).toFixed(2);
    return { data: post(user, variant.id, "opening", String(b.quantity), b.note?.trim() || null) };
  }
  if (route === "POST /stock/adjust") {
    manage();
    const b = (body ?? {}) as Partial<StockAdjustInput>;
    const fields: Record<string, string> = {};
    if (!b.variant_id) fields["variant_id"] = "Choose a variant.";
    if (!QTY.test(String(b.quantity ?? "")) || toScaled(b.quantity) === 0n) fields["quantity"] = "Enter a quantity other than 0, e.g. 10 or -5.";
    if (!b.reason?.trim()) fields["reason"] = "A reason is required.";
    if (Object.keys(fields).length) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", fields);
    const { variant } = findEntry(Number(b.variant_id));
    const qty = String(b.quantity);
    if (toScaled(qty) < 0n && toScaled(addQty(variant.stock_qty, qty)) < 0n)
      throw new ApiError(409, "conflict", "Adjustment would make stock negative", { quantity: `Only ${formatQty(variant.stock_qty)} in stock.` });
    return { data: post(user, variant.id, toScaled(qty) > 0n ? "adjustment_in" : "adjustment_out", qty, String(b.reason).trim()) };
  }
  throw new ApiError(404, "not_found", `No mock for ${route}`);
}

/** On-hand quantity for one variant (sum of its movements). */
export const onHand = (variantId: number) => addQty(findEntry(variantId).variant.stock_qty);

/** Read-only views for reports. */
export const stockRows = () => rows();
export const movementRows = () => ledger.slice();
