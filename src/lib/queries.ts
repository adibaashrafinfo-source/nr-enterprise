import { queryOptions } from "@tanstack/react-query";
import { adminApi, publicApi, type ProductListQuery } from "./api";
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
