import { afterEach, describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { mockRequest } from "@/mocks";
import type { AdminProduct, AdminUser, InvoiceDetail, Variant } from "@/lib/types";

// Launch checks from PRD section 12 that the website controls.
const login = (email: string) => mockRequest("POST", "/auth/login", {}, { email, password: "password123" });
const logout = () => mockRequest("POST", "/auth/logout");
afterEach(async () => { await logout(); });
const one = async <T,>(p: Promise<unknown>) => ((await p) as { data: T }).data;
const fail = (p: Promise<unknown>) => p.then(() => ({ status: 0 }), (e: { status: number }) => e);

let n = 0;
const input = (i: number, show = true) => ({ name: `Acc ${i}`, slug: `acc-${i}`, code: `ACC-${i}`, category_id: 1, unit_code: "pcs", moq: "1", short_description: "", description: "", features: [], specs: {}, show_on_website: show, is_featured: false, seo_title: null, seo_description: null });
async function stocked(qty: string, rate = "1.00") {
  n += 1;
  const p = await one<AdminProduct>(mockRequest("POST", "/products", {}, input(n)));
  const v = await one<Variant>(mockRequest("POST", `/products/${p.id}/variants`, {}, { sku: `ACC-${n}-1`, name: "Std", color: null, size: null, material: null, pack_size: null, selling_price: rate, reorder_level: "0", is_active: true, purchase_price: "0.50" }));
  await mockRequest("POST", "/stock/opening", {}, { variant_id: v.id, quantity: qty });
  return { p, v };
}

describe("launch acceptance (PRD 12)", () => {
  it("A5: an account waiting for a role sees no business data", async () => {
    await login("pending@nre.test");
    expect((await fail(mockRequest("GET", "/stock"))).status).toBe(403);
    expect((await fail(mockRequest("GET", "/customers"))).status).toBe(403);
  });

  it("A8: confirming gives due date = invoice date + customer credit days (15 days)", async () => {
    await login("manager@nre.test");
    const { v } = await stocked("50", "100.00");
    const inv = await one<InvoiceDetail>(mockRequest("POST", "/invoices", {}, { customer_id: 2, invoice_date: "2026-11-01", discount: "0", items: [{ variant_id: v.id, description: "Label", unit_code: "pcs", quantity: "30", rate: "100.00", discount_percent: "0" }] }));
    await mockRequest("POST", `/invoices/${inv.id}/confirm`);
    const done = await one<InvoiceDetail>(mockRequest("GET", `/invoices/${inv.id}`));
    expect(done.due_date).toBe("2026-11-16");
    expect(done.status).toBe("due");
  });

  it("A10: paying 10,000 on a 25,400 invoice leaves 15,400 and Partial", async () => {
    await login("manager@nre.test");
    const { v } = await stocked("254", "100.00");
    const inv = await one<InvoiceDetail>(mockRequest("POST", "/invoices", {}, { customer_id: 2, invoice_date: "2026-11-01", discount: "0", items: [{ variant_id: v.id, description: "Label", unit_code: "pcs", quantity: "254", rate: "100.00", discount_percent: "0" }] }));
    expect(inv.total).toBe("25400.00");
    await mockRequest("POST", `/invoices/${inv.id}/confirm`);
    await mockRequest("POST", `/invoices/${inv.id}/payments`, {}, { method: "cash", amount: "10000.00", payment_date: "2026-11-02" });
    const after = await one<InvoiceDetail>(mockRequest("GET", `/invoices/${inv.id}`));
    expect(after.status).toBe("partial");
    expect(after.balance).toBe("15400.00");
  });

  it("A16: there is no endpoint that writes stock directly, and staff cannot set opening stock", async () => {
    await login("manager@nre.test");
    const { v } = await stocked("5");
    for (const [m, path] of [["POST", "/stock"], ["PUT", `/stock/${v.id}`], ["PATCH", `/stock/${v.id}`]] as const) {
      expect((await fail(mockRequest(m, path, {}, { qty_on_hand: "999" }))).status).toBeGreaterThanOrEqual(400);
    }
    await logout(); await login("staff@nre.test");
    expect((await fail(mockRequest("POST", "/stock/opening", {}, { variant_id: v.id, quantity: "999" }))).status).toBe(403);
  });

  it("A20: turning off Show on website removes the product from the public site", async () => {
    await login("manager@nre.test");
    const { p } = await stocked("1");
    const i = n;
    await one(mockRequest("GET", `/public/products/${p.slug}`));
    await mockRequest("PUT", `/products/${p.id}`, {}, input(i, false));
    expect((await fail(mockRequest("GET", `/public/products/${p.slug}`))).status).toBe(404);
  });

  it("A21: a new user given the manager role gets manager access on next sign-in", async () => {
    await login("admin@nre.test");
    const u = await one<AdminUser>(mockRequest("POST", "/users", {}, { email: "newmgr@nre.test", full_name: "New Manager", role: null, password: "password123" }));
    await logout(); await login("newmgr@nre.test");
    expect((await fail(mockRequest("GET", "/suppliers"))).status).toBe(403);
    await logout(); await login("admin@nre.test");
    await mockRequest("PUT", `/users/${u.id}`, {}, { role: "manager" });
    await logout(); await login("newmgr@nre.test");
    expect((await fail(mockRequest("GET", "/suppliers"))).status).toBe(0);
  });

  it("A23: stock without signing in is refused with 401", async () => {
    expect((await fail(mockRequest("GET", "/stock"))).status).toBe(401);
  });
});

describe("banned text", () => {
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(tsx?|json|txt|xml|html)$/.test(f) && !p.includes("/test/")) files.push(p); } };
  walk("src"); walk("public");
  const banned = ["United Nine", "UNB", "Sun Tin Lun", "2015", "85 million", "150+", "FSC C", "GSCI", "@supabase", "integrations/supabase"];
  it.each(banned)("no shipped file contains %s", (word) => {
    const hits = files.filter((f) => readFileSync(f, "utf8").includes(word));
    expect(hits).toEqual([]);
  });
});
