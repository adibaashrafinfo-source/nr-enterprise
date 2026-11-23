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
export interface AdminProductSummary extends PublicProductSummary {
  variant_count: number; total_stock: Decimal; show_on_website: boolean; is_active: boolean;
}
export interface AdminProduct extends PublicProduct {
  variant_count: number; total_stock: Decimal; show_on_website: boolean; is_active: boolean;
  seo_title: string | null; seo_description: string | null; variants: Variant[];
}
export interface AdminCategory extends Category { is_active: boolean }
export interface Unit { code: string; name: string; is_active: boolean }
export interface ProductInput {
  name: string; slug: string; code: string; category_id: number; unit_code: string; moq: Decimal;
  short_description: string; description: string; features: string[]; specs: Record<string, unknown>;
  show_on_website: boolean; is_featured: boolean; is_active?: boolean;
  seo_title: string | null; seo_description: string | null;
}
export interface VariantInput {
  sku: string; name: string; color: string | null; size: string | null; material: string | null;
  pack_size: Decimal | null; selling_price: Decimal; reorder_level: Decimal; is_active: boolean;
  purchase_price?: Decimal;
}
export interface CategoryInput { slug: string; name: string; description: string; image_url: string; sort_order: number; is_active: boolean }
export interface UnitInput { code: string; name: string; is_active: boolean }
export interface ProductImportRow { product: ProductInput; variants: VariantInput[] }
export interface ProductImportResult { created: number; errors: { row: number; message: string; fields?: Record<string, string> }[] }
export interface Client { id: number; name: string; logo_url: string }
export interface Certification { id: number; name: string; image_url: string | null }

export type StockStatus = "ok" | "low" | "out";
export type InvoiceStatus = "draft" | "due" | "partial" | "paid" | "cancelled";

export type CustomerType = "factory" | "buying_house" | "brand" | "retail" | "other";
export interface CustomerInput {
  name: string; contact_person: string | null; phone: string | null; whatsapp: string | null; email: string | null;
  billing_address: string | null; delivery_address: string | null; area: string | null; type: CustomerType;
  credit_days: number; credit_limit: Decimal; opening_balance: Decimal; buyers_served: string | null; bin: string | null; notes: string | null; is_active: boolean;
}
export interface Customer extends CustomerInput { id: number; code: string; total_sales: Decimal; due_balance: Decimal; invoice_count: number; order_count: number }
export interface SupplierInput {
  name: string; contact_person: string | null; phone: string | null; email: string | null; address: string | null;
  payment_terms: string | null; opening_balance: Decimal; notes: string | null; is_active: boolean; product_ids: number[];
}
export interface Supplier extends SupplierInput { id: number; code: string; total_purchased: Decimal; paid: Decimal; payable_balance: Decimal }
export interface LedgerRow { date: string; type: "opening" | "invoice" | "payment" | "purchase" | "supplier_payment"; doc_no: string | null; debit: Decimal; credit: Decimal; running_balance: Decimal }
export interface CustomerDue { invoice_id: number; invoice_no: string; customer_id: number; customer_name: string; invoice_date: string; due_date: string; balance: Decimal; days_overdue: number }
export interface PartyImportResult { created: number; errors: { row: number; message: string }[] }
export interface Variant { id: number; product_id: number; sku: string; name: string; color: string | null; size: string | null; material: string | null; pack_size: Decimal | null; selling_price: Decimal; reorder_level: Decimal; stock_qty: Decimal; is_active: boolean; purchase_price?: Decimal }
export interface SalesLine { id?: number; variant_id: number | null; description: string; unit_code: string; quantity: Decimal; rate: Decimal; discount_percent: Decimal; amount?: Decimal; returned_qty?: Decimal }
export type OrderStatus = "quotation" | "confirmed" | "delivered" | "invoiced" | "cancelled";
export interface SalesOrderInput { customer_id: number; order_date: string; delivery_date: string | null; buyer_ref: string | null; po_no: string | null; style_no: string | null; discount: Decimal; notes: string | null; items: SalesLine[] }
export interface SalesOrder extends SalesOrderInput { id: number; order_no: string; customer_name: string; status: OrderStatus; subtotal: Decimal; total: Decimal; invoice_id: number | null }
export interface InvoiceInput { customer_id: number; invoice_date: string; due_date: string | null; buyer_ref: string | null; po_no: string | null; style_no: string | null; discount: Decimal; notes: string | null; items: SalesLine[] }
export type PaymentMethod = "cash" | "bkash" | "nagad" | "bank" | "cheque" | "credit_note";
export interface Payment { id: number; receipt_no: string; payment_date: string; customer_id: number; customer_name: string; invoice_id: number | null; invoice_no: string | null; amount: Decimal; method: PaymentMethod; reference_no: string | null; note: string | null }
export interface PaymentInput { payment_date: string; method: PaymentMethod; reference_no: string | null; amount: Decimal; note: string | null }
export interface Challan { id: number; challan_no: string; challan_date: string; invoice_id: number; vehicle_no: string | null; driver_name: string | null; received_by: string | null; note: string | null }
export interface ChallanInput { challan_date: string; vehicle_no: string | null; driver_name: string | null; received_by: string | null; note: string | null }
export interface CompanyBlock { company_name: string; address: string; phones: string[]; emails: string[]; logo_url: string; bin: string | null; bank_details: string | null; footer: string | null; tax_enabled: boolean; tax_rate: Decimal; whatsapp: string | null }
export interface Invoice {
  id: number; invoice_no: string; invoice_date: string; due_date?: string | null; customer_id: number; customer_name: string; status: InvoiceStatus;
  order_id?: number | null; buyer_ref?: string | null; po_no?: string | null; style_no?: string | null; notes?: string | null;
  subtotal: Decimal; discount: Decimal; tax_rate?: Decimal; tax_amount: Decimal; total: Decimal; paid: Decimal; balance: Decimal;
  items?: SalesLine[];
}
export interface InvoiceDetail extends Invoice { items: SalesLine[]; payments: Payment[]; challans: Challan[]; customer: Customer; company: CompanyBlock }
export interface VariantPick { id: number; sku: string; display_name: string; unit_code: string; selling_price: Decimal; qty_on_hand: Decimal }
export interface StockMovement { id: number; variant_id: number; sku: string; type: string; qty: Decimal; ref: string | null; created_at: string }
export interface PurchaseOrder { id: number; po_no: string; po_date: string; supplier_id: number; supplier_name: string; status: string; total: Decimal }
export interface Enquiry { id: number; name: string; company: string | null; phone: string; email: string | null; product_name: string | null; quantity: string | null; message: string | null; wants_sample: boolean; status: "new" | "contacted" | "quoted" | "closed"; created_at: string }

