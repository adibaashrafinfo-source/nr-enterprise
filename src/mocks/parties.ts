// Mock Customers and Suppliers groups (docs/NRE_BACKEND_API.md). Balances follow 4.12: opening + confirmed invoices − payments.
import { ApiError } from "@/lib/api-error";
import { addMoney, subMoney, toScaled } from "@/lib/money";
import type { SupplierPayment, Payment, Customer, CustomerDue, CustomerInput, CustomerType, LedgerRow, Supplier, SupplierInput, User } from "@/lib/types";
import * as db from "./seed";

type Query = Record<string, string | number | undefined>;
const TYPES: CustomerType[] = ["factory", "buying_house", "brand", "retail", "other"];
// Payments, purchases and supplier payments arrive in Phases 7-8; the ledger already reads them.
export const customerPayments: Payment[] = [];
export const supplierPurchases: { id: number; po_no: string; date: string; supplier_id: number; received_value: string }[] = [];
export const supplierPayments: SupplierPayment[] = [];

let orderCount: (customerId: number) => number = () => 0;
export const setOrderCounter = (fn: (customerId: number) => number) => { orderCount = fn; };
const confirmed = (customerId: number) => db.invoices.filter((i) => i.customer_id === customerId && ["due", "partial", "paid"].includes(i.status));
const today = () => new Date().toISOString().slice(0, 10);
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);

function customerView(c: (typeof db.customers)[number]): Customer {
  const inv = confirmed(c.id);
  const total_sales = addMoney(...inv.map((i) => i.total));
  const paid = addMoney(...customerPayments.filter((p) => p.customer_id === c.id).map((p) => p.amount));
  return { ...c, total_sales, due_balance: subMoney(addMoney(c.opening_balance, total_sales), paid), invoice_count: db.invoices.filter((i) => i.customer_id === c.id).length, order_count: orderCount(c.id) };
}
function supplierView(s: (typeof db.suppliers)[number]): Supplier {
  const total_purchased = addMoney(...supplierPurchases.filter((p) => p.supplier_id === s.id).map((p) => p.received_value));
  const paid = addMoney(...supplierPayments.filter((p) => p.supplier_id === s.id).map((p) => p.amount));
  return { ...s, total_purchased, paid, payable_balance: subMoney(addMoney(s.opening_balance, total_purchased), paid) };
}

function ledger(opening: string, entries: Omit<LedgerRow, "running_balance">[], from?: string, to?: string): LedgerRow[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let bal = opening;
  for (const e of sorted) if (from && e.date < from) bal = subMoney(addMoney(bal, e.debit), e.credit);
  const rows: LedgerRow[] = [{ date: from ?? "", type: "opening", doc_no: null, debit: "0.00", credit: "0.00", running_balance: bal }];
  for (const e of sorted) {
    if ((from && e.date < from) || (to && e.date > to)) continue;
    bal = subMoney(addMoney(bal, e.debit), e.credit);
    rows.push({ ...e, running_balance: bal });
  }
  return rows;
}

