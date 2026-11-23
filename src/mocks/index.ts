// In-memory mock of the PHP REST API. Same paths, field names and envelopes as docs/NRE_BACKEND_API.md.
import { ApiError } from "@/lib/api-error";
import { addMoney } from "@/lib/money";
import type { DashboardSummary, LowStockItem, PublicProductSummary, Role, SalesDay, User } from "@/lib/types";
import * as db from "./seed";
import { catalogueRequest, isCatalogueAdminPath, isPublic, publicVariants } from "./catalogue";

type Query = Record<string, string | number | undefined>;
let session: User | null = null;
const CSRF = "mock-csrf-token";
const passwordResetTokens = new Map<string, number>();

const delay = () => new Promise((r) => setTimeout(r, 120));

function paginate<T>(rows: T[], q: Query, max = 100) {
  const page = Math.max(1, Number(q["page"] ?? 1));
  const per_page = Math.min(max, Math.max(1, Number(q["per_page"] ?? 25)));
  return { data: rows.slice((page - 1) * per_page, page * per_page), meta: { page, per_page, total: rows.length } };
}

function summary(p: (typeof db.products)[number]): PublicProductSummary {
  const { description: _d, features: _f, specs: _s, images: _i, variants: _v, related: _r, ...rest } = p;
  return rest;
}

const requireSession = () => {
  if (!session) throw new ApiError(401, "unauthenticated", "Please log in.");
  return session;
};

const requireDashboardRole = () => {
  const user = requireSession();
  if (!user.role) throw new ApiError(403, "forbidden", "Your account is waiting for approval.");
  return user;
};

const confirmedInvoices = () => db.invoices.filter((i) => i.status === "due" || i.status === "partial" || i.status === "paid");
const dayString = (date: Date) => date.toISOString().slice(0, 10);
const isoDayOffset = (offset: number) => {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return dayString(date);
};
const salesForDay = (day: string) => addMoney(...confirmedInvoices().filter((i) => i.invoice_date === day).map((i) => i.total));

function dashboardSummary(role: Role): DashboardSummary {
  const unpaid = db.invoices.filter((i) => i.status === "due" || i.status === "partial");
  const lowStockCount = db.stockBalances.filter((row) => row.status === "low" || row.status === "out").length;
  return {
    sales_today: salesForDay(isoDayOffset(0)),
    sales_yesterday: salesForDay(isoDayOffset(-1)),
    customer_dues: addMoney(...unpaid.map((i) => i.balance)),
    unpaid_invoices: unpaid.length,
    low_stock_count: lowStockCount,
    new_enquiries: db.enquiries.filter((e) => e.status === "new").length,
    variant_count: db.products.reduce((total, product) => total + product.variants.length, 0),
    stock_value: role === "staff" ? null : "0.00",
  };
}

function salesByDay(days: number): SalesDay[] {
  return Array.from({ length: days }, (_, index) => {
    const offset = index - days + 1;
    const day = isoDayOffset(offset);
    return { day, total: salesForDay(day) };
  });
}

