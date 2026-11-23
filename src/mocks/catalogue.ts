// Mock catalogue admin endpoints (docs/NRE_BACKEND_API.md Catalogue group). Mutates the shared seed so public pages reflect changes.
import { ApiError } from "@/lib/api-error";
import { addMoney } from "@/lib/money";
import type { AdminCategory, AdminProduct, AdminProductSummary, CategoryInput, ProductImportRow, ProductInput, PublicProduct, Role, Unit, User, Variant, VariantInput } from "@/lib/types";
import * as db from "./seed";

type Query = Record<string, string | number | undefined>;
interface Meta { show_on_website: boolean; is_active: boolean; seo_title: string | null; seo_description: string | null; variants: Variant[] }

const meta = new Map<number, Meta>();
const categoryActive = new Map<number, boolean>();
export const units: Unit[] = [...new Set(db.products.map((p) => p.unit_code))].map((code) => ({ code, name: code.charAt(0).toUpperCase() + code.slice(1), is_active: true }));
let nextId = 10_000;
const newId = () => ++nextId;

const metaOf = (id: number): Meta => {
  let m = meta.get(id);
  if (!m) { m = { show_on_website: true, is_active: true, seo_title: null, seo_description: null, variants: [] }; meta.set(id, m); }
  return m;
};

/** Public visibility: archived or hidden products never reach the website. */
export const isPublic = (p: PublicProduct) => { const m = metaOf(p.id); return m.is_active && m.show_on_website; };
export const publicVariants = (p: PublicProduct) => metaOf(p.id).variants.filter((v) => v.is_active)
  .map(({ id, name, color, size, material, pack_size }) => ({ id, name, color, size, material, pack_size }));

const canEdit = (role: Role | null) => role === "admin" || role === "manager";
const stripCost = (v: Variant, role: Role | null): Variant => { if (canEdit(role)) return v; const { purchase_price: _p, ...rest } = v; return rest; };

function toSummary(p: PublicProduct): AdminProductSummary {
  const m = metaOf(p.id);
  const { description: _d, features: _f, specs: _s, images: _i, variants: _v, related: _r, ...rest } = p;
  return { ...rest, variant_count: m.variants.length, total_stock: addMoney(...m.variants.map((v) => v.stock_qty)), show_on_website: m.show_on_website, is_active: m.is_active };
}
function toAdmin(p: PublicProduct, role: Role | null): AdminProduct {
  const m = metaOf(p.id);
  return { ...p, ...toSummary(p), related: [], seo_title: m.seo_title, seo_description: m.seo_description, variants: m.variants.map((v) => stripCost(v, role)) };
}
const findProduct = (id: number) => { const p = db.products.find((x) => x.id === id); if (!p) throw new ApiError(404, "not_found", "Product not found."); return p; };

function validateProduct(input: ProductInput, selfId?: number) {
  const fields: Record<string, string> = {};
  if (!input.name?.trim()) fields["name"] = "Name is required.";
  if (!input.slug?.trim()) fields["slug"] = "Slug is required.";
  else if (db.products.some((p) => p.slug === input.slug && p.id !== selfId)) fields["slug"] = "This slug is already used.";
  if (!input.code?.trim()) fields["code"] = "Code is required.";
  else if (db.products.some((p) => p.code.toLowerCase() === input.code.toLowerCase() && p.id !== selfId)) fields["code"] = "This code is already used.";
  if (!db.categories.some((c) => c.id === Number(input.category_id))) fields["category_id"] = "Choose a category.";
  if (!units.some((u) => u.code === input.unit_code)) fields["unit_code"] = "Choose a unit.";
  if (!/^\d+(\.\d{1,3})?$/.test(String(input.moq ?? ""))) fields["moq"] = "Enter a number, e.g. 1000.";
  if (Object.keys(fields).length) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", fields);
}
function applyProduct(p: PublicProduct, input: ProductInput) {
  const cat = db.categories.find((c) => c.id === Number(input.category_id))!;
  Object.assign(p, {
    name: input.name.trim(), slug: input.slug.trim(), code: input.code.trim(), unit_code: input.unit_code, moq: Number(input.moq).toFixed(3),
    short_description: input.short_description, description: input.description, features: input.features.filter(Boolean), specs: input.specs,
    is_featured: input.is_featured, category: { id: cat.id, slug: cat.slug, name: cat.name },
  });
  const m = metaOf(p.id);
  m.show_on_website = input.show_on_website; m.seo_title = input.seo_title; m.seo_description = input.seo_description;
  if (input.is_active !== undefined) m.is_active = input.is_active;
}
function createProduct(input: ProductInput): PublicProduct {
  validateProduct(input);
  const p: PublicProduct = { id: newId(), slug: "", name: "", code: "", short_description: "", description: "", features: [], specs: {}, unit_code: "", moq: "0.000", is_featured: false, sort_order: 999, primary_image: null, category: { id: 0, slug: "", name: "" }, images: [], variants: [], related: [] };
  applyProduct(p, input);
  db.products.push(p);
  return p;
}

