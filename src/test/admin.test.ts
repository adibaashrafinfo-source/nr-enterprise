import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { canAccessAdminPath, shouldRedirectAdminUnauthorized } from "@/lib/admin-access";
import { mockRequest } from "@/mocks";
import type { DashboardSummary } from "@/lib/types";

const login = (email: string, password = "password123") => mockRequest("POST", "/auth/login", {}, { email, password });
const logout = () => mockRequest("POST", "/auth/logout");

beforeEach(async () => { await logout(); });
afterEach(async () => { await logout(); });

describe("admin role access", () => {
  it("allows staff business pages, including read-only products, but blocks manager-only routes", () => {
    expect(canAccessAdminPath("/admin", "staff")).toBe(true);
    expect(canAccessAdminPath("/admin/products", "staff")).toBe(true);
    expect(canAccessAdminPath("/admin/stock", "staff")).toBe(true);
    expect(canAccessAdminPath("/admin/reports", "staff")).toBe(false);
    expect(canAccessAdminPath("/admin/suppliers", "staff")).toBe(false);
    expect(canAccessAdminPath("/admin/settings", "staff")).toBe(false);
  });

  it("allows managers all admin areas except settings and users", () => {
    expect(canAccessAdminPath("/admin/reports", "manager")).toBe(true);
    expect(canAccessAdminPath("/admin/suppliers", "manager")).toBe(true);
    expect(canAccessAdminPath("/admin/settings", "manager")).toBe(false);
    expect(canAccessAdminPath("/admin/settings/users", "manager")).toBe(false);
  });

  it("allows admins into settings and keeps unassigned users out of dashboard", () => {
    expect(canAccessAdminPath("/admin/settings", "admin")).toBe(true);
    expect(canAccessAdminPath("/admin", null)).toBe(false);
    expect(canAccessAdminPath("/admin/login", "admin")).toBe(false);
  });

  it("keeps sign-in and password recovery pages public after an unauthenticated session check", () => {
    expect(shouldRedirectAdminUnauthorized("/admin/forgot-password", "/auth/me")).toBe(false);
    expect(shouldRedirectAdminUnauthorized("/admin/reset-password", "/auth/me")).toBe(false);
    expect(shouldRedirectAdminUnauthorized("/admin/login", "/auth/me")).toBe(false);
    expect(shouldRedirectAdminUnauthorized("/admin", "/auth/me")).toBe(false);
    expect(shouldRedirectAdminUnauthorized("/admin", "/dashboard/summary")).toBe(true);
  });
});

describe("admin mock endpoints", () => {
  it("keeps stock value hidden for staff while returning seeded dues and enquiry counts", async () => {
    await login("staff@nre.test");
    const response = await mockRequest("GET", "/dashboard/summary") as { data: DashboardSummary };
    expect(response.data.stock_value).toBeNull();
    expect(response.data.customer_dues).toBe("184500.00");
    expect(response.data.unpaid_invoices).toBe(1);
    expect(response.data.new_enquiries).toBe(1);
  });

  it("returns stock valuation only to manager-level accounts", async () => {
    await login("manager@nre.test");
    const response = await mockRequest("GET", "/dashboard/summary") as { data: DashboardSummary };
    expect(response.data.stock_value).toBe("0.00");
  });

  it("rejects dashboard reads for accounts waiting for role approval", async () => {
    await login("pending@nre.test");
    await expect(mockRequest("GET", "/dashboard/summary")).rejects.toMatchObject({ status: 403 });
  });

  it("zero-fills both supported dashboard chart ranges", async () => {
    await login("staff@nre.test");
    const seven = await mockRequest("GET", "/dashboard/sales-by-day", { days: 7 }) as { data: { day: string; total: string }[] };
    const thirty = await mockRequest("GET", "/dashboard/sales-by-day", { days: 30 }) as { data: { day: string; total: string }[] };
    expect(seven.data).toHaveLength(7);
    expect(thirty.data).toHaveLength(30);
    expect(seven.data.every((day) => /^\d{4}-\d{2}-\d{2}$/.test(day.day))).toBe(true);
  });

  it("returns grouped global search results", async () => {
    await login("staff@nre.test");
    const response = await mockRequest("GET", "/search", { q: "rahim" }) as { data: { products: unknown[]; variants: unknown[]; customers: { name: string }[]; invoices: unknown[] } };
    expect(response.data.customers[0]?.name).toBe("Rahim Apparels Ltd");
    expect(response.data).toHaveProperty("products");
    expect(response.data).toHaveProperty("invoices");
  });

  it("supports a demo forgot/reset password round trip", async () => {
    const response = await mockRequest("POST", "/auth/forgot-password", {}, { email: "staff@nre.test" }) as { data: { demo_reset_url?: string } };
    const resetUrl = response.data.demo_reset_url;
    if (!resetUrl) throw new Error("Mock forgot-password did not return its demo reset link.");
    const token = new URL(resetUrl, "http://localhost").searchParams.get("token");
    if (!token) throw new Error("Mock reset link did not contain a token.");
    await mockRequest("POST", "/auth/reset-password", {}, { token, password: "test-password-21" });
    await login("staff@nre.test", "test-password-21");
    await mockRequest("POST", "/auth/change-password", {}, { current_password: "test-password-21", new_password: "password123" });
  });
});