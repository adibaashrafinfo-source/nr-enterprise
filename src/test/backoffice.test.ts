import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-error";
import { mockRequest } from "@/mocks";
import type { AdminCertification, AdminClient, AdminUser, Client, Enquiry, SalesOrder } from "@/lib/types";

const login = (email: string) => mockRequest("POST", "/auth/login", {}, { email, password: "password123" });
afterEach(async () => { await mockRequest("POST", "/auth/logout"); });
const one = async <T,>(p: Promise<unknown>) => ((await p) as { data: T }).data;
const fail = async (p: Promise<unknown>) => (await p.catch((e) => e)) as ApiError;

describe("reports, enquiries, content and settings", () => {
  it("staff cannot open manager reports but can see low stock and dues", async () => {
    await login("staff@nre.test");
    expect((await fail(mockRequest("GET", "/reports/profit"))).status).toBe(403);
    expect((await fail(mockRequest("GET", "/reports/stock"))).status).toBe(403);
    await mockRequest("GET", "/reports/low-stock");
    await mockRequest("GET", "/reports/dues");
  });

  it("dues report buckets the seeded 184,500 invoice into aging columns", async () => {
    await login("manager@nre.test");
    const rows = await one<{ customer_id: number; total: string }[]>(mockRequest("GET", "/reports/dues"));
    expect(rows.find((r) => r.customer_id === 1)?.total).toBe("184500.00");
  });

  it("a website enquiry appears in the inbox and converts to a quotation, marking it quoted", async () => {
    await mockRequest("POST", "/public/enquiries", {}, { name: "Test Buyer", phone: "+8801900000099", company: "Test Co", quantity: "5000 pcs" });
    await login("staff@nre.test");
    const list = await one<Enquiry[]>(mockRequest("GET", "/enquiries", { q: "Test Buyer" }));
    const e = list[0]!;
    expect(e.status).toBe("new");
    const r = await one<{ order_id: number }>(mockRequest("POST", `/enquiries/${e.id}/convert`, {}, { customer_id: 1 }));
    const o = await one<SalesOrder>(mockRequest("GET", `/orders/${r.order_id}`));
    expect(o.status).toBe("quotation"); expect(o.customer_id).toBe(1);
    expect((await one<Enquiry>(mockRequest("GET", `/enquiries/${e.id}`))).status).toBe("quoted");
  });

  it("a client without permission is hidden from the public site", async () => {
    await login("manager@nre.test");
    const c = (await one<AdminClient[]>(mockRequest("GET", "/clients")))[0]!;
    await mockRequest("PUT", `/clients/${c.id}`, {}, { ...c, permission_confirmed: false });
    expect((await one<Client[]>(mockRequest("GET", "/public/clients"))).some((x) => x.id === c.id)).toBe(false);
    await mockRequest("PUT", `/clients/${c.id}`, {}, { ...c, permission_confirmed: true });
  });

  it("a certification cannot be published without the holder confirmation", async () => {
    await login("manager@nre.test");
    const err = await fail(mockRequest("POST", "/certifications", {}, { name: "OEKO-TEX", is_published: true, holder_confirmed: false }));
    expect(err.status).toBe(422);
    await one<AdminCertification>(mockRequest("POST", "/certifications", {}, { name: "OEKO-TEX", is_published: true, holder_confirmed: true }));
    expect((await one<{ name: string }[]>(mockRequest("GET", "/public/certifications"))).map((c) => c.name)).toContain("OEKO-TEX");
  });

  it("only admins change settings; the last admin cannot be demoted", async () => {
    await login("manager@nre.test");
    expect((await fail(mockRequest("GET", "/users"))).status).toBe(403);
    await mockRequest("POST", "/auth/logout"); await login("admin@nre.test");
    const admin = (await one<AdminUser[]>(mockRequest("GET", "/users"))).find((u) => u.role === "admin")!;
    expect((await fail(mockRequest("PUT", `/users/${admin.id}`, {}, { role: "staff" }))).status).toBe(409);
  });

  it("numbering counters cannot go below documents already issued", async () => {
    await login("admin@nre.test");
    const err = await fail(mockRequest("PUT", "/settings/numbering", {}, { counters: [{ type: "invoice", prefix: "INV", padding: 5, last_number: 0 }] }));
    expect(err.status).toBe(422);
  });

  it("writes are recorded in the activity log with the user", async () => {
    await login("admin@nre.test");
    await mockRequest("POST", "/customers", {}, { name: "Logged Co" });
    const log = await one<{ user_name: string; table_name: string; action: string; record: string }[]>(mockRequest("GET", "/activity-log", { table: "customers" }));
    expect(log[0]).toMatchObject({ user_name: "Demo Admin", table_name: "customers", action: "create" });
  });
});