const allVariants = () => [...meta.values()].flatMap((m) => m.variants);
function validateVariant(input: VariantInput, selfId?: number) {
  const fields: Record<string, string> = {};
  if (!input.name?.trim()) fields["name"] = "Name is required.";
  if (!input.sku?.trim()) fields["sku"] = "SKU is required.";
  else if (allVariants().some((v) => v.sku.toLowerCase() === input.sku.trim().toLowerCase() && v.id !== selfId)) fields["sku"] = "This SKU already exists.";
  if (!/^\d+(\.\d{1,2})?$/.test(String(input.selling_price ?? ""))) fields["selling_price"] = "Enter a price.";
  if (input.purchase_price !== undefined && input.purchase_price !== "" && !/^\d+(\.\d{1,2})?$/.test(input.purchase_price)) fields["purchase_price"] = "Enter a price.";
  if (Object.keys(fields).length) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", fields);
}
const autoSku = (p: PublicProduct) => { let n = metaOf(p.id).variants.length + 1, sku = ""; do sku = `${p.code}-${String(n++).padStart(2, "0")}`; while (allVariants().some((v) => v.sku === sku)); return sku; };
function makeVariant(p: PublicProduct, input: VariantInput, role: Role | null): Variant {
  const sku = input.sku?.trim() || autoSku(p);
  const data = { ...input, sku };
  validateVariant(data);
  const v: Variant = { id: newId(), product_id: p.id, sku, name: data.name.trim(), color: data.color, size: data.size, material: data.material, pack_size: data.pack_size, selling_price: Number(data.selling_price).toFixed(2), reorder_level: Number(data.reorder_level || 0).toFixed(3), stock_qty: "0.000", is_active: data.is_active, purchase_price: canEdit(role) && data.purchase_price ? Number(data.purchase_price).toFixed(2) : "0.00" };
  metaOf(p.id).variants.push(v);
  return v;
}