const MONEY = /^-?\d+(\.\d{1,2})?$/;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
function cleanCustomer(b: Partial<CustomerInput>): CustomerInput {
  const fields: Record<string, string> = {};
  if (!str(b.name)) fields["name"] = "Name is required.";
  if (b.type && !TYPES.includes(b.type)) fields["type"] = "Choose a customer type.";
  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) fields["email"] = "Enter a valid email.";
  if (b.credit_days !== undefined && (!Number.isInteger(Number(b.credit_days)) || Number(b.credit_days) < 0)) fields["credit_days"] = "Enter whole days, e.g. 30.";
  if (b.credit_limit && !MONEY.test(String(b.credit_limit))) fields["credit_limit"] = "Enter an amount.";
  if (b.opening_balance && !MONEY.test(String(b.opening_balance))) fields["opening_balance"] = "Enter an amount.";
  if (Object.keys(fields).length) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", fields);
  return {
    name: str(b.name)!, contact_person: str(b.contact_person), phone: str(b.phone), whatsapp: str(b.whatsapp), email: str(b.email),
    billing_address: str(b.billing_address), delivery_address: str(b.delivery_address), area: str(b.area), type: b.type ?? "other",
    credit_days: Number(b.credit_days ?? 0), credit_limit: Number(b.credit_limit || 0).toFixed(2), opening_balance: Number(b.opening_balance || 0).toFixed(2),
    buyers_served: str(b.buyers_served), bin: str(b.bin), notes: str(b.notes), is_active: b.is_active ?? true,
  };
}
function cleanSupplier(b: Partial<SupplierInput>): SupplierInput {
  const fields: Record<string, string> = {};
  if (!str(b.name)) fields["name"] = "Name is required.";
  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) fields["email"] = "Enter a valid email.";
  if (b.opening_balance && !MONEY.test(String(b.opening_balance))) fields["opening_balance"] = "Enter an amount.";
  if (Object.keys(fields).length) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", fields);
  return {
    name: str(b.name)!, contact_person: str(b.contact_person), phone: str(b.phone), email: str(b.email), address: str(b.address),
    payment_terms: str(b.payment_terms), opening_balance: Number(b.opening_balance || 0).toFixed(2), notes: str(b.notes), is_active: b.is_active ?? true,
    product_ids: (b.product_ids ?? []).map(Number).filter((id) => db.products.some((p) => p.id === id)),
  };
}
const nextCode = (prefix: string, list: { code: string }[]) => `${prefix}-${String(list.reduce((m, x) => Math.max(m, Number(x.code.split("-")[1]) || 0), 0) + 1).padStart(4, "0")}`;
const paginate = <T,>(list: T[], q: Query) => {
  const page = Math.max(1, Number(q["page"] ?? 1));
  const per_page = Math.min(100, Math.max(1, Number(q["per_page"] ?? 25)));
  return { data: list.slice((page - 1) * per_page, page * per_page), meta: { page, per_page, total: list.length } };
};

export const isPartyPath = (path: string) => /^\/(customers|suppliers)(\/|$)/.test(path);
export const customerName = (id: number) => db.customers.find((c) => c.id === id)?.name ?? "";

