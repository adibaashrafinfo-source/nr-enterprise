import { queryOptions } from "@tanstack/react-query";
import { adminApi, publicApi, type AdminProductListQuery, type StockListQuery, type CustomerListQuery, type LedgerRange, type SalesListQuery, type StockMovementQuery, type ProductListQuery, type PurchaseListQuery } from "./api";
import type { Role } from "./types";

export const settingsQuery = () => queryOptions({ queryKey: ["public", "settings"], queryFn: publicApi.settings, staleTime: 5 * 60_000 });
export const categoriesQuery = () => queryOptions({ queryKey: ["public", "categories"], queryFn: publicApi.categories, staleTime: 5 * 60_000 });
export const productsQuery = (q: ProductListQuery) => queryOptions({ queryKey: ["public", "products", q], queryFn: () => publicApi.products(q), staleTime: 60_000 });
export const productQuery = (slug: string) => queryOptions({ queryKey: ["public", "product", slug], queryFn: () => publicApi.product(slug), staleTime: 60_000 });
export const clientsQuery = () => queryOptions({ queryKey: ["public", "clients"], queryFn: publicApi.clients, staleTime: 5 * 60_000 });
export const certificationsQuery = () => queryOptions({ queryKey: ["public", "certifications"], queryFn: publicApi.certifications, staleTime: 5 * 60_000 });

// Admin query keys are scoped by the signed-in account and role so cached privileged values never cross account changes.
export const dashboardSummaryQuery = (userId: number, role: Role) => queryOptions({
  queryKey: ["admin", userId, role, "dashboard", "summary"], queryFn: adminApi.dashboardSummary, staleTime: 30_000,
});
export const salesByDayQuery = (userId: number, days: 7 | 30) => queryOptions({
  queryKey: ["admin", userId, "dashboard", "sales-by-day", days], queryFn: () => adminApi.salesByDay(days), staleTime: 30_000,
});
export const lowStockQuery = (userId: number) => queryOptions({
  queryKey: ["admin", userId, "stock", "low"], queryFn: adminApi.lowStock, staleTime: 30_000,
});
export const recentInvoicesQuery = (userId: number) => queryOptions({
  queryKey: ["admin", userId, "invoices", "recent"], queryFn: adminApi.recentInvoices, staleTime: 30_000,
});
export const newEnquiriesQuery = (userId: number) => queryOptions({
  queryKey: ["admin", userId, "enquiries", "new"], queryFn: adminApi.newEnquiries, staleTime: 30_000,
});
export const adminSearchQuery = (userId: number, q: string) => queryOptions({
  queryKey: ["admin", userId, "search", q], queryFn: () => adminApi.search(q), enabled: q.trim().length >= 2, staleTime: 15_000,
});

export const adminProductsQuery = (userId: number, role: Role, query: AdminProductListQuery) => queryOptions({
  queryKey: ["admin", userId, role, "catalogue", "products", query], queryFn: () => adminApi.products(query), staleTime: 30_000,
});
export const adminProductQuery = (userId: number, role: Role, id: number) => queryOptions({
  queryKey: ["admin", userId, role, "catalogue", "product", id], queryFn: () => adminApi.product(id), enabled: id > 0, staleTime: 30_000,
});
export const adminCategoriesQuery = (userId: number, role: Role) => queryOptions({
  queryKey: ["admin", userId, role, "catalogue", "categories"], queryFn: adminApi.categories, staleTime: 30_000,
});
export const adminUnitsQuery = (userId: number, role: Role) => queryOptions({
  queryKey: ["admin", userId, role, "catalogue", "units"], queryFn: adminApi.units, staleTime: 30_000,
});

export const stockQuery = (userId: number, role: Role, query: StockListQuery) => queryOptions({
  queryKey: ["admin", userId, role, "stock", "list", query], queryFn: () => adminApi.stock(query), staleTime: 15_000,
});
export const stockMovementsQuery = (userId: number, role: Role, variantId: number, query: StockMovementQuery) => queryOptions({
  queryKey: ["admin", userId, role, "stock", "movements", variantId, query], queryFn: () => adminApi.stockMovements(variantId, query), staleTime: 15_000,
});
export const stockValueQuery = (userId: number, role: Role) => queryOptions({
  queryKey: ["admin", userId, role, "stock", "value"], queryFn: adminApi.stockValue, staleTime: 15_000,
});

