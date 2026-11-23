// Mock Reports, Enquiries, Content, Settings, Users and Activity log groups (docs/NRE_BACKEND_API.md).
import { ApiError } from "@/lib/api-error";
import { addMoney, addQty, mulMoney, subMoney, toScaled } from "@/lib/money";
import type { ActivityRow, AdminCertification, AdminClient, AdminUser, CompanySettings, CustomerDue, DocCounter, Enquiry, EnquiryStatus, Role, Supplier, User } from "@/lib/types";
import * as db from "./seed";
import { company, orders, salesRequest } from "./sales";
import { partyRequest, supplierPurchases } from "./parties";
import { purchases } from "./purchases";
import { movementRows, stockRows } from "./stock";
import { variantEntries } from "./catalogue";

type Query = Record<string, string | number | undefined>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const today = () => new Date().toISOString().slice(0, 10);
const isManager = (u: User) => u.role === "admin" || u.role === "manager";
const need = (ok: boolean, msg: string) => { if (!ok) throw new ApiError(403, "forbidden", msg); };
const inRange = (d: string, q: Query) => (!q["from"] || d >= String(q["from"])) && (!q["to"] || d <= String(q["to"]));
const nextId = (list: { id: number }[]) => list.reduce((m, x) => Math.max(m, x.id), 0) + 1;

// ---------- Content ----------
export const adminClients: AdminClient[] = db.clients.map((c, i) => ({ ...c, sort_order: i + 1, is_active: true, permission_confirmed: true }));
export const adminCertifications: AdminCertification[] = [];
export const publicClients = () => adminClients.filter((c) => c.is_active && c.permission_confirmed).sort((a, b) => a.sort_order - b.sort_order).map(({ id, name, logo_url }) => ({ id, name, logo_url }));
export const publicCertifications = () => adminCertifications.filter((c) => c.is_published && c.holder_confirmed).map(({ id, name, image_url }) => ({ id, name, image_url }));

// ---------- Settings ----------
export const companySettings: CompanySettings = { ...db.settings, bin: null, tin: null, trade_licence: null, bank_details: company.bank_details, invoice_footer: company.footer, tax_enabled: false, tax_rate: "0.00" };
const COUNTERS: [string, string, () => string[]][] = [
  ["invoice", "INV", () => db.invoices.map((i) => i.invoice_no)], ["order", "SO", () => orders.map((o) => o.order_no)], ["purchase", "PO", () => purchases.map((p) => p.po_no)],
];
export const counters: DocCounter[] = [
  ...COUNTERS.map(([type, prefix]) => ({ type, prefix, padding: type === "invoice" ? 5 : 4, last_number: 0 })),
  { type: "challan", prefix: "CH", padding: 4, last_number: 0 }, { type: "receipt", prefix: "RC", padding: 4, last_number: 0 }, { type: "voucher", prefix: "SV", padding: 4, last_number: 0 },
  { type: "customer", prefix: "CUS", padding: 4, last_number: 0 }, { type: "supplier", prefix: "SUP", padding: 4, last_number: 0 },
];
const counterView = () => counters.map((c) => {
  const src = COUNTERS.find(([t]) => t === c.type)?.[2]();
  const used = src ? src.reduce((m, x) => Math.max(m, Number(x.split("-")[1]) || 0), 0) : 0;
  return { ...c, last_number: Math.max(c.last_number, used) };
});

