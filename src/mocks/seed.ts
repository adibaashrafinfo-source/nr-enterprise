import spec from "@/data/spec.json";
import type { Category, Client, Customer, Enquiry, Invoice, LowStockItem, PublicProduct, PublicSettings, Supplier, User } from "@/lib/types";

interface SpecProduct {
  category_slug: string; slug: string; name: string; code: string; short_description: string; description: string;
  features: string[]; specs: Record<string, unknown>; unit_code: string; moq: number; is_featured: boolean; sort_order: number; images: string[];
}

const c = spec.company.contact;

export const settings: PublicSettings = {
  company_name: spec.company.legal_display_name,
  tagline: spec.brand.tagline,
  address: c.address,
  phones: c.phones,
  emails: [c.email],
  whatsapp: c.whatsapp,
  facebook_url: null,
  youtube_url: null,
  website_url: null,
  map_embed_url: null,
  logo_url: "/assets/brand/nr-logo-full.png",
};

export const categories: Category[] = spec.categories.map((cat, i) => ({
  id: i + 1, ...cat,
  product_count: (spec.products as SpecProduct[]).filter((p) => p.category_slug === cat.slug).length,
}));

export const products: PublicProduct[] = (spec.products as SpecProduct[]).map((p, i) => {
  const cat = categories.find((x) => x.slug === p.category_slug)!;
  return {
    id: i + 1, slug: p.slug, name: p.name, code: p.code, short_description: p.short_description,
    description: p.description, features: p.features, specs: p.specs, unit_code: p.unit_code,
    moq: Number(p.moq).toFixed(3), is_featured: p.is_featured, sort_order: p.sort_order,
    primary_image: p.images[0] ?? null,
    category: { id: cat.id, slug: cat.slug, name: cat.name },
    images: p.images.map((url, j) => ({ id: (i + 1) * 100 + j, url, is_primary: j === 0, sort_order: j })),
    variants: [],
    related: [],
  };
});

export const clients: Client[] = spec.clients.map((cl, i) => ({ id: i + 1, name: cl.name, logo_url: cl.logo }));

export const users: (User & { password: string })[] = [
  { id: 1, email: "admin@nre.test", full_name: "Demo Admin", role: "admin", is_active: true, password: "password123" },
  { id: 2, email: "manager@nre.test", full_name: "Demo Manager", role: "manager", is_active: true, password: "password123" },
  { id: 3, email: "staff@nre.test", full_name: "Demo Staff", role: "staff", is_active: true, password: "password123" },
  { id: 4, email: "pending@nre.test", full_name: "Pending User", role: null, is_active: true, password: "password123" },
];

type SeedCustomer = Omit<Customer, "total_sales" | "due_balance" | "invoice_count" | "order_count">;
type SeedSupplier = Omit<Supplier, "total_purchased" | "paid" | "payable_balance">;
export const customers: SeedCustomer[] = [
  { id: 1, code: "CUS-0001", name: "Rahim Apparels Ltd", contact_person: "Rahim Uddin", phone: "+8801700000001", whatsapp: "+8801700000001", email: null, billing_address: "Gazipur", delivery_address: "Gazipur", area: "Gazipur", type: "factory", credit_days: 30, credit_limit: "500000.00", opening_balance: "0.00", buyers_served: null, bin: null, notes: null, is_active: true },
  { id: 2, code: "CUS-0002", name: "Sonali Knitwear", contact_person: null, phone: "+8801700000002", whatsapp: null, email: null, billing_address: "Ashulia", delivery_address: null, area: "Ashulia", type: "factory", credit_days: 15, credit_limit: "0.00", opening_balance: "12000.00", buyers_served: null, bin: null, notes: null, is_active: true },
];

export const suppliers: SeedSupplier[] = [
  { id: 1, code: "SUP-0001", name: "Dhaka Thread House", contact_person: null, phone: "+8801800000001", email: null, address: "Tongi", payment_terms: "30 days", opening_balance: "25440.00", notes: null, is_active: true, product_ids: [] },
];

export const invoices: Invoice[] = [
  { id: 1, invoice_no: "INV-00001", invoice_date: "2026-11-20", customer_id: 1, customer_name: "Rahim Apparels Ltd", status: "due", subtotal: "184500.00", discount: "0.00", tax_amount: "0.00", total: "184500.00", paid: "0.00", balance: "184500.00" },
  { id: 2, invoice_no: "INV-00002", invoice_date: "2026-11-21", customer_id: 2, customer_name: "Sonali Knitwear", status: "draft", subtotal: "25440.00", discount: "440.00", tax_amount: "0.00", total: "25000.00", paid: "0.00", balance: "25000.00" },
];

// No variants or stock movements are included in the supplied demo seed yet.
export const stockBalances: LowStockItem[] = [];

export const enquiries: Enquiry[] = [
  { id: 1, name: "Karim", company: "Karim Fashions", phone: "+8801900000001", email: null, product_name: "Woven Labels", quantity: "20000 pcs", message: "Need a sample first", wants_sample: true, status: "new", created_at: "2026-11-21T09:30:00Z" },
];