export function catalogueRequest(method: string, path: string, query: Query, body: unknown, user: User): unknown {
  const role = user.role;
  const write = () => { if (!canEdit(role)) throw new ApiError(403, "forbidden", "Only managers and admins can change the catalogue."); };
  const route = `${method} ${path}`;
  let m: RegExpMatchArray | null;

  if (route === "GET /products") {
    const term = String(query["q"] ?? "").toLowerCase();
    const cat = Number(query["category_id"] ?? 0);
    const status = String(query["status"] ?? "");
    const rows = db.products.filter((p) => (!term || `${p.name} ${p.code}`.toLowerCase().includes(term)) && (!cat || p.category.id === cat)
      && (!status || (status === "active") === metaOf(p.id).is_active)).map(toSummary);
    const page = Math.max(1, Number(query["page"] ?? 1)), per_page = Math.min(100, Math.max(1, Number(query["per_page"] ?? 25)));
    return { data: rows.slice((page - 1) * per_page, page * per_page), meta: { page, per_page, total: rows.length } };
  }
  if (route === "POST /products") { write(); return { data: toAdmin(createProduct(body as ProductInput), role) }; }
  if (route === "POST /products/import") {
    write();
    const rows = ((body ?? {}) as { rows?: ProductImportRow[] }).rows ?? [];
    const errors: { row: number; message: string; fields?: Record<string, string> }[] = [];
    rows.forEach((row, i) => {
      try { validateProduct(row.product); row.variants.forEach((v) => { if (v.sku) validateVariant(v); }); }
      catch (e) { if (e instanceof ApiError) errors.push({ row: i + 1, message: e.message, ...(e.fields ? { fields: e.fields } : {}) }); }
    });
    if (errors.length) return { data: { created: 0, errors } };
    rows.forEach((row) => { const p = createProduct(row.product); row.variants.forEach((v) => makeVariant(p, v, role)); });
    return { data: { created: rows.length, errors: [] } };
  }
  if ((m = path.match(/^\/products\/(\d+)$/))) {
    const p = findProduct(Number(m[1]));
    if (method === "GET") return { data: toAdmin(p, role) };
    write();
    if (method === "PUT") { validateProduct(body as ProductInput, p.id); applyProduct(p, body as ProductInput); return { data: toAdmin(p, role) }; }
    if (method === "DELETE") { metaOf(p.id).is_active = false; return { data: { ok: true } }; }
  }
  if ((m = path.match(/^\/products\/(\d+)\/images$/)) && method === "POST") {
    write();
    const p = findProduct(Number(m[1]));
    const file = body instanceof FormData ? body.get("file") : null;
    if (!(file instanceof Blob)) throw new ApiError(422, "validation_error", "Choose an image.", { file: "Choose an image." });
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new ApiError(422, "validation_error", "Use a JPG, PNG or WebP image.", { file: "Use a JPG, PNG or WebP image." });
    if (file.size > 5 * 1024 * 1024) throw new ApiError(422, "validation_error", "Images must be 5 MB or smaller.", { file: "Images must be 5 MB or smaller." });
    const img = { id: newId(), url: URL.createObjectURL(file), is_primary: p.images.length === 0, sort_order: p.images.length };
    p.images.push(img);
    if (img.is_primary) p.primary_image = img.url;
    return { data: img };
  }
  if ((m = path.match(/^\/products\/(\d+)\/images\/order$/)) && method === "PUT") {
    write();
    const p = findProduct(Number(m[1]));
    const { ids = [], primary_id } = (body ?? {}) as { ids?: number[]; primary_id?: number };
    p.images = ids.map((id, i) => p.images.find((x) => x.id === id)).filter((x): x is NonNullable<typeof x> => !!x)
      .map((img, i) => ({ ...img, sort_order: i, is_primary: img.id === primary_id }));
    p.primary_image = p.images.find((x) => x.is_primary)?.url ?? p.images[0]?.url ?? null;
    return { data: p.images };
  }
  if ((m = path.match(/^\/product-images\/(\d+)$/)) && method === "DELETE") {
    write();
    const id = Number(m[1]);
    const p = db.products.find((x) => x.images.some((i) => i.id === id));
    if (!p) throw new ApiError(404, "not_found", "Image not found.");
    p.images = p.images.filter((i) => i.id !== id).map((img, i) => ({ ...img, sort_order: i }));
    if (p.images.length && !p.images.some((i) => i.is_primary)) p.images[0] = { ...p.images[0]!, is_primary: true };
    p.primary_image = p.images.find((x) => x.is_primary)?.url ?? null;
    return { data: { ok: true } };
  }
  if ((m = path.match(/^\/products\/(\d+)\/variants$/)) && method === "POST") { write(); return { data: stripCost(makeVariant(findProduct(Number(m[1])), body as VariantInput, role), role) }; }
  if ((m = path.match(/^\/variants\/(\d+)$/))) {
    write();
    const v = allVariants().find((x) => x.id === Number(m![1]));
    if (!v) throw new ApiError(404, "not_found", "Variant not found.");
    if (method === "DELETE") { v.is_active = false; return { data: { ok: true } }; }
    if (method === "PUT") {
      const input = body as VariantInput;
      validateVariant(input, v.id);
      Object.assign(v, { sku: input.sku.trim(), name: input.name.trim(), color: input.color, size: input.size, material: input.material, pack_size: input.pack_size, selling_price: Number(input.selling_price).toFixed(2), reorder_level: Number(input.reorder_level || 0).toFixed(3), is_active: input.is_active, ...(input.purchase_price ? { purchase_price: Number(input.purchase_price).toFixed(2) } : {}) });
      return { data: stripCost(v, role) };
    }
  }
  if (route === "GET /categories") return { data: db.categories.map((c): AdminCategory => ({ ...c, product_count: db.products.filter((p) => p.category.id === c.id).length, is_active: categoryActive.get(c.id) ?? true })) };
  if (route === "POST /categories" || ((m = path.match(/^\/categories\/(\d+)$/)) && method === "PUT")) {
    write();
    const input = body as CategoryInput;
    const id = m ? Number(m[1]) : undefined;
    const fields: Record<string, string> = {};
    if (!input.name?.trim()) fields["name"] = "Name is required.";
    if (!input.slug?.trim()) fields["slug"] = "Slug is required.";
    else if (db.categories.some((c) => c.slug === input.slug && c.id !== id)) fields["slug"] = "This slug is already used.";
    if (Object.keys(fields).length) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", fields);
    const { is_active, ...rest } = input;
    let cat = id ? db.categories.find((c) => c.id === id) : undefined;
    if (id && !cat) throw new ApiError(404, "not_found", "Category not found.");
    if (cat) Object.assign(cat, rest); else { cat = { id: newId(), ...rest, product_count: 0 }; db.categories.push(cat); }
    categoryActive.set(cat.id, is_active);
    db.products.forEach((p) => { if (p.category.id === cat!.id) p.category = { id: cat!.id, slug: cat!.slug, name: cat!.name }; });
    return { data: { ...cat, is_active } };
  }
  if ((m = path.match(/^\/categories\/(\d+)$/)) && method === "DELETE") {
    write();
    const id = Number(m[1]);
    if (db.products.some((p) => p.category.id === id)) throw new ApiError(409, "conflict", "This category still has products. Move or archive them first.");
    const i = db.categories.findIndex((c) => c.id === id);
    if (i >= 0) db.categories.splice(i, 1);
    return { data: { ok: true } };
  }
  if (route === "GET /units") return { data: units };
  if (route === "POST /units") {
    write();
    const input = body as Unit;
    if (!/^[a-z0-9_-]{1,20}$/i.test(input.code ?? "")) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", { code: "Use letters, numbers, - or _." });
    if (!input.name?.trim()) throw new ApiError(422, "validation_error", "Please fix the highlighted fields.", { name: "Name is required." });
    const existing = units.find((u) => u.code === input.code);
    if (existing) Object.assign(existing, input); else units.push({ ...input });
    return { data: input };
  }
  return undefined;
}

export const isCatalogueAdminPath = (path: string) => /^\/(products|categories|units|variants|product-images)(\/|$)/.test(path);
