// The only place that talks to the REST API. Components call these typed functions, never fetch.
import { API_BASE, USE_MOCK } from "@/config/flags";
import { mockRequest } from "@/mocks";
import { ApiError } from "./api-error";
import { shouldRedirectAdminUnauthorized } from "./admin-access";
import type {
  AdminSearchResults, Category, Certification, Client, DashboardSummary, Enquiry, Invoice, LowStockItem, MeResponse, Paged, PublicProduct, PublicProductSummary, PublicSettings, SalesDay,
} from "./types";

export { ApiError };

let csrfToken: string | null = null;
export const setCsrfToken = (t: string | null) => { csrfToken = t; };

type Query = Record<string, string | number | undefined>;

async function request<T>(method: string, path: string, opts: { query?: Query; body?: unknown } = {}): Promise<T> {
  const { query = {}, body } = opts;
  if (USE_MOCK) {
    try {
      return (await mockRequest(method, path, query, body)) as T;
    } catch (e) {
      handleAuthErrors(e, path);
      throw e;
    }
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (!isForm && body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;

  const init: RequestInit = { method, headers, credentials: "same-origin" };
  if (body !== undefined) init.body = isForm ? (body as FormData) : JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}${qs.size ? `?${qs}` : ""}`, init);
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.error;
    const e = new ApiError(res.status, err?.code ?? "error", err?.message ?? "Something went wrong.", err?.fields);
    handleAuthErrors(e, path);
    throw e;
  }
  return json as T;
}

function handleAuthErrors(e: unknown, apiPath: string) {
  if (!(e instanceof ApiError) || typeof window === "undefined" || e.status !== 401) return;
  if (shouldRedirectAdminUnauthorized(window.location.pathname, apiPath)) window.location.assign("/admin/login");
}

type One<T> = { data: T };

export const authApi = {
  me: () => request<One<MeResponse>>("GET", "/auth/me").then((r) => r.data),
  login: (email: string, password: string) => request<One<MeResponse>>("POST", "/auth/login", { body: { email, password } }).then((r) => r.data),
  logout: () => request<One<{ ok: boolean }>>("POST", "/auth/logout"),
  register: (b: { email: string; password: string; full_name: string }) => request<One<MeResponse>>("POST", "/auth/register", { body: b }),
  forgotPassword: (email: string) => request<One<{ ok: boolean; demo_reset_url?: string }>>("POST", "/auth/forgot-password", { body: { email } }).then((r) => r.data),
  resetPassword: (token: string, password: string) => request<One<{ ok: boolean }>>("POST", "/auth/reset-password", { body: { token, password } }).then((r) => r.data),
  changePassword: (current_password: string, new_password: string) => request<One<{ ok: boolean }>>("POST", "/auth/change-password", { body: { current_password, new_password } }).then((r) => r.data),
};

export interface ProductListQuery { category?: string; q?: string; featured?: 1; page?: number; per_page?: number }

export const publicApi = {
  settings: () => request<One<PublicSettings>>("GET", "/public/settings").then((r) => r.data),
  categories: () => request<One<Category[]>>("GET", "/public/categories").then((r) => r.data),
  products: (q: ProductListQuery = {}) => request<Paged<PublicProductSummary>>("GET", "/public/products", { query: { ...q } }),
  product: (slug: string) => request<One<PublicProduct>>("GET", `/public/products/${encodeURIComponent(slug)}`).then((r) => r.data),
  clients: () => request<One<Client[]>>("GET", "/public/clients").then((r) => r.data),
  certifications: () => request<One<Certification[]>>("GET", "/public/certifications").then((r) => r.data),
  submitEnquiry: (form: FormData) => request<One<{ id: number; ok: boolean }>>("POST", "/public/enquiries", { body: form }).then((r) => r.data),
};

export const adminApi = {
  dashboardSummary: () => request<One<DashboardSummary>>("GET", "/dashboard/summary").then((r) => r.data),
  salesByDay: (days: 7 | 30) => request<One<SalesDay[]>>("GET", "/dashboard/sales-by-day", { query: { days } }).then((r) => r.data),
  lowStock: () => request<Paged<LowStockItem>>("GET", "/stock", { query: { status: "low", per_page: 5 } }),
  recentInvoices: () => request<Paged<Invoice>>("GET", "/invoices", { query: { page: 1, per_page: 5 } }),
  newEnquiries: () => request<Paged<Enquiry>>("GET", "/enquiries", { query: { status: "new", page: 1, per_page: 5 } }),
  search: (q: string) => request<One<AdminSearchResults>>("GET", "/search", { query: { q } }).then((r) => r.data),
};