// ---------- Activity log ----------
export const activity: ActivityRow[] = [];
const TABLE: Record<string, string> = { products: "products", variants: "variants", categories: "categories", units: "units", customers: "customers", suppliers: "suppliers", invoices: "invoices", "invoice-items": "invoices", orders: "sales_orders", payments: "payments", challans: "challans", purchases: "purchase_orders", "purchase-items": "purchase_orders", "supplier-payments": "supplier_payments", stock: "stock_movements", settings: "settings", users: "users", clients: "clients", certifications: "certifications", enquiries: "enquiries" };
/** Called by the mock router after every successful admin write. */
export function logActivity(user: User | null, method: string, path: string, result: unknown) {
  if (method === "GET" || !user || path.startsWith("/auth") || path.startsWith("/public")) return;
  const seg = path.split("/")[1] ?? "";
  const table = TABLE[seg]; if (!table) return;
  const data = (result as { data?: Record<string, unknown> } | undefined)?.data ?? {};
  const record = String(data["invoice_no"] ?? data["order_no"] ?? data["po_no"] ?? data["voucher_no"] ?? data["receipt_no"] ?? data["code"] ?? data["sku"] ?? data["email"] ?? data["name"] ?? path.split("/")[2] ?? "");
  const action = method === "DELETE" ? "delete" : method === "POST" && !/\/\d+\//.test(path) && !/\/\d+$/.test(path) ? "create" : "update";
  activity.unshift({ id: activity.length + 1, created_at: new Date().toISOString(), user_id: user.id, user_name: user.full_name, action, table_name: table, record, summary: `${method} ${path}` });
}

// ---------- Enquiries ----------
export function addPublicEnquiry(body: unknown) {
  const get = (k: string) => (body instanceof FormData ? body.get(k) : (body as Record<string, unknown> | undefined)?.[k]);
  const file = get("file");
  const productId = Number(get("product_id") ?? 0);
  const e: Enquiry = { id: nextId(db.enquiries), name: String(get("name") ?? "").trim(), company: str(get("company")), phone: String(get("phone") ?? "").trim(), email: str(get("email")),
    product_name: db.products.find((p) => p.id === productId)?.name ?? null, quantity: str(get("quantity")), message: str(get("message")), wants_sample: get("wants_sample") === "1" || get("wants_sample") === true,
    status: "new", created_at: new Date().toISOString(), required_date: str(get("required_date")), internal_note: null, attachment_name: file && typeof file === "object" && "name" in file ? String((file as File).name) : null, converted_order_id: null };
  db.enquiries.unshift(e);
  return e;
}
const STATUSES: EnquiryStatus[] = ["new", "contacted", "quoted", "won", "lost"];

export const isBackofficePath = (path: string) => /^\/(reports|enquiries|clients|certifications|settings|users|activity-log)(\/|$)/.test(path);

