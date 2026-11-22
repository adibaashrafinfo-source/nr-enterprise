// In-memory mock of the PHP REST API. Same paths, field names and envelopes as docs/NRE_BACKEND_API.md.
import { ApiError } from "@/lib/api-error";
import type { PublicProductSummary, User } from "@/lib/types";
import * as db from "./seed";

type Query = Record<string, string | number | undefined>;
let session: User | null = null;
const CSRF = "mock-csrf-token";

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

export async function mockRequest(method: string, path: string, query: Query = {}, body?: unknown): Promise<unknown> {
  await delay();
  const route = `${method} ${path}`;

  if (route === "GET /public/settings") return { data: db.settings };
  if (route === "GET /public/categories") return { data: db.categories };
  if (route === "GET /public/clients") return { data: db.clients };
  if (route === "GET /public/certifications") return { data: [] };
  if (route === "GET /public/products") {
    let rows = [...db.products].sort((a, b) => a.category.id - b.category.id || a.sort_order - b.sort_order);
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
    const p = db.products.find((x) => x.slug === slug);
    if (!p) throw new ApiError(404, "not_found", "Product not found.");
    const related = db.products.filter((x) => x.category.id === p.category.id && x.id !== p.id).slice(0, 4).map(summary);
    return { data: { ...p, related } };
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
  if (route === "POST /auth/forgot-password") return { data: { ok: true } };

  throw new ApiError(404, "not_implemented", `Mock endpoint not built yet: ${route}`);
}
