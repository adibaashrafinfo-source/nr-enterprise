// Turns spreadsheet rows into product import rows. Rows sharing a product code become variants of one product.
import type { AdminCategory, ProductImportRow, Unit, VariantInput } from "./types";

export const IMPORT_FIELDS = [
  { key: "name", label: "Product name", required: true }, { key: "code", label: "Product code", required: true },
  { key: "category", label: "Category (name or slug)", required: true }, { key: "unit", label: "Unit code", required: true },
  { key: "moq", label: "MOQ", required: true }, { key: "short_description", label: "Short description" }, { key: "description", label: "Description" },
  { key: "variant_name", label: "Variant name" }, { key: "sku", label: "SKU" }, { key: "color", label: "Colour" }, { key: "size", label: "Size / width" },
  { key: "material", label: "Material" }, { key: "selling_price", label: "Selling price" }, { key: "purchase_price", label: "Purchase price" },
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
export type Mapping = Partial<Record<ImportField, string>>;

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export function guessMapping(headers: string[]): Mapping {
  const out: Mapping = {};
  for (const f of IMPORT_FIELDS) {
    const hit = headers.find((h) => [norm(f.key), norm(f.label)].includes(norm(h)) || (f.key === "color" && norm(h) === "colour"));
    if (hit) out[f.key] = hit;
  }
  return out;
}

export interface PreviewRow { line: number; code: string; name: string; variant: string; errors: string[] }

export function buildImport(rows: Record<string, unknown>[], mapping: Mapping, categories: AdminCategory[], units: Unit[], allowCost: boolean) {
  const get = (r: Record<string, unknown>, k: ImportField) => { const col = mapping[k]; return col ? String(r[col] ?? "").trim() : ""; };
  const products = new Map<string, ProductImportRow>();
  const preview: PreviewRow[] = [];
  rows.forEach((r, i) => {
    const errors: string[] = [];
    const code = get(r, "code").toUpperCase(), name = get(r, "name"), catText = get(r, "category").toLowerCase(), unit = get(r, "unit").toLowerCase(), moq = get(r, "moq");
    const cat = categories.find((c) => c.slug === catText || c.name.toLowerCase() === catText);
    if (!name) errors.push("Missing product name");
    if (!code) errors.push("Missing product code");
    if (!cat) errors.push("Unknown category");
    if (!units.some((u) => u.code === unit)) errors.push("Unknown unit");
    if (!/^\d+(\.\d{1,3})?$/.test(moq)) errors.push("MOQ must be a number");
    const variantName = get(r, "variant_name"), price = get(r, "selling_price"), cost = get(r, "purchase_price");
    const hasVariant = Boolean(variantName || get(r, "sku") || price);
    if (hasVariant && !/^\d+(\.\d{1,2})?$/.test(price)) errors.push("Selling price must be a number");
    if (allowCost && cost && !/^\d+(\.\d{1,2})?$/.test(cost)) errors.push("Purchase price must be a number");
    preview.push({ line: i + 2, code, name, variant: variantName, errors });
    if (errors.length || !cat) return;
    let p = products.get(code);
    if (!p) {
      p = { product: { name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""), code, category_id: cat.id, unit_code: unit, moq, short_description: get(r, "short_description"), description: get(r, "description"), features: [], specs: {}, show_on_website: true, is_featured: false, seo_title: null, seo_description: null }, variants: [] };
      products.set(code, p);
    }
    if (hasVariant) {
      const v: VariantInput = { sku: get(r, "sku"), name: variantName || name, color: get(r, "color") || null, size: get(r, "size") || null, material: get(r, "material") || null, pack_size: null, selling_price: price, reorder_level: "0", is_active: true, ...(allowCost && cost ? { purchase_price: cost } : {}) };
      p.variants.push(v);
    }
  });
  return { rows: [...products.values()], preview, errorCount: preview.filter((p) => p.errors.length).length };
}