export function backofficeRequest(method: string, path: string, query: Query, body: unknown, user: User): unknown {
  const route = `${method} ${path}`;
  const b = (body ?? {}) as Record<string, unknown>;
  const manager = isManager(user); const admin = user.role === "admin";
  let m: RegExpMatchArray | null;

  // ----- Enquiries (all roles) -----
  if (route === "GET /enquiries") {
    const term = String(query["q"] ?? "").toLowerCase(); const st = String(query["status"] ?? "");
    const rows = db.enquiries.filter((e) => (!st || e.status === st) && (!term || `${e.name} ${e.company ?? ""} ${e.phone} ${e.product_name ?? ""}`.toLowerCase().includes(term)));
    const page = Math.max(1, Number(query["page"] ?? 1)); const per_page = Math.min(100, Math.max(1, Number(query["per_page"] ?? 25)));
    return { data: rows.slice((page - 1) * per_page, page * per_page), meta: { page, per_page, total: rows.length } };
  }
  if ((m = path.match(/^\/enquiries\/(\d+)(\/attachment|\/convert)?$/))) {
    const e = db.enquiries.find((x) => x.id === Number(m![1]));
    if (!e) throw new ApiError(404, "not_found", "Enquiry not found.");
    if (m[2] === "/attachment" && method === "GET") {
      if (!e.attachment_name) throw new ApiError(404, "not_found", "This enquiry has no attachment.");
      return { data: { name: e.attachment_name, url: null, note: "In demo mode files are not stored. The live server streams the file here." } };
    }
    if (m[2] === "/convert" && method === "POST") {
      if (e.converted_order_id) return { data: { order_id: e.converted_order_id } };
      let customerId = Number(b["customer_id"] ?? 0);
      if (!customerId) {
        const c = partyRequest("POST", "/customers", {}, { name: e.company ?? e.name, contact_person: e.company ? e.name : null, phone: e.phone, email: e.email, type: "other", notes: `From enquiry #${e.id}` }, user) as { data: { id: number } };
        customerId = c.data.id;
      }
      const o = salesRequest("POST", "/orders", {}, { customer_id: customerId, order_date: today(), delivery_date: e.required_date ?? null, discount: "0", notes: [e.message, e.quantity ? `Qty asked: ${e.quantity}` : null].filter(Boolean).join("\n") || null,
        items: [{ variant_id: null, description: e.product_name ?? "As per enquiry", unit_code: "pcs", quantity: "1", rate: "0", discount_percent: "0" }] }, user) as { data: { id: number } };
      e.converted_order_id = o.data.id; e.status = "quoted";
      return { data: { order_id: o.data.id } };
    }
    if (method === "GET") return { data: e };
    if (method === "PUT") {
      if (b["status"] !== undefined && !STATUSES.includes(b["status"] as EnquiryStatus)) throw new ApiError(422, "validation_error", "Choose a status.", { status: "Choose a status." });
      if (b["status"]) e.status = b["status"] as EnquiryStatus;
      if (b["internal_note"] !== undefined) e.internal_note = str(b["internal_note"]);
      return { data: e };
    }
  }

  // ----- Reports -----
  if (path.startsWith("/reports/")) {
    const kind = path.slice("/reports/".length);
    if (kind === "low-stock") return { data: stockRows().filter((r) => r.status !== "ok") };
    if (kind === "movements") {
      const names = new Map(stockRows().map((r) => [r.variant_id, r]));
      const vid = Number(query["variant_id"] ?? 0); const type = String(query["type"] ?? "");
      return { data: movementRows().filter((r) => inRange(r.created_at.slice(0, 10), query) && (!vid || r.variant_id === vid) && (!type || r.type === type))
        .map((r) => ({ ...r, date: r.created_at.slice(0, 10), display_name: names.get(r.variant_id)?.display_name ?? `#${r.variant_id}`, sku: names.get(r.variant_id)?.sku ?? "" })).reverse() };
    }
    if (kind === "dues") {
      const dues = (partyRequest("GET", "/customers/dues", { per_page: 100 }, undefined, user) as { data: CustomerDue[] }).data;
      const bucket = (d: number) => (d <= 30 ? "0-30" : d <= 60 ? "31-60" : d <= 90 ? "61-90" : "90+");
      const by = new Map<number, { customer_id: number; customer_name: string; total: string; "0-30": string; "31-60": string; "61-90": string; "90+": string }>();
      for (const d of dues) {
        const row = by.get(d.customer_id) ?? { customer_id: d.customer_id, customer_name: d.customer_name, total: "0.00", "0-30": "0.00", "31-60": "0.00", "61-90": "0.00", "90+": "0.00" };
        const k = bucket(d.days_overdue); row[k] = addMoney(row[k], d.balance); row.total = addMoney(row.total, d.balance); by.set(d.customer_id, row);
      }
      return { data: [...by.values()] };
    }
    need(manager, "Only managers and admins can see this report.");
    if (kind === "stock") return { data: variantEntries().filter(({ variant }) => variant.is_active).map(({ product, variant }) => ({ variant_id: variant.id, sku: variant.sku, display_name: `${product.name} — ${variant.name}`, category_name: product.category.name, unit_code: product.unit_code, qty_on_hand: addQty(variant.stock_qty), purchase_price: variant.purchase_price ?? "0.00", value: toScaled(variant.stock_qty) > 0n ? mulMoney(variant.stock_qty, variant.purchase_price ?? "0") : "0.00" })) };
    const confirmed = db.invoices.filter((i) => ["due", "partial", "paid"].includes(i.status) && inRange(i.invoice_date, query));
    if (kind === "sales") {
      const g = String(query["group"] ?? "day"); const map = new Map<string, { key: string; label: string; count: number; total: string }>();
      const add = (key: string, label: string, v: string) => { const r = map.get(key) ?? { key, label, count: 0, total: "0.00" }; r.count++; r.total = addMoney(r.total, v); map.set(key, r); };
      for (const i of confirmed) {
        if (g === "customer") add(String(i.customer_id), i.customer_name, subMoney(i.subtotal, i.discount));
        else if (g === "product") for (const it of i.items ?? []) add(it.description, it.description, it.amount ?? "0");
        else add(i.invoice_date, i.invoice_date, subMoney(i.subtotal, i.discount));
      }
      return { data: [...map.values()].sort((a, b) => a.key.localeCompare(b.key)) };
    }
    if (kind === "purchases") {
      const g = String(query["group"] ?? "day"); const map = new Map<string, { key: string; label: string; count: number; total: string }>();
      const add = (key: string, label: string, v: string) => { const r = map.get(key) ?? { key, label, count: 0, total: "0.00" }; r.count++; r.total = addMoney(r.total, v); map.set(key, r); };
      if (g === "product") for (const po of purchases) { if (!inRange(po.order_date, query)) continue; for (const it of po.items) if (toScaled(it.qty_received) > 0n) add(String(it.variant_id), it.display_name, mulMoney(it.qty_received, it.rate)); }
      else for (const p of supplierPurchases) { if (!inRange(p.date, query)) continue; g === "supplier" ? add(String(p.supplier_id), db.suppliers.find((s) => s.id === p.supplier_id)?.name ?? "", p.received_value) : add(p.date, p.date, p.received_value); }
      return { data: [...map.values()].sort((a, b) => a.key.localeCompare(b.key)) };
    }
    if (kind === "payables") return { data: (partyRequest("GET", "/suppliers", { per_page: 100 }, undefined, user) as { data: Supplier[] }).data.map((s) => ({ supplier_id: s.id, code: s.code, name: s.name, total_purchased: s.total_purchased, paid: s.paid, payable_balance: s.payable_balance })) };
    if (kind === "profit") {
      const cost = new Map(variantEntries().map(({ variant }) => [variant.id, variant.purchase_price ?? "0"]));
      const sales = addMoney(...confirmed.map((i) => subMoney(i.subtotal, i.discount)));
      const c = addMoney(...confirmed.flatMap((i) => (i.items ?? []).map((it) => (it.variant_id ? mulMoney(it.quantity, cost.get(it.variant_id) ?? "0") : "0"))));
      return { data: { sales, cost: c, profit: subMoney(sales, c) } };
    }
    throw new ApiError(404, "not_found", "Unknown report.");
  }

  // ----- Content (manager+) -----
  if (/^\/(clients|certifications)/.test(path)) {
    need(manager, "Only managers and admins can edit website content.");
    if (route === "GET /clients") return { data: [...adminClients].sort((a, b) => a.sort_order - b.sort_order) };
    if (route === "GET /certifications") return { data: adminCertifications };
    const cleanClient = () => {
      if (!str(b["name"])) throw new ApiError(422, "validation_error", "Name is required.", { name: "Name is required." });
      return { name: str(b["name"])!, logo_url: str(b["logo_url"]) ?? "", sort_order: Number(b["sort_order"] ?? 0) || 0, is_active: b["is_active"] !== false, permission_confirmed: b["permission_confirmed"] === true };
    };
    const cleanCert = () => {
      const fields: Record<string, string> = {};
      if (!str(b["name"])) fields["name"] = "Name is required.";
      if (b["is_published"] === true && b["holder_confirmed"] !== true) fields["holder_confirmed"] = "Tick the confirmation before publishing.";
      if (Object.keys(fields).length) throw new ApiError(422, "validation_error", Object.values(fields)[0]!, fields);
      return { name: str(b["name"])!, description: str(b["description"]), certificate_number: str(b["certificate_number"]), image_url: str(b["image_url"]), is_published: b["is_published"] === true, holder_confirmed: b["holder_confirmed"] === true };
    };
    if (route === "POST /clients") { const c = { ...cleanClient(), id: nextId(adminClients) }; adminClients.push(c); return { data: c }; }
    if (route === "POST /certifications") { const c = { ...cleanCert(), id: nextId(adminCertifications) }; adminCertifications.push(c); return { data: c }; }
    if ((m = path.match(/^\/(clients|certifications)\/(\d+)$/))) {
      const list: { id: number }[] = m[1] === "clients" ? adminClients : adminCertifications;
      const idx = list.findIndex((x) => x.id === Number(m![2]));
      if (idx < 0) throw new ApiError(404, "not_found", "Not found.");
      if (method === "DELETE") { list.splice(idx, 1); return { data: { ok: true } }; }
      if (method === "PUT") { Object.assign(list[idx]!, m[1] === "clients" ? cleanClient() : cleanCert()); return { data: list[idx] }; }
    }
  }

  // ----- Settings, users, activity (admin; GET settings manager+) -----
  if (route === "GET /settings") { need(manager, "Only managers and admins can view company settings."); return { data: companySettings }; }
  need(admin, "Only admins can change settings and users.");
  if (route === "PUT /settings") {
    const fields: Record<string, string> = {};
    if (!str(b["company_name"])) fields["company_name"] = "Company name is required.";
    const rate = String(b["tax_rate"] ?? "0");
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(rate)) fields["tax_rate"] = "Enter a rate like 7.5.";
    if (Object.keys(fields).length) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", fields);
    const list = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(",")).map((x) => String(x).trim()).filter(Boolean);
    Object.assign(companySettings, {
      company_name: str(b["company_name"]), tagline: str(b["tagline"]) ?? "", address: str(b["address"]) ?? "", phones: list(b["phones"]), emails: list(b["emails"]),
      whatsapp: str(b["whatsapp"]), facebook_url: str(b["facebook_url"]), youtube_url: str(b["youtube_url"]), website_url: str(b["website_url"]), map_embed_url: str(b["map_embed_url"]),
      logo_url: str(b["logo_url"]) ?? companySettings.logo_url, bin: str(b["bin"]), tin: str(b["tin"]), trade_licence: str(b["trade_licence"]), bank_details: str(b["bank_details"]), invoice_footer: str(b["invoice_footer"]),
      tax_enabled: b["tax_enabled"] === true, tax_rate: Number(rate).toFixed(2),
    });
    // Public settings and printed documents read the same values.
    Object.assign(db.settings, { company_name: companySettings.company_name, tagline: companySettings.tagline, address: companySettings.address, phones: companySettings.phones, emails: companySettings.emails, whatsapp: companySettings.whatsapp, facebook_url: companySettings.facebook_url, youtube_url: companySettings.youtube_url, website_url: companySettings.website_url, map_embed_url: companySettings.map_embed_url, logo_url: companySettings.logo_url });
    Object.assign(company, { company_name: companySettings.company_name, address: companySettings.address, phones: companySettings.phones, emails: companySettings.emails, whatsapp: companySettings.whatsapp, logo_url: companySettings.logo_url, bin: companySettings.bin, bank_details: companySettings.bank_details, footer: companySettings.invoice_footer, tax_enabled: companySettings.tax_enabled, tax_rate: companySettings.tax_rate });
    return { data: companySettings };
  }
  if (route === "GET /settings/numbering") return { data: counterView() };
  if (route === "PUT /settings/numbering") {
    const rows = (b["counters"] ?? []) as DocCounter[]; const current = counterView();
    for (const r of rows) {
      const c = counters.find((x) => x.type === r.type); const now = current.find((x) => x.type === r.type);
      if (!c || !now) continue;
      if (!/^[A-Z]{1,6}$/.test(String(r.prefix))) throw new ApiError(422, "validation_error", `Prefix for ${r.type} must be 1-6 capital letters.`, { [`${r.type}.prefix`]: "Use 1-6 capital letters." });
      if (Number(r.last_number) < now.last_number) throw new ApiError(422, "validation_error", `The ${r.type} counter cannot go below ${now.last_number}.`, { [`${r.type}.last_number`]: `Cannot go below ${now.last_number}.` });
      Object.assign(c, { prefix: r.prefix, padding: Math.min(8, Math.max(3, Number(r.padding) || 4)), last_number: Number(r.last_number) });
    }
    return { data: counterView() };
  }
  const view = (u: (typeof db.users)[number]): AdminUser => { const { password: _p, ...rest } = u; return { ...rest, created_at: "2026-11-01" }; };
  if (route === "GET /users") return { data: db.users.map(view) };
  const ROLES: (Role | null)[] = ["admin", "manager", "staff", null];
  if (route === "POST /users") {
    const email = String(b["email"] ?? "").trim().toLowerCase(); const fields: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) fields["email"] = "Enter a valid email.";
    else if (db.users.some((u) => u.email === email)) fields["email"] = "That email already has an account.";
    if (!str(b["full_name"])) fields["full_name"] = "Name is required.";
    if (String(b["password"] ?? "").length < 8) fields["password"] = "Use at least 8 characters.";
    if (!ROLES.includes((b["role"] ?? null) as Role | null)) fields["role"] = "Choose a role.";
    if (Object.keys(fields).length) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", fields);
    const u = { id: nextId(db.users), email, full_name: str(b["full_name"])!, role: (b["role"] ?? null) as Role | null, is_active: true, password: String(b["password"]) };
    db.users.push(u); return { data: view(u) };
  }
  if ((m = path.match(/^\/users\/(\d+)(\/reset-password)?$/))) {
    const u = db.users.find((x) => x.id === Number(m![1]));
    if (!u) throw new ApiError(404, "not_found", "User not found.");
    if (m[2] && method === "POST") { const temp = `Temp-${Math.random().toString(36).slice(2, 8)}`; u.password = temp; return { data: { temporary_password: temp } }; }
    if (method === "PUT") {
      const role = b["role"] === undefined ? u.role : (b["role"] as Role | null);
      const active = b["is_active"] === undefined ? u.is_active : b["is_active"] === true;
      if (!ROLES.includes(role)) throw new ApiError(422, "validation_error", "Choose a role.", { role: "Choose a role." });
      const otherAdmins = db.users.filter((x) => x.id !== u.id && x.role === "admin" && x.is_active).length;
      if (u.role === "admin" && (role !== "admin" || !active) && otherAdmins === 0) throw new ApiError(409, "last_admin", "You cannot remove or deactivate the last admin.");
      Object.assign(u, { role, is_active: active, full_name: str(b["full_name"]) ?? u.full_name });
      return { data: view(u) };
    }
  }
  if (route === "GET /activity-log") {
    const t = String(query["table"] ?? ""); const a = String(query["action"] ?? ""); const uid = Number(query["user_id"] ?? 0);
    const rows = activity.filter((r) => (!t || r.table_name === t) && (!a || r.action === a) && (!uid || r.user_id === uid) && inRange(r.created_at.slice(0, 10), query));
    const page = Math.max(1, Number(query["page"] ?? 1)); const per_page = Math.min(100, Math.max(1, Number(query["per_page"] ?? 50)));
    return { data: rows.slice((page - 1) * per_page, page * per_page), meta: { page, per_page, total: rows.length } };
  }
  throw new ApiError(404, "not_found", `No mock for ${route}`);
}
