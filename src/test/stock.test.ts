import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-error";
import { mockRequest } from "@/mocks";
import type { AdminProduct, StockLedgerRow, StockRow, Variant } from "@/lib/types";

const login = (email: string) => mockRequest("POST", "/auth/login", {}, { email, password: "password123" });
afterEach(async () => { await mockRequest("POST", "/auth/logout"); });
const one = async <T,>(p: Promise<unknown>) => ((await p) as { data: T }).data;
let n = 0;
async function newVariant(reorder = "10") {
  n += 1;
  const p = await one<AdminProduct>(mockRequest("POST", "/products", {}, { name: `Stock ${n}`, slug: `stock-test-${n}`, code: `STK-${n}`, category_id: 1, unit_code: "pcs", moq: "1", short_description: "", description: "", features: [], specs: {}, show_on_website: true, is_featured: false, seo_title: null, seo_description: null }));
  return one<Variant>(mockRequest("POST", `/products/${p.id}/variants`, {}, { sku: `STK-${n}-1`, name: "Std", color: null, size: null, material: null, pack_size: null, selling_price: "3.00", reorder_level: reorder, is_active: true, purchase_price: "1.50" }));
}
const card = (id: number) => mockRequest("GET", `/stock/${id}/movements`) as Promise<{ data: StockLedgerRow[]; variant: StockRow }>;

describe("stock ledger", () => {
  it("opening 50 then adjustment -5 leaves 45 with two history rows", async () => {
    await login("manager@nre.test");
    const v = await newVariant();
    await mockRequest("POST", "/stock/opening", {}, { variant_id: v.id, quantity: "50", cost: "2.00" });
    await mockRequest("POST", "/stock/adjust", {}, { variant_id: v.id, quantity: "-5", reason: "Damaged" });
    const res = await card(v.id);
    expect(res.variant.qty_on_hand).toBe("45.000");
    expect(res.data.map((r) => r.type)).toEqual(["adjustment_out", "opening"]);
    expect(res.data[0]?.quantity).toBe("-5.000");
  });

  it("rejects an adjustment that would make stock negative", async () => {
    await login("manager@nre.test");
    const v = await newVariant();
    await mockRequest("POST", "/stock/opening", {}, { variant_id: v.id, quantity: "3" });
    const err = await mockRequest("POST", "/stock/adjust", {}, { variant_id: v.id, quantity: "-4", reason: "Count" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toBe("Adjustment would make stock negative");
    expect((await card(v.id)).variant.qty_on_hand).toBe("3.000");
  });

  it("requires a reason for adjustments", async () => {
    await login("manager@nre.test");
    const v = await newVariant();
    const err = await mockRequest("POST", "/stock/adjust", {}, { variant_id: v.id, quantity: "5", reason: " " }).catch((e) => e) as ApiError;
    expect(err.fields?.["reason"]).toBeTruthy();
  });

  it("marks low at reorder level and out at zero", async () => {
    await login("manager@nre.test");
    const v = await newVariant("10");
    expect((await card(v.id)).variant.status).toBe("out");
    await mockRequest("POST", "/stock/opening", {}, { variant_id: v.id, quantity: "10" });
    expect((await card(v.id)).variant.status).toBe("low");
    await mockRequest("POST", "/stock/adjust", {}, { variant_id: v.id, quantity: "1", reason: "Found" });
    expect((await card(v.id)).variant.status).toBe("ok");
  });

  it("lets staff view stock but not adjust or see value", async () => {
    await login("manager@nre.test");
    const v = await newVariant();
    await mockRequest("POST", "/auth/logout");
    await login("staff@nre.test");
    expect((await card(v.id)).variant.variant_id).toBe(v.id);
    await expect(mockRequest("POST", "/stock/adjust", {}, { variant_id: v.id, quantity: "5", reason: "x" })).rejects.toMatchObject({ status: 403 });
    await expect(mockRequest("POST", "/stock/opening", {}, { variant_id: v.id, quantity: "5" })).rejects.toMatchObject({ status: 403 });
    await expect(mockRequest("GET", "/stock/value")).rejects.toMatchObject({ status: 403 });
    const summary = await one<{ stock_value: string | null }>(mockRequest("GET", "/dashboard/summary"));
    expect(summary.stock_value).toBeNull();
  });
});
