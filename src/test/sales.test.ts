import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-error";
import { amountInWords } from "@/lib/money";
import { mockRequest } from "@/mocks";
import type { AdminProduct, InvoiceDetail, Payment, SalesOrder, StockRow, Variant } from "@/lib/types";

const login = (email: string) => mockRequest("POST", "/auth/login", {}, { email, password: "password123" });
afterEach(async () => { await mockRequest("POST", "/auth/logout"); });
const one = async <T,>(p: Promise<unknown>) => ((await p) as { data: T }).data;
let n = 0;
async function stocked(qty: string) {
  n += 1;
  const p = await one<AdminProduct>(mockRequest("POST", "/products", {}, { name: `Sale ${n}`, slug: `sale-${n}`, code: `SAL-${n}`, category_id: 1, unit_code: "pcs", moq: "1", short_description: "", description: "", features: [], specs: {}, show_on_website: true, is_featured: false, seo_title: null, seo_description: null }));
  const v = await one<Variant>(mockRequest("POST", `/products/${p.id}/variants`, {}, { sku: `SAL-${n}-1`, name: "Navy", color: null, size: null, material: null, pack_size: null, selling_price: "1.20", reorder_level: "0", is_active: true, purchase_price: "0.80" }));
  await mockRequest("POST", "/stock/opening", {}, { variant_id: v.id, quantity: qty });
  return v;
}
const stock = async (id: number) => ((await mockRequest("GET", `/stock/${id}/movements`)) as { variant: StockRow }).variant.qty_on_hand;
const line = (v: Variant, quantity: string) => ({ variant_id: v.id, description: `Woven label ${v.sku}`, unit_code: "pcs", quantity, rate: "100.00", discount_percent: "0" });
const draft = (v: Variant, qty: string) => one<InvoiceDetail>(mockRequest("POST", "/invoices", {}, { customer_id: 2, invoice_date: "2026-11-23", discount: "0", items: [line(v, qty)] }));

