import { afterEach, describe, expect, it } from "vitest";
import { rowsToCustomers } from "@/lib/customer-import";
import { mockRequest } from "@/mocks";
import type { Customer, CustomerInput, LedgerRow, Supplier } from "@/lib/types";

const login = (email: string) => mockRequest("POST", "/auth/login", {}, { email, password: "password123" });
afterEach(async () => { await mockRequest("POST", "/auth/logout"); });
const one = async <T,>(p: Promise<unknown>) => ((await p) as { data: T }).data;
const input = (name: string): Partial<CustomerInput> => ({ name, type: "brand", opening_balance: "1500.50", credit_days: 30 });

describe("customers and suppliers", () => {
  it("ledger closing balance equals the list's due balance", async () => {
    await login("staff@nre.test");
    const list = (await mockRequest("GET", "/customers") as { data: Customer[] }).data;
    expect(list.length).toBeGreaterThan(0);
    for (const c of list) {
      const rows = await one<LedgerRow[]>(mockRequest("GET", `/customers/${c.id}/ledger`));
      expect(rows.at(-1)?.running_balance).toBe(c.due_balance);
    }
    expect(list.find((c) => c.code === "CUS-0001")?.due_balance).toBe("184500.00");
  });

  it("creates customers with a server code, ignoring any code sent", async () => {
    await login("staff@nre.test");
    const c = await one<Customer>(mockRequest("POST", "/customers", {}, { ...input("New Brand"), code: "HACK-1" }));
    expect(c.code).toMatch(/^CUS-\d{4}$/);
    expect(c.due_balance).toBe("1500.50");
  });

  it("only managers can delete customers", async () => {
    await login("staff@nre.test");
    const c = await one<Customer>(mockRequest("POST", "/customers", {}, input("Temp")));
    await expect(mockRequest("DELETE", `/customers/${c.id}`)).rejects.toMatchObject({ status: 403 });
    await mockRequest("POST", "/auth/logout");
    await login("manager@nre.test");
    expect((await one<{ archived: boolean }>(mockRequest("DELETE", `/customers/${c.id}`))).archived).toBe(false);
    expect((await one<{ archived: boolean }>(mockRequest("DELETE", "/customers/1"))).archived).toBe(true);
  });

  it("blocks staff from suppliers", async () => {
    await login("staff@nre.test");
    await expect(mockRequest("GET", "/suppliers")).rejects.toMatchObject({ status: 403 });
  });

  it("supplier ledger closing equals payable", async () => {
    await login("manager@nre.test");
    const s = (await mockRequest("GET", "/suppliers") as { data: Supplier[] }).data[0]!;
    const rows = await one<LedgerRow[]>(mockRequest("GET", `/suppliers/${s.id}/ledger`));
    expect(rows.at(-1)?.running_balance).toBe(s.payable_balance);
    expect(s.payable_balance).toBe("25440.00");
  });

  it("maps spreadsheet headers to customer fields", () => {
    expect(rowsToCustomers([{ "Customer Name": "A", Phone: "017", Type: "Buying house", "Credit Days": "15" }, { Name: "" }]))
      .toEqual([{ name: "A", phone: "017", type: "buying_house", credit_days: 15 }]);
  });
});