export function partyRequest(method: string, path: string, query: Query, body: unknown, user: User): unknown {
  const route = `${method} ${path}`;
  const manager = user.role === "admin" || user.role === "manager";
  const needManager = (msg: string) => { if (!manager) throw new ApiError(403, "forbidden", msg); };
  let m: RegExpMatchArray | null;

  // Customers — staff can view/add/edit; delete is manager+.
  if (route === "GET /customers") {
    const term = String(query["q"] ?? "").toLowerCase(); const type = String(query["type"] ?? ""); const hasDue = String(query["has_due"] ?? "") === "1";
    const list = db.customers.map(customerView).filter((c) => (!type || c.type === type) && (!hasDue || toScaled(c.due_balance) > 0n)
      && (!term || `${c.name} ${c.phone ?? ""} ${c.area ?? ""} ${c.code}`.toLowerCase().includes(term)));
    return paginate(list, query);
  }
  if (route === "GET /customers/dues") {
    const t = today();
    const list: CustomerDue[] = db.invoices.filter((i) => (i.status === "due" || i.status === "partial") && toScaled(i.balance) > 0n).map((i) => {
      const c = db.customers.find((x) => x.id === i.customer_id);
      const due_date = addDays(i.invoice_date, c?.credit_days ?? 0);
      return { invoice_id: i.id, invoice_no: i.invoice_no, customer_id: i.customer_id, customer_name: i.customer_name, invoice_date: i.invoice_date, due_date, balance: i.balance, days_overdue: Math.max(0, daysBetween(due_date, t)) };
    }).sort((a, b) => a.due_date.localeCompare(b.due_date));
    return paginate(list, query);
  }
  if (route === "POST /customers") {
    const input = cleanCustomer((body ?? {}) as Partial<CustomerInput>);
    const c = { ...input, id: db.customers.reduce((mx, x) => Math.max(mx, x.id), 0) + 1, code: nextCode("CUS", db.customers) };
    db.customers.push(c);
    return { data: customerView(c) };
  }
  if (route === "POST /customers/import") {
    const rows = ((body ?? {}) as { rows?: Partial<CustomerInput>[] }).rows ?? [];
    const errors: { row: number; message: string }[] = []; let created = 0;
    rows.forEach((r, i) => {
      try { const input = cleanCustomer(r); db.customers.push({ ...input, id: db.customers.reduce((mx, x) => Math.max(mx, x.id), 0) + 1, code: nextCode("CUS", db.customers) }); created++; }
      catch (e) { errors.push({ row: i + 2, message: e instanceof ApiError ? Object.values(e.fields ?? {}).join(" ") || e.message : "Invalid row." }); }
    });
    return { data: { created, errors } };
  }
  if ((m = path.match(/^\/customers\/(\d+)(\/ledger)?$/))) {
    const idx = db.customers.findIndex((c) => c.id === Number(m![1]));
    if (idx < 0) throw new ApiError(404, "not_found", "Customer not found.");
    const c = db.customers[idx]!;
    if (m[2] && method === "GET") {
      const entries = [
        ...confirmed(c.id).map((i) => ({ date: i.invoice_date, type: "invoice" as const, doc_no: i.invoice_no, debit: i.total, credit: "0.00" })),
        ...customerPayments.filter((p) => p.customer_id === c.id).map((p) => ({ date: p.payment_date, type: "payment" as const, doc_no: p.receipt_no, debit: "0.00", credit: p.amount })),
      ];
      return { data: ledger(c.opening_balance, entries, str(query["from"]) ?? undefined, str(query["to"]) ?? undefined) };
    }
    if (method === "GET") return { data: { ...customerView(c), invoices: db.invoices.filter((i) => i.customer_id === c.id), payments: customerPayments.filter((p) => p.customer_id === c.id) } };
    if (method === "PUT") { Object.assign(c, cleanCustomer((body ?? {}) as Partial<CustomerInput>)); return { data: customerView(c) }; }
    if (method === "DELETE") {
      needManager("Only managers and admins can delete customers.");
      if (db.invoices.some((i) => i.customer_id === c.id) || customerPayments.some((p) => p.customer_id === c.id)) { c.is_active = false; return { data: { ok: true, archived: true } }; }
      db.customers.splice(idx, 1);
      return { data: { ok: true, archived: false } };
    }
  }

  // Suppliers — manager/admin only.
  if (path.startsWith("/suppliers")) {
    needManager("Only managers and admins can see suppliers.");
    if (route === "GET /suppliers") {
      const term = String(query["q"] ?? "").toLowerCase();
      return paginate(db.suppliers.map(supplierView).filter((s) => !term || `${s.name} ${s.phone ?? ""} ${s.code}`.toLowerCase().includes(term)), query);
    }
    if (route === "POST /suppliers") {
      const s = { ...cleanSupplier((body ?? {}) as Partial<SupplierInput>), id: db.suppliers.reduce((mx, x) => Math.max(mx, x.id), 0) + 1, code: nextCode("SUP", db.suppliers) };
      db.suppliers.push(s);
      return { data: supplierView(s) };
    }
    if ((m = path.match(/^\/suppliers\/(\d+)(\/ledger)?$/))) {
      const idx = db.suppliers.findIndex((x) => x.id === Number(m![1]));
      if (idx < 0) throw new ApiError(404, "not_found", "Supplier not found.");
      const s = db.suppliers[idx]!;
      if (m[2] && method === "GET") {
        // Payable ledger: received purchases raise what we owe, payments reduce it.
        const entries = [
          ...supplierPurchases.filter((p) => p.supplier_id === s.id).map((p) => ({ date: p.date, type: "purchase" as const, doc_no: p.po_no, debit: "0.00", credit: p.received_value })),
          ...supplierPayments.filter((p) => p.supplier_id === s.id).map((p) => ({ date: p.payment_date, type: "supplier_payment" as const, doc_no: p.voucher_no, debit: p.amount, credit: "0.00" })),
        ].map((e) => ({ ...e, debit: e.credit, credit: e.debit }));
        return { data: ledger(s.opening_balance, entries, str(query["from"]) ?? undefined, str(query["to"]) ?? undefined) };
      }
      if (method === "GET") return { data: { ...supplierView(s), purchases: supplierPurchases.filter((p) => p.supplier_id === s.id), payments: supplierPayments.filter((p) => p.supplier_id === s.id) } };
      if (method === "PUT") { Object.assign(s, cleanSupplier((body ?? {}) as Partial<SupplierInput>)); return { data: supplierView(s) }; }
      if (method === "DELETE") {
        if (supplierPurchases.some((p) => p.supplier_id === s.id) || supplierPayments.some((p) => p.supplier_id === s.id)) { s.is_active = false; return { data: { ok: true, archived: true } }; }
        db.suppliers.splice(idx, 1);
        return { data: { ok: true, archived: false } };
      }
    }
  }
  throw new ApiError(404, "not_found", `No mock for ${route}`);
}
