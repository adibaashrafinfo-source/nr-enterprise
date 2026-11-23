// The only place that talks to the REST API. Components call these typed functions, never fetch.
import { API_BASE, USE_MOCK } from "@/config/flags";
import { mockRequest } from "@/mocks";
import { ApiError } from "./api-error";
import { shouldRedirectAdminUnauthorized } from "./admin-access";
import type {
  AdminCategory, AdminProduct, AdminProductSummary, AdminSearchResults, Category, CategoryInput, Certification, Client,
  DashboardSummary, Enquiry, Invoice, LowStockItem, MeResponse, Paged, ProductImage, ProductImportResult, ProductImportRow,
  ProductInput, PublicProduct, PublicProductSummary, PublicSettings, SalesDay, Customer, CustomerDue, CustomerInput, LedgerRow, PartyImportResult, Payment, Supplier, SupplierInput, StockAdjustInput, StockLedgerRow, StockRow, StockValue, OpeningStockInput, Unit, UnitInput, Variant, VariantInput,
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
export interface AdminProductListQuery { q?: string; category_id?: number; status?: "active" | "archived"; page?: number; per_page?: number }

export interface StockListQuery { q?: string; category_id?: number; status?: "ok" | "low" | "out"; page?: number; per_page?: number }
export interface StockMovementQuery { type?: string; from?: string; to?: string; page?: number; per_page?: number }

export interface CustomerListQuery { q?: string; type?: string; has_due?: 1; page?: number; per_page?: number }
export interface LedgerRange { from?: string; to?: string }
export type CustomerProfile = Customer & { invoices: Invoice[]; payments: Pick<Payment, "id" | "receipt_no" | "payment_date" | "amount">[] };
export type SupplierProfile = Supplier & { purchases: { id: number; po_no: string; date: string; received_value: string }[]; payments: { id: number; voucher_no: string; payment_date: string; amount: string }[] };

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
  stock: (query: StockListQuery = {}) => request<Paged<StockRow>>("GET", "/stock", { query: { ...query } }),
  stockMovements: (variantId: number, query: StockMovementQuery = {}) => request<Paged<StockLedgerRow> & { variant: StockRow }>("GET", `/stock/${variantId}/movements`, { query: { ...query } }),
  stockValue: () => request<One<StockValue>>("GET", "/stock/value").then((r) => r.data),
  openingStock: (input: OpeningStockInput) => request<One<StockLedgerRow>>("POST", "/stock/opening", { body: input }).then((r) => r.data),
  adjustStock: (input: StockAdjustInput) => request<One<StockLedgerRow>>("POST", "/stock/adjust", { body: input }).then((r) => r.data),
  recentInvoices: () => request<Paged<Invoice>>("GET", "/invoices", { query: { page: 1, per_page: 5 } }),
  newEnquiries: () => request<Paged<Enquiry>>("GET", "/enquiries", { query: { status: "new", page: 1, per_page: 5 } }),
  search: (q: string) => request<One<AdminSearchResults>>("GET", "/search", { query: { q } }).then((r) => r.data),
  products: (query: AdminProductListQuery = {}) => request<Paged<AdminProductSummary>>("GET", "/products", { query: { ...query } }),
  product: (id: number) => request<One<AdminProduct>>("GET", `/products/${id}`).then((r) => r.data),
  createProduct: (input: ProductInput) => request<One<AdminProduct>>("POST", "/products", { body: input }).then((r) => r.data),
  updateProduct: (id: number, input: ProductInput) => request<One<AdminProduct>>("PUT", `/products/${id}`, { body: input }).then((r) => r.data),
  archiveProduct: (id: number) => request<One<{ ok: boolean }>>("DELETE", `/products/${id}`).then((r) => r.data),
  categories: () => request<One<AdminCategory[]>>("GET", "/categories").then((r) => r.data),
  createCategory: (input: CategoryInput) => request<One<AdminCategory>>("POST", "/categories", { body: input }).then((r) => r.data),
  updateCategory: (id: number, input: CategoryInput) => request<One<AdminCategory>>("PUT", `/categories/${id}`, { body: input }).then((r) => r.data),
  deleteCategory: (id: number) => request<One<{ ok: boolean }>>("DELETE", `/categories/${id}`).then((r) => r.data),
  units: () => request<One<Unit[]>>("GET", "/units").then((r) => r.data),
  saveUnit: (input: UnitInput) => request<One<Unit>>("POST", "/units", { body: input }).then((r) => r.data),
  uploadProductImage: (productId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<One<ProductImage>>("POST", `/products/${productId}/images`, { body: form }).then((r) => r.data);
  },
  orderProductImages: (productId: number, ids: number[], primaryId: number) =>
    request<One<ProductImage[]>>("PUT", `/products/${productId}/images/order`, { body: { ids, primary_id: primaryId } }).then((r) => r.data),
  deleteProductImage: (imageId: number) => request<One<{ ok: boolean }>>("DELETE", `/product-images/${imageId}`).then((r) => r.data),
  createVariant: (productId: number, input: VariantInput) => request<One<Variant>>("POST", `/products/${productId}/variants`, { body: input }).then((r) => r.data),
  updateVariant: (id: number, input: VariantInput) => request<One<Variant>>("PUT", `/variants/${id}`, { body: input }).then((r) => r.data),
  archiveVariant: (id: number) => request<One<{ ok: boolean }>>("DELETE", `/variants/${id}`).then((r) => r.data),
  customers: (query: CustomerListQuery = {}) => request<Paged<Customer>>("GET", "/customers", { query: { ...query } }),
  customerDues: () => request<Paged<CustomerDue>>("GET", "/customers/dues", { query: { per_page: 100 } }),
  customer: (id: number) => request<One<CustomerProfile>>("GET", `/customers/${id}`).then((r) => r.data),
  customerLedger: (id: number, range: LedgerRange = {}) => request<One<LedgerRow[]>>("GET", `/customers/${id}/ledger`, { query: { ...range } }).then((r) => r.data),
  createCustomer: (input: CustomerInput) => request<One<Customer>>("POST", "/customers", { body: input }).then((r) => r.data),
  updateCustomer: (id: number, input: CustomerInput) => request<One<Customer>>("PUT", `/customers/${id}`, { body: input }).then((r) => r.data),
  deleteCustomer: (id: number) => request<One<{ ok: boolean; archived: boolean }>>("DELETE", `/customers/${id}`).then((r) => r.data),
  importCustomers: (rows: Partial<CustomerInput>[]) => request<One<PartyImportResult>>("POST", "/customers/import", { body: { rows } }).then((r) => r.data),
  suppliers: (query: { q?: string; page?: number; per_page?: number } = {}) => request<Paged<Supplier>>("GET", "/suppliers", { query: { ...query } }),
  supplier: (id: number) => request<One<SupplierProfile>>("GET", `/suppliers/${id}`).then((r) => r.data),
  supplierLedger: (id: number, range: LedgerRange = {}) => request<One<LedgerRow[]>>("GET", `/suppliers/${id}/ledger`, { query: { ...range } }).then((r) => r.data),
  createSupplier: (input: SupplierInput) => request<One<Supplier>>("POST", "/suppliers", { body: input }).then((r) => r.data),
  updateSupplier: (id: number, input: SupplierInput) => request<One<Supplier>>("PUT", `/suppliers/${id}`, { body: input }).then((r) => r.data),
  deleteSupplier: (id: number) => request<One<{ ok: boolean; archived: boolean }>>("DELETE", `/suppliers/${id}`).then((r) => r.data),
  importProducts: (rows: ProductImportRow[]) => request<One<ProductImportResult>>("POST", "/products/import", { body: { rows } }).then((r) => r.data),
};
