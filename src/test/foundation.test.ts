import { describe, expect, it } from "vitest";
import { formatBDT, previewLineAmount, addMoney } from "@/lib/money";
import { mockRequest } from "@/mocks";

describe("money", () => {
  it("formats BDT with Indian grouping", () => {
    expect(formatBDT("184500.00")).toBe("৳ 1,84,500");
  });
  it("adds decimal strings without float drift", () => {
    expect(addMoney("0.10", "0.20")).toBe("0.30");
  });
  it("previews a line amount as qty x rate x (1 - disc%)", () => {
    expect(previewLineAmount("1000", "2.50", "10")).toBe("2250.00");
  });
});

describe("mock API", () => {
  it("serves all 19 products", async () => {
    const res = (await mockRequest("GET", "/public/products", { per_page: 48 })) as { meta: { total: number } };
    expect(res.meta.total).toBe(19);
  });
  it("returns no certifications by default", async () => {
    const res = (await mockRequest("GET", "/public/certifications")) as { data: unknown[] };
    expect(res.data).toHaveLength(0);
  });
});
