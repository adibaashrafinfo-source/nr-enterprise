import type { Role } from "./types";

const STAFF_PATHS = [
  "/admin",
  "/admin/products",
  "/admin/stock",
  "/admin/orders",
  "/admin/invoices",
  "/admin/customers",
  "/admin/purchases",
  "/admin/enquiries",
] as const;
const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"] as const;
const PUBLIC_AUTH_API_PATHS = ["/auth/me", "/auth/login", "/auth/forgot-password", "/auth/reset-password"] as const;

const within = (path: string, base: string) => path === base || path.startsWith(`${base}/`);

export function canAccessAdminPath(path: string, role: Role | null): boolean {
  if (!role || !within(path, "/admin") || PUBLIC_ADMIN_PATHS.some((publicPath) => within(path, publicPath))) return false;
  if (role === "admin") return true;
  if (role === "manager") return !within(path, "/admin/settings");
  return STAFF_PATHS.some((allowed) => allowed === "/admin" ? path === allowed : within(path, allowed));
}

export function shouldRedirectAdminUnauthorized(pathname: string, apiPath: string): boolean {
  return pathname.startsWith("/admin")
    && !PUBLIC_ADMIN_PATHS.some((publicPath) => within(pathname, publicPath))
    && !PUBLIC_AUTH_API_PATHS.some((publicPath) => apiPath === publicPath);
}