// Entity types matching docs/NRE_BACKEND_API.md. Money and quantities are decimal strings.
export type Decimal = string;
export type Role = "admin" | "manager" | "staff";

export interface ListMeta { page: number; per_page: number; total: number }
export interface Paged<T> { data: T[]; meta: ListMeta }
export interface ApiErrorBody { error: { code: string; message: string; fields?: Record<string, string> } }

export interface User { id: number; email: string; full_name: string; role: Role | null; is_active: boolean }
export interface MeResponse { user: User; csrf_token: string }

export interface PublicSettings {
  company_name: string; tagline: string; address: string; phones: string[]; emails: string[];
  whatsapp: string | null; facebook_url: string | null; youtube_url: string | null;
  website_url: string | null; map_embed_url: string | null; logo_url: string;
}

export interface Category { id: number; slug: string; name: string; description: string; image_url: string; sort_order: number; product_count?: number }
export interface ProductImage { id: number; url: string; is_primary: boolean; sort_order: number }
export interface PublicVariant { id: number; name: string; color: string | null; size: string | null; material: string | null; pack_size: Decimal | null }

export interface PublicProductSummary {
  id: number; slug: string; name: string; code: string; short_description: string;
  unit_code: string; moq: Decimal; is_featured: boolean; sort_order: number;
  primary_image: string | null; category: Pick<Category, "id" | "slug" | "name">;
}
export interface PublicProduct extends PublicProductSummary {
  description: string; features: string[]; specs: Record<string, unknown>;
  images: ProductImage[]; variants: PublicVariant[]; related: PublicProductSummary[];
}
export interface Client { id: number; name: string; logo_url: string }
export interface Certification { id: number; name: string; image_url: string | null }

export type StockStatus = "ok" | "low" | "out";
export type InvoiceStatus = "draft" | "due" | "partial" | "paid" | "cancelled";

export interface Customer { id: number; code: string; name: string; company: string | null; phone: string | null; email: string | null; address: string | null; opening_balance: Decimal; due_balance?: Decimal; is_active: boolean }
export interface Supplier { id: number; code: string; name: string; phone: string | null; email: string | null; address: string | null; opening_balance: Decimal; due_balance?: Decimal; is_active: boolean }
export interface Variant { id: number; product_id: number; sku: string; name: string; color: string | null; size: string | null; material: string | null; pack_size: Decimal | null; selling_price: Decimal; reorder_level: Decimal; stock_qty: Decimal; is_active: boolean; purchase_price?: Decimal }
export interface InvoiceItem { id: number; variant_id: number; description: string; qty: Decimal; rate: Decimal; discount_pct: Decimal; amount: Decimal }
export interface Invoice { id: number; invoice_no: string; invoice_date: string; customer_id: number; customer_name: string; status: InvoiceStatus; subtotal: Decimal; discount: Decimal; tax_amount: Decimal; total: Decimal; paid: Decimal; balance: Decimal; items?: InvoiceItem[] }
export interface Payment { id: number; receipt_no: string; payment_date: string; customer_id: number; invoice_id: number | null; amount: Decimal; method: string }
export interface StockMovement { id: number; variant_id: number; sku: string; type: string; qty: Decimal; ref: string | null; created_at: string }
export interface PurchaseOrder { id: number; po_no: string; po_date: string; supplier_id: number; supplier_name: string; status: string; total: Decimal }
export interface Enquiry { id: number; name: string; company: string | null; phone: string; email: string | null; product_name: string | null; quantity: string | null; message: string | null; wants_sample: boolean; status: "new" | "contacted" | "quoted" | "closed"; created_at: string }