describe("sales rules", () => {
  it("confirm reduces stock; over-selling names the item and changes nothing", async () => {
    await login("staff@nre.test");
    await mockRequest("POST", "/auth/logout"); await login("manager@nre.test");
    const v = await stocked("50");
    const a = await draft(v, "30");
    expect(a.total).toBe("3000.00");
    await mockRequest("POST", `/invoices/${a.id}/confirm`);
    expect(await stock(v.id)).toBe("20.000");
    const b = await draft(v, "25");
    const err = await mockRequest("POST", `/invoices/${b.id}/confirm`).catch((e) => e) as ApiError;
    expect(err.message).toBe(`Insufficient stock for "Woven label ${v.sku}": available 20, needed 25`);
    expect(await stock(v.id)).toBe("20.000");
    expect((await one<InvoiceDetail>(mockRequest("GET", `/invoices/${b.id}`))).status).toBe("draft");
  });

  it("partial payment shows Partial, full shows Paid; overpay is refused", async () => {
    await login("staff@nre.test");
    await mockRequest("POST", "/auth/logout"); await login("manager@nre.test");
    const v = await stocked("10");
    const inv = await draft(v, "10");
    await mockRequest("POST", `/invoices/${inv.id}/confirm`);
    const p = await one<Payment>(mockRequest("POST", `/invoices/${inv.id}/payments`, {}, { method: "cash", amount: "400.00", payment_date: "2026-11-23" }));
    expect(p.receipt_no).toMatch(/^RC-\d{4}$/);
    expect((await one<InvoiceDetail>(mockRequest("GET", `/invoices/${inv.id}`))).status).toBe("partial");
    await expect(mockRequest("POST", `/invoices/${inv.id}/payments`, {}, { method: "cash", amount: "600.01" })).rejects.toMatchObject({ status: 409 });
    await mockRequest("POST", `/invoices/${inv.id}/payments`, {}, { method: "bkash", amount: "600.00" });
    const done = await one<InvoiceDetail>(mockRequest("GET", `/invoices/${inv.id}`));
    expect(done.status).toBe("paid"); expect(done.balance).toBe("0.00");
  });

  it("cancel restores stock and is blocked when payments exist", async () => {
    await login("manager@nre.test");
    const v = await stocked("10");
    const inv = await draft(v, "4");
    await mockRequest("POST", `/invoices/${inv.id}/confirm`);
    expect(await stock(v.id)).toBe("6.000");
    await mockRequest("POST", `/invoices/${inv.id}/cancel`, {}, { reason: "Wrong customer" });
    expect(await stock(v.id)).toBe("10.000");
    const paid = await draft(v, "1");
    await mockRequest("POST", `/invoices/${paid.id}/confirm`);
    await mockRequest("POST", `/invoices/${paid.id}/payments`, {}, { method: "cash", amount: "50" });
    const err = await mockRequest("POST", `/invoices/${paid.id}/cancel`, {}, { reason: "x" }).catch((e) => e) as ApiError;
    expect(err.message).toBe("Invoice has payments. Remove or reassign them first");
  });

  it("staff cannot cancel; confirmed invoices are read-only", async () => {
    await login("manager@nre.test");
    const v = await stocked("5");
    await mockRequest("POST", "/auth/logout"); await login("staff@nre.test");
    const inv = await draft(v, "1");
    await mockRequest("POST", `/invoices/${inv.id}/confirm`);
    await expect(mockRequest("PUT", `/invoices/${inv.id}`, {}, { customer_id: 2, items: [line(v, "2")] })).rejects.toMatchObject({ status: 409 });
    await expect(mockRequest("POST", `/invoices/${inv.id}/cancel`, {}, { reason: "x" })).rejects.toMatchObject({ status: 403 });
  });

  it("sales return puts stock back and credits the invoice", async () => {
    await login("manager@nre.test");
    const v = await stocked("10");
    const inv = await draft(v, "10");
    const c = await one<InvoiceDetail>(mockRequest("POST", `/invoices/${inv.id}/confirm`));
    await mockRequest("POST", `/invoice-items/${c.items[0]!.id}/return`, {}, { quantity: "3" });
    expect(await stock(v.id)).toBe("3.000");
    const after = await one<InvoiceDetail>(mockRequest("GET", `/invoices/${inv.id}`));
    expect(after.balance).toBe("700.00"); expect(after.status).toBe("partial");
  });

  it("converting an order makes a draft, and confirming it marks the order invoiced", async () => {
    await login("staff@nre.test");
    await mockRequest("POST", "/auth/logout"); await login("manager@nre.test");
    const v = await stocked("5");
    const o = await one<SalesOrder>(mockRequest("POST", "/orders", {}, { customer_id: 1, order_date: "2026-11-23", buyer_ref: "ONLY", style_no: "ST-1", discount: "10", items: [line(v, "2")] }));
    expect(o.total).toBe("190.00"); expect(o.status).toBe("quotation");
    const { invoice_id } = await one<{ invoice_id: number }>(mockRequest("POST", `/orders/${o.id}/convert`));
    const inv = await one<InvoiceDetail>(mockRequest("GET", `/invoices/${invoice_id}`));
    expect(inv.status).toBe("draft"); expect(inv.buyer_ref).toBe("ONLY"); expect(inv.total).toBe("190.00");
    await mockRequest("POST", `/invoices/${invoice_id}/confirm`);
    expect((await one<SalesOrder>(mockRequest("GET", `/orders/${o.id}`))).status).toBe("invoiced");
  });

  it("writes amounts in words with lakh and crore", () => {
    expect(amountInWords("35000.00")).toBe("Taka Thirty Five Thousand Only");
    expect(amountInWords("12550075.50")).toBe("Taka One Crore Twenty Five Lakh Fifty Thousand Seventy Five and Fifty Paisa Only");
  });
});
