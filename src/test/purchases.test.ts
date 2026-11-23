import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-error";
import { mockRequest } from "@/mocks";
import type { AdminProduct, PurchaseDetail, ReceiveResult, StockRow, Supplier, Variant } from "@/lib/types";

const login = (email: string) => mockRequest("POST", "/auth/login", {}, { email, password: "password123" });
afterEach(async () => { await mockRequest("POST", "/auth/logout"); });
const one = async <T,>(p: Promise<unknown>) => ((await p) as { data: T }).data;
let n = 0;
async function variant() {
  n += 1;
  const p = await one<AdminProduct>(mockRequest("POST", "/products", {}, { name: `Buy ${n}`, slug: `buy-${n}`, code: `BUY-${n}`, category_id: 1, unit_code: "pcs", moq: "1", short_description: "", description: "", features: [], specs: {}, show_on_website: false, is_featured: false, seo_title: null, seo_description: null }));
  return one<Variant>(mockRequest("POST", `/products/${p.id}/variants`, {}, { sku: `BUY-${n}-1`, name: "Black", color: null, size: null, material: null, pack_size: null, selling_price: "2.00", reorder_level: "5", is_active: true, purchase_price: "1.00" }));
}
const stock = async (id: number) => ((await mockRequest("GET", `/stock/${id}/movements`)) as { variant: StockRow }).variant.qty_on_hand;
const payable = async () => (await one<Supplier>(mockRequest("GET", "/suppliers/1"))).payable_balance;
const po20 = (v: Variant) => one<PurchaseDetail>(mockRequest("POST", "/purchases", {}, { supplier_id: 1, order_date: "2026-11-23", items: [{ variant_id: v.id, qty_ordered: "20", rate: "15.50" }] }));

describe("purchases and receiving", () => {
  it("receiving 8 then 12 of 20 moves the PO Partial then Received, and stock rises by each amount", async () => {
    await login("manager@nre.test");
    const v = await variant(); const po = await po20(v);
    expect(po.po_no).toMatch(/^PO-\d{4}$/);
    expect(po.total).toBe("310.00");
    const item = po.items[0]!.id;
    const a = await one<ReceiveResult>(mockRequest("POST", `/purchase-items/${item}/receive`, {}, { quantity: "8" }));
    expect(a.status).toBe("partial"); expect(await stock(v.id)).toBe("8.000");
    const b = await one<ReceiveResult>(mockRequest("POST", `/purchase-items/${item}/receive`, {}, { quantity: "12" }));
    expect(b.status).toBe("received"); expect(await stock(v.id)).toBe("20.000");
  });

  it("over-receiving is refused with the pending quantity and changes nothing", async () => {
    await login("manager@nre.test");
    const v = await variant(); const po = await po20(v); const item = po.items[0]!.id;
    await mockRequest("POST", `/purchase-items/${item}/receive`, {}, { quantity: "15" });
    const err = await mockRequest("POST", `/purchase-items/${item}/receive`, {}, { quantity: "6" }).catch((e) => e) as ApiError;
    expect(err.status).toBe(409); expect(err.message).toBe("Invalid quantity: pending is 5");
    expect(await stock(v.id)).toBe("15.000");
  });

  it("supplier payable rises by received value and falls by a payment", async () => {
    await login("manager@nre.test");
    const before = await payable();
    const v = await variant(); const po = await po20(v);
    await mockRequest("POST", `/purchase-items/${po.items[0]!.id}/receive`, {}, { quantity: "20" });
    expect(Number(await payable()) - Number(before)).toBe(310);
    const pay = await one<{ voucher_no: string }>(mockRequest("POST", "/suppliers/1/payments", {}, { method: "cash", amount: "100.00", purchase_id: po.id }));
    expect(pay.voucher_no).toMatch(/^SV-\d{4}$/);
    expect(Number(await payable()) - Number(before)).toBe(210);
  });

  it("purchase return reduces stock and received qty, and sets a received PO back to partial", async () => {
    await login("manager@nre.test");
    const v = await variant(); const po = await po20(v); const item = po.items[0]!.id;
    await mockRequest("POST", `/purchase-items/${item}/receive`, {}, { quantity: "20" });
    const r = await one<ReceiveResult>(mockRequest("POST", `/purchase-items/${item}/return`, {}, { quantity: "4" }));
    expect(r.status).toBe("partial"); expect(r.qty_received).toBe("16.000"); expect(await stock(v.id)).toBe("16.000");
  });

  it("staff can receive from pending receipts without seeing rates, but cannot open purchase orders", async () => {
    await login("manager@nre.test");
    const v = await variant(); const po = await po20(v);
    await mockRequest("POST", "/auth/logout"); await login("staff@nre.test");
    const pending = await one<Record<string, unknown>[]>(mockRequest("GET", "/receiving/pending"));
    const row = pending.find((p) => p["purchase_id"] === po.id)!;
    expect(JSON.stringify(pending)).not.toMatch(/rate|price|cost|total|value/);
    const r = await one<ReceiveResult>(mockRequest("POST", `/purchase-items/${row["item_id"]}/receive`, {}, { quantity: "5" }));
    expect(JSON.stringify(r)).not.toMatch(/rate|price|value/);
    expect(((await mockRequest("GET", "/purchases").catch((e) => e)) as ApiError).status).toBe(403);
    expect(((await mockRequest("GET", `/purchases/${po.id}`).catch((e) => e)) as ApiError).status).toBe(403);
    const search = await one<Record<string, unknown>[]>(mockRequest("GET", "/variants/search", { q: v.sku }));
    expect(search[0]).not.toHaveProperty("last_purchase_rate");
  });

  it("reorder suggestions list low items with their last purchase rate", async () => {
    await login("manager@nre.test");
    const v = await variant(); await po20(v);
    const list = await one<{ variant_id: number; last_rate: string | null; suggested_qty: string }[]>(mockRequest("GET", "/purchases/reorder-suggestions"));
    const s = list.find((x) => x.variant_id === v.id)!;
    expect(s.last_rate).toBe("15.50"); expect(s.suggested_qty).toBe("10.000");
  });
});