export async function mockRequest(method: string, path: string, query: Query = {}, body?: unknown): Promise<unknown> {
  await delay();
  const route = `${method} ${path}`;

  if (route === "GET /public/settings") return { data: db.settings };
  if (route === "GET /public/categories") return { data: db.categories.map((c) => ({ ...c, product_count: db.products.filter((p) => p.category.id === c.id && isPublic(p)).length })) };
  if (route === "GET /public/clients") return { data: db.clients };
  if (route === "GET /public/certifications") return { data: [] };
  if (route === "GET /public/products") {
    let rows = db.products.filter(isPublic).sort((a, b) => a.category.id - b.category.id || a.sort_order - b.sort_order);
    if (query["category"]) rows = rows.filter((p) => p.category.slug === query["category"]);
    if (query["featured"]) rows = rows.filter((p) => p.is_featured);
    if (query["q"]) {
      const s = String(query["q"]).toLowerCase();
      rows = rows.filter((p) => p.name.toLowerCase().includes(s) || p.code.toLowerCase().includes(s));
    }
    return paginate(rows.map(summary), { per_page: 12, ...query }, 48);
  }
  const slug = path.match(/^\/public\/products\/([^/]+)$/)?.[1];
  if (method === "GET" && slug) {
    const p = db.products.find((x) => x.slug === slug && isPublic(x));
    if (!p) throw new ApiError(404, "not_found", "Product not found.");
    const related = db.products.filter(isPublic).filter((x) => x.category.id === p.category.id && x.id !== p.id).slice(0, 4).map(summary);
    return { data: { ...p, variants: publicVariants(p), related } };
  }
  if (route === "POST /public/enquiries") return { data: { id: Date.now(), ok: true } };

  if (route === "GET /auth/me") return { data: { user: requireSession(), csrf_token: CSRF } };
  if (route === "POST /auth/login") {
    const { email, password } = (body ?? {}) as { email?: string; password?: string };
    const u = db.users.find((x) => x.email === email?.toLowerCase() && x.password === password);
    if (!u) throw new ApiError(401, "invalid_credentials", "Email or password is incorrect.");
    const { password: _p, ...user } = u;
    session = user;
    return { data: { user, csrf_token: CSRF } };
  }
  if (route === "POST /auth/logout") { session = null; return { data: { ok: true } }; }
  if (route === "POST /auth/forgot-password") {
    const { email } = (body ?? {}) as { email?: string };
    const user = db.users.find((u) => u.email === email?.trim().toLowerCase() && u.is_active);
    if (!user) return { data: { ok: true } };
    const token = `demo-reset-${user.id}-${Date.now().toString(36)}`;
    passwordResetTokens.set(token, user.id);
    return { data: { ok: true, demo_reset_url: `/admin/reset-password?token=${encodeURIComponent(token)}` } };
  }
  if (route === "POST /auth/reset-password") {
    const { token, password } = (body ?? {}) as { token?: string; password?: string };
    const userId = token ? passwordResetTokens.get(token) : undefined;
    const user = userId === undefined ? undefined : db.users.find((u) => u.id === userId);
    if (!user || !password || password.length < 8) throw new ApiError(422, "invalid_reset", "The reset link is invalid or expired.");
    user.password = password;
    if (token) passwordResetTokens.delete(token);
    return { data: { ok: true } };
  }
  if (route === "POST /auth/change-password") {
    const user = requireSession();
    const { current_password, new_password } = (body ?? {}) as { current_password?: string; new_password?: string };
    const record = db.users.find((u) => u.id === user.id);
    if (!record || record.password !== current_password) throw new ApiError(422, "invalid_password", "Current password is incorrect.");
    if (!new_password || new_password.length < 8) throw new ApiError(422, "invalid_password", "Use at least 8 characters for your new password.");
    record.password = new_password;
    return { data: { ok: true } };
  }

  if (route === "GET /dashboard/summary") return { data: dashboardSummary(requireDashboardRole().role ?? "staff") };
  if (route === "GET /dashboard/sales-by-day") {
    requireDashboardRole();
    const rawDays = Number(query["days"] ?? 7);
    return { data: salesByDay(rawDays === 30 ? 30 : 7) };
  }
  if (route === "GET /stock") {
    requireDashboardRole();
    const status = query["status"];
    const rows = db.stockBalances.filter((row: LowStockItem) => !status || row.status === status);
    return paginate(rows, query);
  }
  if (route === "GET /invoices") {
    requireDashboardRole();
    const term = String(query["q"] ?? "").toLowerCase();
    const status = String(query["status"] ?? "");
    const rows = db.invoices.filter((invoice) => (!status || invoice.status === status) && (!term || `${invoice.invoice_no} ${invoice.customer_name}`.toLowerCase().includes(term)));
    return paginate(rows, query);
  }
  if (route === "GET /enquiries") {
    requireDashboardRole();
    const term = String(query["q"] ?? "").toLowerCase();
    const status = String(query["status"] ?? "");
    const rows = db.enquiries.filter((enquiry) => (!status || enquiry.status === status) && (!term || `${enquiry.name} ${enquiry.company ?? ""} ${enquiry.phone}`.toLowerCase().includes(term)));
    return paginate(rows, query);
  }
  if (route === "GET /search") {
    requireDashboardRole();
    const term = String(query["q"] ?? "").trim().toLowerCase();
    const matches = <T,>(rows: T[], value: (row: T) => string) => rows.filter((row) => term && value(row).toLowerCase().includes(term)).slice(0, 5);
    return { data: {
      products: matches(db.products, (p) => `${p.name} ${p.code}`).map((p) => ({ id: p.id, name: p.name, code: p.code, category_slug: p.category.slug })),
      variants: db.products.flatMap((p) => p.variants.map((v) => ({ id: v.id, sku: `${p.code}-${v.id}`, display_name: `${p.name} · ${v.name}`, product_id: p.id }))).filter((v) => term && `${v.sku} ${v.display_name}`.toLowerCase().includes(term)).slice(0, 5),
      customers: matches(db.customers, (c) => `${c.name} ${c.phone ?? ""}`).map((c) => ({ id: c.id, name: c.name, phone: c.phone })),
      invoices: matches(db.invoices, (i) => `${i.invoice_no} ${i.customer_name}`).map((i) => ({ id: i.id, invoice_no: i.invoice_no, customer_name: i.customer_name, total: i.total, status: i.status })),
    } };
  }

  if (isCatalogueAdminPath(path)) {
    const result = catalogueRequest(method, path, query, body, requireDashboardRole());
    if (result !== undefined) return result;
  }

  throw new ApiError(404, "not_implemented", `Mock endpoint not built yet: ${route}`);
}
