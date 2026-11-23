import type { CustomerInput, CustomerType } from "./types";

const HEADERS: Record<string, keyof CustomerInput> = {
  name: "name", "customer name": "name", "contact person": "contact_person", contact: "contact_person", phone: "phone", mobile: "phone",
  whatsapp: "whatsapp", email: "email", "billing address": "billing_address", address: "billing_address", "delivery address": "delivery_address",
  area: "area", type: "type", "credit days": "credit_days", "credit limit": "credit_limit", "opening balance": "opening_balance",
  "buyers served": "buyers_served", bin: "bin", notes: "notes",
};
const TYPES: Record<string, CustomerType> = { factory: "factory", "buying house": "buying_house", buying_house: "buying_house", brand: "brand", retail: "retail", other: "other" };

/** Maps spreadsheet rows (any column order, case-insensitive headers) to customer inputs; unknown columns are ignored. */
export function rowsToCustomers(rows: Record<string, unknown>[]): Partial<CustomerInput>[] {
  return rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [h, v] of Object.entries(row)) {
      const key = HEADERS[h.trim().toLowerCase().replace(/[_*]/g, " ").replace(/\s+/g, " ").trim()];
      const val = String(v ?? "").trim();
      if (!key || !val) continue;
      out[key] = key === "type" ? TYPES[val.toLowerCase()] ?? "other" : key === "credit_days" ? Number(val) : val;
    }
    return out as Partial<CustomerInput>;
  }).filter((r) => Object.keys(r).length > 0);
}