export interface DashboardSummary {
  sales_today: Decimal;
  sales_yesterday: Decimal;
  customer_dues: Decimal;
  unpaid_invoices: number;
  low_stock_count: number;
  new_enquiries: number;
  variant_count: number;
  stock_value: Decimal | null;
}
export interface SalesDay { day: string; total: Decimal }
export interface StockRow {
  variant_id: number;
  product_id: number;
  sku: string;
  display_name: string;
  product_name: string;
  category_id: number;
  category_name: string;
  unit_code: string;
  qty_on_hand: Decimal;
  reorder_level: Decimal;
  selling_price: Decimal;
  status: StockStatus;
}
/** Dashboard low-stock card rows share the stock overview shape. */
export type LowStockItem = StockRow;
export type StockMovementType = "opening" | "purchase_in" | "sale_out" | "sales_return" | "sale_return_in" | "cancel_reverse" | "adjustment_in" | "adjustment_out";
export interface StockLedgerRow {
  id: number; variant_id: number; type: StockMovementType; quantity: Decimal;
  reference_type: "invoice" | "purchase_order" | "invoice_item" | "invoice_return" | null; reference_id: number | null;
  buyer: string | null; style_no: string | null; batch: string | null;
  user_name: string; note: string | null; created_at: string;
}
export interface StockValue { total: Decimal; by_category: { category_id: number; category_name: string; value: Decimal }[] }
export interface OpeningStockInput { variant_id: number; quantity: string; cost?: string; note?: string }
export interface StockAdjustInput { variant_id: number; quantity: string; reason: string }
export interface AdminSearchResults {
  products: { id: number; name: string; code: string; category_slug: string }[];
  variants: { id: number; sku: string; display_name: string; product_id: number }[];
  customers: { id: number; name: string; phone: string | null }[];
  invoices: { id: number; invoice_no: string; customer_name: string; total: Decimal; status: InvoiceStatus }[];
}