export const customersQuery = (userId: number, role: Role, query: CustomerListQuery) => queryOptions({
  queryKey: ["admin", userId, role, "customers", "list", query], queryFn: () => adminApi.customers(query), staleTime: 15_000,
});
export const customerDuesQuery = (userId: number, role: Role) => queryOptions({
  queryKey: ["admin", userId, role, "customers", "dues"], queryFn: adminApi.customerDues, staleTime: 15_000,
});
export const customerQuery = (userId: number, role: Role, id: number) => queryOptions({
  queryKey: ["admin", userId, role, "customers", "one", id], queryFn: () => adminApi.customer(id), staleTime: 15_000,
});
export const customerLedgerQuery = (userId: number, role: Role, id: number, range: LedgerRange) => queryOptions({
  queryKey: ["admin", userId, role, "customers", "ledger", id, range], queryFn: () => adminApi.customerLedger(id, range), staleTime: 15_000,
});
export const suppliersQuery = (userId: number, role: Role, query: { q?: string; page?: number; per_page?: number }) => queryOptions({
  queryKey: ["admin", userId, role, "suppliers", "list", query], queryFn: () => adminApi.suppliers(query), staleTime: 15_000,
});
export const supplierQuery = (userId: number, role: Role, id: number) => queryOptions({
  queryKey: ["admin", userId, role, "suppliers", "one", id], queryFn: () => adminApi.supplier(id), staleTime: 15_000,
});
export const supplierLedgerQuery = (userId: number, role: Role, id: number, range: LedgerRange) => queryOptions({
  queryKey: ["admin", userId, role, "suppliers", "ledger", id, range], queryFn: () => adminApi.supplierLedger(id, range), staleTime: 15_000,
});

export const ordersQuery = (userId: number, role: Role, query: SalesListQuery) => queryOptions({
  queryKey: ["admin", userId, role, "sales", "orders", query], queryFn: () => adminApi.orders(query), staleTime: 10_000,
});
export const orderQuery = (userId: number, role: Role, id: number) => queryOptions({
  queryKey: ["admin", userId, role, "sales", "order", id], queryFn: () => adminApi.order(id), staleTime: 10_000,
});
export const invoicesQuery = (userId: number, role: Role, query: SalesListQuery) => queryOptions({
  queryKey: ["admin", userId, role, "sales", "invoices", query], queryFn: () => adminApi.invoices(query), staleTime: 10_000,
});
export const invoiceQuery = (userId: number, role: Role, id: number) => queryOptions({
  queryKey: ["admin", userId, role, "sales", "invoice", id], queryFn: () => adminApi.invoice(id), staleTime: 10_000,
});
export const variantSearchQuery = (userId: number, role: Role, q: string) => queryOptions({
  queryKey: ["admin", userId, role, "sales", "variant-search", q], queryFn: () => adminApi.variantSearch(q), staleTime: 10_000,
});

export const purchasesQuery = (userId: number, role: Role, query: PurchaseListQuery) => queryOptions({
  queryKey: ["admin", userId, role, "purchases", "list", query], queryFn: () => adminApi.purchases(query), staleTime: 10_000,
});
export const purchaseQuery = (userId: number, role: Role, id: number) => queryOptions({
  queryKey: ["admin", userId, role, "purchases", "one", id], queryFn: () => adminApi.purchase(id), staleTime: 10_000,
});
export const pendingReceiptsQuery = (userId: number, role: Role) => queryOptions({
  queryKey: ["admin", userId, role, "purchases", "pending"], queryFn: adminApi.pendingReceipts, staleTime: 10_000,
});
export const reorderSuggestionsQuery = (userId: number, role: Role) => queryOptions({
  queryKey: ["admin", userId, role, "purchases", "reorder"], queryFn: adminApi.reorderSuggestions, staleTime: 10_000,
});
