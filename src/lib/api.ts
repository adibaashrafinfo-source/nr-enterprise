// The only place that talks to the REST API. Components call these typed functions, never fetch.
import { API_BASE, USE_MOCK } from "@/config/flags";
import { mockRequest } from "@/mocks";
import { ApiError } from "./api-error";
import type {
  Category, Certification, Client, MeResponse, Paged, PublicProduct, PublicProductSummary, PublicSettings,
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
      handleAuthErrors(e);
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
    handleAuthErrors(e);
    throw e;
  }
  return json as T;
}

function handleAuthErrors(e: unknown) {
  if (!(e instanceof ApiError) || typeof window === "undefined") return;
  if (e.status === 401 && window.location.pathname.startsWith("/admin") && !window.location.pathname.startsWith("/admin/login")) {
    window.location.assign("/admin/login");
  }
}

type One<T> = { data: T };

export const authApi = {
  me: () => request<One<MeResponse>>("GET", "/auth/me").then((r) => r.data),
  login: (email: string, password: string) => request<One<MeResponse>>("POST", "/auth/login", { body: { email, password } }).then((r) => r.data),
  logout: () => request<One<{ ok: boolean }>>("POST", "/auth/logout"),
  register: (b: { email: string; password: string; full_name: string }) => request<One<MeResponse>>("POST", "/auth/register", { body: b }),
  forgotPassword: (email: string) => request("POST", "/auth/forgot-password", { body: { email } }),
  resetPassword: (token: string, password: string) => request("POST", "/auth/reset-password", { body: { token, password } }),
  changePassword: (current_password: string, new_password: string) => request("POST", "/auth/change-password", { body: { current_password, new_password } }),
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
