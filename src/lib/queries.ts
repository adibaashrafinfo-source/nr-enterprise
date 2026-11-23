import { queryOptions } from "@tanstack/react-query";
import { publicApi, type ProductListQuery } from "./api";

export const settingsQuery = () => queryOptions({ queryKey: ["public", "settings"], queryFn: publicApi.settings, staleTime: 5 * 60_000 });
export const categoriesQuery = () => queryOptions({ queryKey: ["public", "categories"], queryFn: publicApi.categories, staleTime: 5 * 60_000 });
export const productsQuery = (q: ProductListQuery) => queryOptions({ queryKey: ["public", "products", q], queryFn: () => publicApi.products(q), staleTime: 60_000 });
export const productQuery = (slug: string) => queryOptions({ queryKey: ["public", "product", slug], queryFn: () => publicApi.product(slug), staleTime: 60_000 });
export const clientsQuery = () => queryOptions({ queryKey: ["public", "clients"], queryFn: publicApi.clients, staleTime: 5 * 60_000 });
export const certificationsQuery = () => queryOptions({ queryKey: ["public", "certifications"], queryFn: publicApi.certifications, staleTime: 5 * 60_000 });
