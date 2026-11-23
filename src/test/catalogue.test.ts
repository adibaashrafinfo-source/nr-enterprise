import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-error";
import { buildImport, guessMapping } from "@/lib/product-import";
import { mockRequest } from "@/mocks";
import type { AdminCategory, AdminProduct, ProductInput, Unit, Variant } from "@/lib/types";

const login = (email: string) => mockRequest("POST", "/auth/login", {}, { email, password: "password123" });
afterEach(async () => { await mockRequest("POST", "/auth/logout"); });
const one = async <T,>(p: Promise<unknown>) => ((await p) as { data: T }).data;
const product = (code: string): ProductInput => ({ name: `Test ${code}`, slug: `test-${code.toLowerCase()}`, code, category_id: 1, unit_code: "pcs", moq: "500", short_description: "", description: "", features: [], specs: {}, show_on_website: true, is_featured: false, seo_title: null, seo_description: null });
const variant = (sku: string) => ({ sku, name: sku, color: null, size: null, material: null, pack_size: null, selling_price: "2.50", reorder_level: "0", is_active: true, purchase_price: "1.20" });
const png = () => { const f = new FormData(); f.append("file", new File([new Uint8Array([1])], "a.png", { type: "image/png" })); return f; };

describe("catalogue management", () => {
  it("lets a manager create a product with 3 variants and 2 images", async () => {
    await login("manager@nre.test");
    const p = await one<AdminProduct>(mockRequest("POST", "/products", {}, product("TST-A")));
    for (const sku of ["TST-A-1", "TST-A-2", "TST-A-3"]) await mockRequest("POST", `/products/${p.id}/variants`, {}, variant(sku));
    await mockRequest("POST", `/products/${p.id}/images`, {}, png());
    await mockRequest("POST", `/products/${p.id}/images`, {}, png());
    const saved = await one<AdminProduct>(mockRequest("GET", `/products/${p.id}`));
    expect(saved.variants).toHaveLength(3);
    expect(saved.images).toHaveLength(2);
    expect(saved.variants[0]?.purchase_price).toBe("1.20");
  });

  it("never sends purchase price to staff and blocks staff edits", async () => {
    await login("manager@nre.test");
    const p = await one<AdminProduct>(mockRequest("POST", "/products", {}, product("TST-B")));
    await mockRequest("POST", `/products/${p.id}/variants`, {}, variant("TST-B-1"));
    await mockRequest("POST", "/auth/logout");
    await login("staff@nre.test");
    const seen = await one<AdminProduct>(mockRequest("GET", `/products/${p.id}`));
    expect(seen.variants[0] && "purchase_price" in (seen.variants[0] as Variant)).toBe(false);
    await expect(mockRequest("POST", "/products", {}, product("TST-C"))).rejects.toMatchObject({ status: 403 });
  });

  it("returns a duplicate SKU error on the sku field", async () => {
    await login("admin@nre.test");
    const p = await one<AdminProduct>(mockRequest("POST", "/products", {}, product("TST-D")));
    await mockRequest("POST", `/products/${p.id}/variants`, {}, variant("DUP-1"));
    const err = await mockRequest("POST", `/products/${p.id}/variants`, {}, variant("dup-1")).catch((e: ApiError) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).fields?.["sku"]).toBe("This SKU already exists.");
  });

  it("blocks deleting a category that has products with a 409", async () => {
    await login("admin@nre.test");
    await expect(mockRequest("DELETE", "/categories/1")).rejects.toMatchObject({ status: 409 });
  });

  it("hides archived products from the public catalogue", async () => {
    await login("admin@nre.test");
    const p = await one<AdminProduct>(mockRequest("POST", "/products", {}, product("TST-E")));
    await mockRequest("DELETE", `/products/${p.id}`);
    await expect(mockRequest("GET", `/public/products/${p.slug}`)).rejects.toMatchObject({ status: 404 });
  });
});

describe("spreadsheet import", () => {
  const cats = [{ id: 1, slug: "woven-labels", name: "Woven Labels" }] as AdminCategory[];
  const units: Unit[] = [{ code: "pcs", name: "Pcs", is_active: true }];
  const rows = [
    { "Product name": "Label", "Product code": "lb-1", Category: "woven-labels", Unit: "pcs", MOQ: "1000", SKU: "LB-1-R", "Selling price": "1.5", Colour: "Red" },
    { "Product name": "Label", "Product code": "LB-1", Category: "Woven Labels", Unit: "pcs", MOQ: "1000", SKU: "LB-1-B", "Selling price": "1.5" },
    { "Product name": "", "Product code": "X", Category: "nope", Unit: "kg", MOQ: "abc" },
  ];
  it("groups rows by product code into variants and flags bad rows", () => {
    const mapping = { ...guessMapping(Object.keys(rows[0]!)), unit: "Unit", category: "Category" };
    const r = buildImport(rows, mapping, cats, units, true);
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.variants.map((v) => v.sku)).toEqual(["LB-1-R", "LB-1-B"]);
    expect(r.errorCount).toBe(1);
    expect(r.preview[2]?.errors).toContain("Unknown category");
  });
  it("drops purchase price for staff", () => {
    const r = buildImport([{ ...rows[0]!, "Purchase price": "1.00" }], { ...guessMapping([...Object.keys(rows[0]!), "Purchase price"]), unit: "Unit", category: "Category" }, cats, units, false);
    expect(r.rows[0]?.variants[0] && "purchase_price" in r.rows[0].variants[0]).toBe(false);
  });
});
