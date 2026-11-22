# NR Enterprise — Product Requirements Document (PRD)

**Project:** Public website + Admin inventory system for NR Enterprise (All Kinds of Garments Accessories)
**Version:** 2.0 (cPanel + PHP + MySQL) · **Date:** 22 Nov 2026 · **Prepared by:** Abrar IT
**Stack:** Frontend built in **Lovable** (React + TypeScript + Tailwind + shadcn/ui) · Backend built with **Claude Code** (PHP 8.1+ REST API) · Database **MySQL/MariaDB on the same cPanel hosting**. No Supabase and no third-party database or backend service; all data stays on the cPanel account.
**Companion files:** `nre-project-spec.json` (machine-readable spec) · `NRE_mysql_schema.sql` + `NRE_mysql_seed.sql` (database) · `NRE_BACKEND_API.md` (API contract, SQL recipes, security, cPanel deploy) · `NRE_CLAUDE_CODE_PROMPTS.md` (backend prompts) · `NRE_LOVABLE_PROMPTS.md` (frontend prompts) · `NRE_Updated_Business_Profile.md` (analysed profile) · `assets/` (logo, product photos, client logos)

> **How Lovable and Claude Code should use this file.** Read this PRD together with `nre-project-spec.json` and `NRE_BACKEND_API.md`. The PRD explains the *why and rules*; the JSON holds exact copy, colours, products, routes and modules. When they disagree, the JSON wins on data (colours, slugs, routes), this PRD wins on behaviour. Build **phase by phase** (section 11). Do not skip ahead.

---

## 1. Overview

NR Enterprise supplies garment **labels, tags, stickers and trims** to garment factories, buying houses and brands in Bangladesh. Two products are needed:

1. **Public website** — premium B2B catalogue that presents the full range, builds trust and turns visitors into quote requests. There is no shopping cart.
2. **Admin panel** — one login to run daily work: products and variants, stock, sales orders, invoices, challans, payments, customers, suppliers, purchases, reports.

### 1.1 Goals

| # | Goal | Measure |
|---|---|---|
| G1 | Present all 19 product lines professionally with real photos | All products live with images and specs |
| G2 | Generate qualified enquiries | Quote form works end-to-end; enquiries visible in admin |
| G3 | Replace paper/Excel stock and billing | Stock, invoices, dues and payables tracked in one system |
| G4 | Prevent stock and money errors | Stock ledger only changes through controlled PHP services inside transactions; totals computed by the server |
| G5 | Keep it simple for staff | Only features a trims business uses daily; no advanced modules |

### 1.2 Users

| Persona | Needs | Role |
|---|---|---|
| **Owner** | Overview of sales, dues, stock value, profit; control of users and settings | `admin` |
| **Manager / Accounts** | Maintain catalogue, buy from suppliers, adjust stock, view reports | `manager` |
| **Sales / Store staff** | Create orders and invoices, receive payments, check stock, receive goods | `staff` |
| **Buyer (factory/brand merchandiser)** | See products and specs, send enquiry quickly on phone | anonymous visitor |

### 1.3 Out of scope (do not build)

Online cart and payment gateway · full accounting/ledger/payroll/HR · production planning and machine tracking · multi-branch consolidation · barcode-scanner hardware integration · customer login portal · mobile app · AI features.

### 1.4 Architecture (decided)

```
Browser ──HTTPS──▶ https://<domain>/            React SPA (Lovable build, static files in public_html)
                   https://<domain>/api/v1/...  PHP REST API (built with Claude Code) ──PDO──▶ MySQL/MariaDB (cPanel)
```

- **Two builders, one contract.** Lovable builds only the frontend (public website + admin UI). Claude Code builds the PHP API and runs the SQL. The contract between them is `NRE_BACKEND_API.md` (117 endpoints) and the `api` block of the JSON.
- **Same origin** (SPA and API on one domain): no CORS, session cookie auth with CSRF header.
- **Lovable preview without the backend:** the frontend API client has a **mock mode** (`VITE_USE_MOCK=true`) that serves seed data from memory, so Lovable can build and preview every screen before the PHP API exists. For production the flag is `false`.
- **Business logic in PHP services inside DB transactions.** No triggers or stored procedures (cPanel-safe). Exact SQL recipes are in `NRE_BACKEND_API.md` section 4.
- **Files:** public images in `public_html/uploads`; enquiry attachments in a private folder outside `public_html`.
- **Print/PDF:** browser print CSS. **Excel:** exported in the browser.
- **Backup:** nightly `mysqldump` cron on cPanel.

---

## 2. Business context and known data problems

The updated profile PDF (`NRE_BUSINESS_Profile.pdf`) reuses text, numbers, certificates and machinery from a different company, **United Nine Bangladesh (UNB)**. Lovable must therefore follow these **content rules**:

- **Never** show: "United Nine Bangladesh", "UNB", "Sun Tin Lun", "Founded in 2015", "85 million", "150+ employees", "10+ years", machine lists, capacity numbers, certificate numbers (FSC C147844, GRS GSCI-1074, etc.).
- Certificates and capacity blocks exist in code but are **hidden** (database `is_published = false`, feature flags `SHOW_CAPACITY=false`, `SHOW_STATS=false`) until NR supplies its own data.
- Client logos are shown but flagged `permission_confirmed = false` in admin.
- No Facebook/YouTube/website links exist yet; hide those icons when the value is empty.
- Photos are small (about 290 px wide). Use card-sized images; avoid full-bleed hero photos; allow replacement via admin upload.
- Full list of gaps: section 13 and `content_gaps` in the JSON.

---

## 3. Brand and design system

Source: NR logo (green NR monogram in yellow circle, black wordmark, italic serif tagline) and the updated profile's yellow theme.

### 3.1 Tokens

| Token | Hex | Use |
|---|---|---|
| `yellow` | `#F8C840` | Primary CTA background, highlights, active nav, accent bars |
| `yellow-deep` | `#E5AE1B` | Hover on yellow, small icons |
| `yellow-soft` | `#FFF4CC` | Badges, callouts |
| `green` | `#6FA33F` | Logo green, decorative, charts, icons |
| `green-deep` | `#2F5D1A` | Links, accent headings, secondary buttons, admin primary |
| `ink` | `#201818` | Body text, text on yellow |
| `ink-green` | `#14210F` | Dark sections, footer, admin sidebar |
| `cream` | `#FBF8EE` | Alternate page background |
| `line` | `#E8E2CF` | Borders |
| `muted` | `#6B655A` | Secondary text |
| `danger` / `warning` | `#C0392B` / `#B7791F` | Out of stock / low stock |

**Contrast rules:** text on yellow is always `ink`. White text only on `ink-green`, `green-deep`, `ink`. No small text in `#6FA33F` on white.

### 3.2 Typography and shape

Poppins (700 headings, 400/500 body). Bangla fallback: Hind Siliguri / Noto Sans Bengali. Radius: 16 px cards, pill buttons, 12 px inputs. Soft shadow `0 8px 30px rgba(20,33,15,.08)`. Motion: subtle fade-up on scroll, image hover zoom 1.04, logo marquee only.

### 3.3 Signature elements (from the profile)

- Faint **dotted "NR" watermark** on hero, banners and footer.
- Heading with a short **yellow bar**.
- Product cards with a **yellow caption strip** under the image.
- Gray/ink-green section blocks with rounded corners.

### 3.4 Admin theme

Ink-green sidebar with the NR circle mark, active item yellow with ink text; white top bar; white cards with `line` borders; zebra rows `#FBF8EE`; status pills (OK/Paid green, Low/Due amber, Out red, Partial blue).

### 3.5 Logo usage

`/assets/brand/nr-logo-full.png` on light backgrounds · `/assets/brand/nr-logo-mark.png` (transparent circle) on dark backgrounds, favicon, admin sidebar, loading states. Do not recolour or stretch.

---

## 4. Information architecture (public website)

```
Home
├─ About
├─ Products
│   ├─ Labels                       (Woven, Printed Care, Screen Printed)
│   ├─ Tags, Stickers & Tracking    (Offset, Digital, Thermal, Barcode, RFID, Variable Data, Flexo Adhesive, Adhesive Labels & Tags)
│   ├─ Trims & Accessories          (Sewing Thread, Elastic, Twill Tape, Drawstring, Cord Stoppers, Metal Snap, Plastic Buttons, Shell Buttons)
│   └─ Product detail
├─ Capabilities
├─ Sustainability
├─ Clients
└─ Contact & Request a Quote
/admin/**  (separate, authenticated)
```

Routes: `/`, `/about`, `/products`, `/products/:categorySlug`, `/products/:categorySlug/:productSlug`, `/capabilities`, `/sustainability`, `/clients`, `/contact`, `/admin/*`, `*` (404).

**Global elements:** sticky header (logo, nav, phone, yellow *Request a Quote*), product mega menu, footer, floating WhatsApp button, mobile bottom bar (Call · WhatsApp · Quote). SEO: title/description/OG per page, JSON-LD (Organization, Product), `sitemap.xml`, `robots.txt`.

---

## 5. Public website — page specifications

Exact copy for each section is in `nre-project-spec.json → website.pages[]`. Behaviour:

### 5.1 Home (`/`)
1. **Hero** — headline "All kinds of garments accessories, under one roof." Buttons *Explore Products* (yellow) / *Request a Quote*. Right: collage of 4 product photos over the dotted watermark.
2. **Trust strip** — four text items, no numbers.
3. **Category cards** — three cards from `categories` with product count.
4. **Featured products** — `products.is_featured = true` (8 items), card with *Get quote*.
5. **Why NR** — People · Process · Technology graphic and four benefit cards.
6. **Process strip** — Brief → Artwork & approval → Production → Quality check → Delivery.
7. **Sustainability band** — Reduce · Reuse · Recycle · Recover.
8. **Clients marquee** — active client logos, grayscale→colour on hover; hidden when none.
9. **Quote CTA** — mini form (name, phone, product, quantity) saving to `enquiries`.

### 5.2 About (`/about`)
Banner → overview (NR wording, no numbers) → vision & mission cards → People/Process/Technology → values → CTA.

### 5.3 Products (`/products`) and Category (`/products/:categorySlug`)
Search (name or code), category tabs, 3-column grid (2 tablet, 1 mobile), 12 per page. Category page adds hero, filter bar (product type, sort), related categories.

### 5.4 Product detail
Gallery (zoom) · summary panel (name, code, short description, features, variant chips for colour/size, MOQ + unit, **Request a Quote** drawer prefilled with product, WhatsApp link) · tabs *Description / Specifications / Finishing options (offset tags only) / Sustainability note* · related products. **No prices are shown.**

### 5.5 Capabilities, Sustainability, Clients
- **Capabilities:** process steps; printing and finishing method cards (woven, care label printing, screen, offset, digital, thermal, RFID/variable data; finishing chips: die cutting, embossing, foil stamping, varnishing, stringing, eyelet, folding); quality statement; certificates grid only if published; capacity block behind flag.
- **Sustainability:** overview, 4R cards, materials (recycled-quality raw material, eco-friendly recycled paper and soy-based ink for tags), environmental policy (materials, water, greenhouse gas and energy, waste, air pollution), certificates only if published.
- **Clients:** logo wall (4×5 desktop, 2 columns mobile), optional testimonials (hidden when empty), CTA.

### 5.6 Contact & Request a Quote (`/contact`)
Fields: name*, company, phone*, email, category, product, quantity (text), required date, message, file upload (jpg/png/webp/pdf ≤ 5 MB), checkbox "I need a sample first", hidden honeypot. Zod validation, POST multipart to `/api/v1/public/enquiries` (stored in `enquiries`, file kept privately), success state with WhatsApp link. Query params `?product=slug&sample=1` prefill. Also: address, two phones (tap to call), email, WhatsApp button, map embed (placeholder if empty).

### 5.7 Responsive and performance targets
Breakpoints 375 / 768 / 1280. Lazy-load images, width/height attributes, WebP when possible. Lighthouse mobile performance ≥ 85, accessibility ≥ 90.

---

## 6. Product catalogue

19 product lines in 3 categories (full data in JSON `products[]`; seeded by `NRE_mysql_seed.sql`).

| Category | Products |
|---|---|
| **Labels** | Woven Labels · Printed Care Labels (PFL) · Screen Printed Labels |
| **Tags, Stickers & Tracking** | Offset Printed Tags · Digital Printed Tags · Thermal Stickers · Barcode Labels & Stickers · RFID Labels & Tags · Variable Data Labels · Flexo Printed Adhesive Labels · Adhesive Labels & Tags |
| **Trims & Accessories** | Sewing Thread · Elastic · Twill Tape · Drawstring / Drawcord · Cord Stoppers · Metal Snap Buttons · Plastic Buttons · Shell / Pearl Buttons |

Each product has: name, code, short and full description, features list, `specs` JSON (category-specific field names and option lists), unit, MOQ, images, featured flag, and **variants** (colour, size/width, material, pack size).

**Spec field templates per category** (admin product form must render these as inputs): woven (weave, width × length, colours, fold type, edge, buyer/brand) · printed care (base fabric, size, print colours, language) · tags (paper type, GSM, size, finishing, recycled paper) · thermal/barcode/adhesive (roll width × length, core size, material, labels per roll, code type) · RFID/variable (chip type, frequency, size, printed data) · thread (fibre, count/ticket, colour code, cone weight) · elastic/twill (material, width mm, colour, stretch type, roll length) · drawcord/stopper (diameter, length, tip type; size, holes, material) · buttons/snaps (material, size in ligne, holes, finish, snap parts).

---

## 7. Admin panel — functional requirements

Base route `/admin`. Login at `/admin/login`. Layout: collapsible left sidebar, top bar with global search (product code, customer name, invoice number) and user menu, breadcrumbs, toasts for every write, confirm dialogs for cancel/delete. On mobile, tables become stacked cards.

### 7.1 Roles and permissions

| Capability | admin | manager | staff | no role | anonymous |
|---|:-:|:-:|:-:|:-:|:-:|
| View public site data | ✓ | ✓ | ✓ | ✓ | ✓ |
| Submit enquiry | ✓ | ✓ | ✓ | ✓ | ✓ |
| Dashboard (stock value hidden for staff) | ✓ | ✓ | ✓ | – | – |
| Products, variants, categories, images, **purchase price** | ✓ | ✓ | view (no cost) | – | – |
| Stock overview / history | ✓ | ✓ | view | – | – |
| Opening stock, stock adjustment | ✓ | ✓ | – | – | – |
| Customers add/edit | ✓ | ✓ | ✓ | – | – |
| Customers delete | ✓ | ✓ | – | – | – |
| Sales orders, invoices (draft/confirm), payments | ✓ | ✓ | ✓ | – | – |
| Cancel invoice, sales return, edit/delete payment | ✓ | ✓ | – | – | – |
| Suppliers, purchase orders, supplier payments | ✓ | ✓ | – | – | – |
| Receive goods against PO (no prices shown) | ✓ | ✓ | ✓ | – | – |
| Reports incl. cost and profit | ✓ | ✓ | – | – | – |
| Enquiries inbox | ✓ | ✓ | ✓ | – | – |
| Clients/certifications content | ✓ | ✓ | – | – | – |
| Settings, numbering, users & roles, activity log | ✓ | – | – | – | – |

Authentication: own PHP session login (email + password, `/api/v1/auth/*`, HttpOnly cookie + CSRF header). The **first registered user becomes admin** (done by the API). Later users have **no role** until an admin assigns one; they see "Waiting for approval". After the first admin exists, set `ALLOW_REGISTRATION=false` so only the admin creates users (Settings → Users).

### 7.2 Module 1 — Dashboard (`/admin`)
- KPI cards: **Sales today** (with change vs yesterday), **Stock value** (manager+ only), **Customer dues** with unpaid invoice count, **Low stock items**.
- Sales chart (7/30 days), low-stock list with *Create purchase*, recent invoices with status pills, new enquiries card.
- Quick actions: New invoice · Receive goods · Add product · Add customer · Receive payment.
- Data: `GET /dashboard/summary`, `GET /dashboard/sales-by-day`, `GET /stock?status=low`.

### 7.3 Module 2 — Products (`/admin/products`)
- **List:** search, filter by category/status, columns (image, name, code, category, variants, stock total, website visible, featured, status).
- **Form tabs:** Basic (name, slug auto, code, category, unit, MOQ, descriptions, features) · Images (upload to `product-images`, drag to reorder, set primary, alt text) · Specs (fields from category template) · Variants · Website/SEO (show on website, featured, SEO title/description).
- **Variants table:** colour, size/width, material, pack size, SKU (auto: product code + suffix, editable, unique), selling price (overrides product), **purchase price (manager+, stored in `variant_costs`)**, reorder level, active.
- Categories screen (name, slug, description, image, sort, active). Units screen (code, name, pcs-per-unit).
- Import products/variants from Excel/CSV with column mapping and preview.
- Archive instead of delete when a variant has movements (DB restricts delete).

### 7.4 Module 3 — Stock (`/admin/stock`)
- **Overview** from `v_stock_balance`: product/variant, category, unit, in stock, reorder level, status pill (OK / Low / Out), selling price. Filters: category, status, search. Export Excel.
- **Variant stock card:** movement history (date, type, quantity ±, document link, buyer/brand, style no., batch, user, note).
- **Opening stock wizard:** grid of variants → quantity and purchase cost → `POST /stock/opening`.
- **Adjustment (manager+):** quantity ± and **required reason** → `POST /stock/adjust`; blocks negative result.
- **Stock In** happens through purchase receiving; **Stock Out** happens when an invoice is confirmed. Never write to `stock_movements` from the client.
- Stock value report (qty × purchase price), manager+.

### 7.5 Module 4 — Sales orders (`/admin/orders`)
- Create quotation/order: customer, date, delivery date, buyer/brand, buyer PO no., style no.; lines: variant search, description, unit, quantity, rate (default selling price), discount %; order discount; notes.
- Live stock indicator per line (warning only).
- Status flow: `quotation → confirmed → delivered → invoiced`, `cancelled`. Editing allowed while quotation/confirmed.
- Print quotation PDF. **Convert to invoice** → `POST /orders/{id}/convert` (copies lines, order becomes `invoiced` when the invoice is confirmed).
- Can be created from a website enquiry (store `enquiry_id`, set enquiry `converted_order_id`, status `quoted`).

### 7.6 Module 5 — Invoices (`/admin/invoices`)
- **Create:** from order or blank. Header: customer, date, due date (default = date + customer credit days), buyer/brand, PO no., style no., invoice discount, VAT rate (default from settings when tax is enabled), notes. Lines as in orders, plus batch/lot.
- **Numbering:** `INV-0001…` assigned by the API when the draft is created; the client never sends it.
- **Lifecycle:** `draft` (editable) → **Confirm** (`POST /invoices/{id}/confirm`: checks stock for every line, posts stock OUT, status becomes Due/Partial/Paid) → payments move it to `partial` / `paid`. `cancelled` via `POST /invoices/{id}/cancel` (manager+; restores stock; blocked if payments exist).
- **Payments:** dialog with date, method (cash, bKash, Nagad, bank, cheque), reference no., amount ≤ balance, note. Receipt `RC-0001`, printable money receipt. Status and `paid_amount` are updated by the API.
- **Sales return (manager+):** pick invoice line and quantity → `POST /invoice-items/{id}/return` (stock back in; credit applied as a `credit_note` payment).
- **Delivery challan:** vehicle no., driver, received by, note; number `CH-0001`; printable and linked to invoice.
- **Print/PDF (A4):** see Appendix A. Share via WhatsApp text link (`wa.me`) and email.
- **List:** filters status, customer, date range; columns invoice no., date, customer, total, paid, balance, status.
- Credit limit warning if customer's due balance + invoice total exceeds `credit_limit`.

### 7.7 Module 6 — Customers (`/admin/customers`)
- Fields: name*, contact person, phone, WhatsApp, email, billing address, delivery address, area, **type** (factory / buying house / brand / retail / other), credit days, credit limit, opening balance (existing due), buyers/brands served, BIN, notes, active. Code `CUS-0001` by trigger.
- **List:** from `v_customer_balance` (total sales, due balance). Search by name/phone/area; filter by type and "has due". **Due follow-up** view from `v_invoice_aging` (days overdue).
- **Profile tabs:** Orders · Invoices · Payments · **Ledger** (`GET /customers/{id}/ledger`, printable with running balance) · Notes. Buttons: New order, New invoice, Receive payment.
- Rule: due balance = opening balance + confirmed invoices − all payments.
- Import/export Excel.

### 7.8 Module 7 — Suppliers (`/admin/suppliers`)
- Fields: name*, contact person, phone, email, address, payment terms, opening balance (existing payable), products supplied (multi-select), notes, active. Code `SUP-0001`.
- **List:** from `v_supplier_balance` (total purchased, paid, payable).
- **Profile tabs:** Purchases · Payments · Ledger · Products. **Make payment** (cash, bank, bKash, cheque) → voucher `SV-0001`, printable.
- Last purchase rate shown from `v_last_purchase_rate` when choosing a variant on a new PO.
- Rule: payable = opening balance + value of goods **received** − supplier payments.

### 7.9 Module 8 — Purchases (`/admin/purchases`)
- PO: supplier, order date, expected date, lines (variant, quantity ordered, rate), notes. Number `PO-0001`. Status `draft → ordered → partial → received`, `cancelled`.
- **Receive goods:** per line quantity (≤ pending), optional batch/lot → `POST /purchase-items/{id}/receive`; stock goes IN; PO status updates automatically. Partial receiving supported.
- **Staff view:** `v_pending_receipts` only (no prices).
- **Purchase return (manager+):** `POST /purchase-items/{id}/return` (stock out, reduces received qty and payable).
- Supplier bill number stored on PO. Print PO PDF. Reorder suggestion: low-stock variants with last purchase rate.

### 7.10 Module 9 — Reports (`/admin/reports`)
Stock report · Low stock · Stock movement (date range) · Sales (date, customer, product) · Purchases (date, supplier, product) · Customer dues & aging · Supplier payable · Profit summary (`GET /reports/profit`, manager+). Each: date filter, print, export Excel/PDF.

### 7.11 Module 10 — Enquiries (`/admin/enquiries`)
Inbox with status (new, contacted, quoted, won, lost), attachment viewer (signed URL), internal note, call and WhatsApp buttons, **Convert to quotation**. Sidebar badge shows new count.

### 7.12 Module 11 — Website content (`/admin/content`)
Clients (upload logo, order, show/hide, `permission_confirmed` toggle) and Certifications (publish only when confirmed). Featured products toggled from Products.

### 7.13 Module 12 — Settings & Users (`/admin/settings`, admin only)
Company (name, logo, address, phones, emails, WhatsApp, social, map embed, BIN/TIN/trade licence, bank details, invoice footer) · tax on/off and rate · currency BDT · document number prefixes · users & roles (assign/remove, deactivate) · activity log (who changed what).

### 7.14 Garments-trade rules (cross-cutting)

1. Stock is tracked **per variant** (colour/width/size/pack), never per product.
2. Units: pcs, dozen, gross, thousand, roll, cone, kg, yard, metre, with pack conversion.
3. Orders/invoices carry optional **Buyer/Brand, Buyer PO no., Style no.**; stock movements copy them so buyer-specific labels are never mixed.
4. **Delivery challan** accompanies every delivery.
5. Credit selling: credit days, credit limit, due balance, ledgers.
6. Payments in BDT via cash, bKash, Nagad, bank, cheque. Format currency as `৳ 1,84,500` (en-IN grouping).
7. Bangla text allowed in names; printed documents embed a Bangla-capable font.

---

## 8. Data model and business logic

Database files: `NRE_mysql_schema.sql` (28 tables, 6 views) then `NRE_mysql_seed.sql`, imported once in phpMyAdmin into an empty cPanel database. Claude Code builds the API on top of them; Lovable never touches the database and never recreates tables.

### 8.1 Entity overview

```
categories 1─* products 1─* product_variants 1─* stock_movements (append-only ledger)
                    │            └─ 1─1 variant_costs (manager+ only)
                    └─ 1─* product_images
customers 1─* sales_orders 1─* sales_order_items
customers 1─* invoices 1─* invoice_items ─ delivery_challans
customers 1─* payments ─(optional)→ invoices
suppliers 1─* purchase_orders 1─* purchase_order_items ; suppliers 1─* supplier_payments
users (role: admin | manager | staff | none) · password_resets · login_attempts
enquiries, clients, certifications, company_settings, doc_counters, activity_log
```

### 8.2 Rules enforced by the API (no triggers on shared hosting)

| Rule | Enforced by |
|---|---|
| Stock = sum of signed `stock_movements.quantity` per variant; no endpoint lets the client write movements; table is append-only | `StockService` only |
| Invoice `subtotal`, `tax_amount`, `total`, `paid_amount`, `status` | `InvoiceService` / `PaymentService` (recipes 4.3–4.4) |
| Line `amount` and invoice `balance` | MySQL generated columns |
| Document numbers INV-/SO-/CH-/RC-/PO-/SV-/CUS-/SUP- | `Numbering` with atomic `LAST_INSERT_ID` counter (4.1) |
| Invoices/lines editable only in `draft` | `InvoiceService` (409 `NOT_DRAFT`) |
| Confirming an invoice rejects if any line lacks stock | `confirm` transaction (4.5) |
| Cancelling restores stock and is blocked when payments exist | `cancel` (4.6) |
| Receiving cannot exceed pending quantity | `receive` (4.10) |
| Purchase prices, PO rates and profit readable by manager/admin only | role check + separate staff serializers |
| Public site reads only active/published rows, no prices; anonymous can only POST enquiries | `PublicController` |
| Audit log of changes (admin read) | `Audit` helper on every write |

### 8.3 API catalogue

117 endpoints under `/api/v1` grouped as Auth, Public, Dashboard, Catalogue, Stock, Customers, Suppliers, Sales, Purchases, Reports, Enquiries, Content, Settings. Full table with roles in `NRE_BACKEND_API.md` section 6 and in `nre-project-spec.json → api.endpoints`.

### 8.4 File storage

Product and client images (admin upload): `public_html/uploads/products|clients|brand/` (5 MB, jpeg/png/webp, re-encoded, random names, PHP execution disabled). Enquiry attachments (public upload): `nre_backend/storage/enquiries/` outside the web root, streamed only to logged-in staff by `GET /enquiries/{id}/attachment`. Seed images ship with the frontend build under `/assets/...` (paths stored in `product_images.url`).

---

## 9. Non-functional requirements

- **Security:** prepared statements only; password hashing; session + CSRF; login and enquiry throttling; role check in every API action (UI hiding is cosmetic); upload validation and re-encoding; config outside web root; HTTPS only. Full checklist: `NRE_BACKEND_API.md` section 3.
- **Performance:** paginate lists (server-side) at 25–50 rows; index-backed filters; image lazy loading; React Query caching.
- **Accessibility:** WCAG AA contrast, focus rings, labelled inputs, keyboard-operable dialogs.
- **SEO:** semantic HTML, one H1 per page, meta tags, JSON-LD, sitemap.
- **i18n:** English UI; Bangla text accepted everywhere; structure strings so a Bangla toggle can be added later.
- **Backup:** nightly `mysqldump` cron on cPanel (14 days kept) plus cPanel backups; export buttons for key lists.
- **Browser support:** latest Chrome, Edge, Safari, Firefox; Android Chrome and iOS Safari.

---

## 10. Print documents

All printable documents use a print stylesheet (A4, margins 12 mm), the NR logo, company block (address, phones, email, BIN when set), and the invoice footer from settings. Documents: invoice, delivery challan, money receipt, quotation, purchase order, supplier voucher, customer ledger statement. Embed Hind Siliguri/Noto Sans Bengali so Bangla names print correctly.

---

## 11. Build phases (phase by phase)

Each phase has a **Backend** part (Claude Code, PHP + MySQL) and a **Frontend** part (Lovable). Run the backend prompt first so the endpoints exist, then the frontend prompt. Lovable can run ahead in **mock mode** if the backend is not ready, but a phase is *done* only when the frontend works against the real API. Ready-to-paste prompts: `NRE_CLAUDE_CODE_PROMPTS.md` and `NRE_LOVABLE_PROMPTS.md`.

### Phase 0 — Foundation (backend skeleton + frontend design system)

**Goal:** Server skeleton connected to MySQL, frontend shell with brand tokens and a typed API client with mock mode.

**Backend (Claude Code):**
- Create nre_backend/ and public_html/api/ with front controller, router, Db (PDO), Request/Response, error handler, config.sample.php
- Import NRE_mysql_schema.sql + NRE_mysql_seed.sql into a local DB
- Auth endpoints: register (first user = admin), login, logout, me, CSRF, throttling
- GET /api/v1/public/settings as the first working endpoint
- Local dev router + README with setup steps

**Frontend (Lovable):**
- Create React + TS + Vite + Tailwind + shadcn/ui project; copy assets/ to public/assets/
- Design tokens from brand.colors, Poppins, button/card/pill/status components, /styleguide
- PublicLayout and AdminLayout, router with all routes stubbed
- src/lib/api.ts typed client (fetch, credentials same-origin, CSRF header, error mapping) with VITE_USE_MOCK in-memory adapter seeded from the spec JSON
- TanStack Query provider and AuthContext (calls /auth/me)

**Done when:**
- php -S serves /api/v1/public/settings with seed data
- Register/login/me work and first user is admin
- /styleguide shows tokens; app runs in mock mode
- NR mark is the favicon

### Phase 1 — Public site: core catalogue

**Goal:** Home, Products, Category, Product detail live with real data.

**Backend (Claude Code):**
- GET /public/categories, /public/products (filters, pagination, primary image), /public/products/{slug} (images, variants, related)
- Cache headers on public GETs
- Tests: only active + show_on_website rows; no price fields

**Frontend (Lovable):**
- Header with mega menu, footer, floating WhatsApp, mobile bottom bar
- Home sections 1-5 and 9
- Products listing (search, tabs, pagination), Category page
- Product detail: gallery, variant chips, specs table, related, quote drawer prefilled
- SEO tags and JSON-LD

**Done when:**
- All 19 products and 3 categories render with images
- Search and filters work
- Responsive at 375, 768, 1280 px

### Phase 2 — Public site: trust pages and enquiries

**Goal:** Remaining pages, quote form saving to the server, SEO.

**Backend (Claude Code):**
- GET /public/clients, /public/certifications
- POST /public/enquiries: validation, honeypot, rate limit, safe file upload to private storage, optional email notification
- Tests: oversized/fake files rejected, honeypot stores nothing

**Frontend (Lovable):**
- About, Capabilities, Sustainability, Clients, Contact, 404
- Home sections 6-8
- Quote form (zod, upload, success state, prefill) wired to the API; also mini form and drawer
- sitemap.xml, robots.txt, per-page meta
- Flags hide capacity, certificates, stats

**Done when:**
- Quote form creates an enquiry and stores the file privately
- No UNB name, numbers or certificate IDs appear anywhere
- Lighthouse mobile performance 85+

### Phase 3 — Admin shell, auth and dashboard

**Goal:** Secure admin with roles and dashboard.

**Backend (Claude Code):**
- Auth::require(role) helper and role matrix tests
- GET /dashboard/summary, /dashboard/sales-by-day, /search
- Forgot/reset/change password with emailed token
- Audit helper writing activity_log

**Frontend (Lovable):**
- Login, logout, forgot/reset, role guard, Waiting-for-approval screen
- Sidebar by role, top bar, global search, breadcrumbs
- Dashboard KPIs, chart, low-stock list, recent invoices, enquiries card
- DataTable (server paging/sort/filter/export), FormDialog, ConfirmDialog, StatusPill

**Done when:**
- Unauthenticated users cannot open /admin
- No-role user sees only the waiting screen
- Staff does not see manager-only items or stock value
- Dashboard figures match SQL

### Phase 4 — Catalogue management

**Goal:** Admin can fully manage products, variants, images, categories, units.

**Backend (Claude Code):**
- CRUD for categories, units, products, variants (+ variant_costs for manager+)
- Image upload/reorder/delete with GD re-encode
- POST /products/import with per-row validation in one transaction
- GET /variants/search (no cost)

**Frontend (Lovable):**
- Product list and tabbed form (Basic, Images, Specs, Variants, Website/SEO)
- Variants table with SKU auto and cost column for manager+
- Categories and Units screens
- CSV/Excel import wizard with preview

**Done when:**
- A new product with 3 variants and 2 images appears publicly when Show on website is on
- Staff cannot see cost fields in UI or API responses

### Phase 5 — Stock

**Goal:** Reliable stock ledger and alerts.

**Backend (Claude Code):**
- StockService with locking; GET /stock, /stock/{variantId}/movements, /stock/value
- POST /stock/opening and /stock/adjust with validation
- Tests for negative adjustment and concurrency

**Frontend (Lovable):**
- Stock overview with filters and status pills
- Variant stock card with movement history
- Opening stock wizard grid
- Adjustment dialog with required reason
- Low/out badges, Excel export

**Done when:**
- Opening stock then adjustment updates balance and history
- Client cannot write stock directly (no such endpoint)

### Phase 6 — Customers and suppliers

**Goal:** People records with balances and ledgers.

**Backend (Claude Code):**
- Customers CRUD with CUS- numbering, balances, dues, ledger
- Suppliers CRUD with SUP- numbering, balances, ledger, product links
- Archive-instead-of-delete rules

**Frontend (Lovable):**
- Customer list, form, profile tabs, printable ledger, due follow-up tab
- Supplier list, form, profile tabs
- Excel import/export

**Done when:**
- Customer due = opening + invoices - payments
- Supplier payable = opening + received value - payments
- Staff cannot open Suppliers

### Phase 7 — Sales, invoices and payments

**Goal:** Quotation to paid invoice, with challan.

**Backend (Claude Code):**
- OrderService, InvoiceService (4.3 totals, 4.5 confirm, 4.6 cancel, 4.7 return, 4.8 convert)
- PaymentService with sync (4.4) and receipt numbers
- Delivery challans without prices
- Tests A8-A13

**Frontend (Lovable):**
- Order list/form/detail with live stock warning
- Invoice list/form/detail; Confirm, Cancel, Return, Receive payment dialogs
- Print views: invoice, challan, receipt, quotation (A4, logo, Bangla font)
- WhatsApp/email share links

**Done when:**
- Confirm reduces stock; over-selling is refused with the item named
- Cancel restores stock; blocked with payments
- Partial then full payment sets Partial then Paid
- Print matches the sample invoice layout

### Phase 8 — Purchases and receiving

**Goal:** Buy from suppliers and receive into stock.

**Backend (Claude Code):**
- PurchaseService (4.10 receive, 4.11 return), PO numbering and status flow
- Supplier payments with SV- vouchers
- GET /receiving/pending without prices; reorder suggestions
- Tests A14-A15

**Frontend (Lovable):**
- PO list/form/print
- Receive-goods screen and staff Pending receipts screen
- Supplier payment dialog and voucher print
- Purchase return, reorder suggestions

**Done when:**
- Receiving 8 then 12 of 20 moves PO Partial then Received
- Over-receiving rejected
- Supplier payable updates
- Staff never see rates

### Phase 9 — Reports, enquiries, content and settings

**Goal:** Management visibility and admin controls.

**Backend (Claude Code):**
- All /reports/* endpoints
- Enquiry list/detail/attachment/convert
- Clients and certifications CRUD + logo upload
- Settings, numbering, users/roles, activity-log endpoints

**Frontend (Lovable):**
- Reports hub with filters, print, Excel export
- Enquiry inbox with convert to quotation
- Content screens for clients and certifications with confirmation prompts
- Settings, numbering, Users & Roles, Activity log

**Done when:**
- Every report matches underlying data
- Admin can assign roles and the user gains access on next load
- Activity log lists changes

### Phase 10 — QA, security hardening and cPanel launch

**Goal:** Production-ready on cPanel.

**Backend (Claude Code):**
- Run the full test list (NRE_BACKEND_API.md section 9) and fix failures
- Security checklist (section 3): headers, uploads, throttling, errors, config permissions
- Nightly mysqldump cron, ALLOW_REGISTRATION=false after first admin
- Package nre_backend.zip and write deployment notes

**Frontend (Lovable):**
- Role-based test pass, mobile pass, empty/loading/error states
- Accessibility and Lighthouse
- Production build with VITE_USE_MOCK=false; sitemap, canonical, robots
- Staff hand-over guide

**Done when:**
- All acceptance criteria in PRD section 12 pass on the live cPanel site
- HTTPS enforced, backup file appears next day

---

## 12. Acceptance criteria and test script

| # | Scenario | Expected |
|---|---|---|
| A1 | Open `/` as anonymous | 3 categories, featured products, no UNB text/numbers/certificates |
| A2 | Open each of 19 product pages | Images, specs table, variants chips, quote button |
| A3 | Submit quote form with file | Row in `enquiries`, file stored privately, visible to staff only |
| A4 | Visit `/admin` logged out | Redirect to login |
| A5 | Sign in as user with no role | "Waiting for approval", no data visible |
| A6 | Staff opens product variant | No purchase price anywhere; no Suppliers/Purchases/Profit menus |
| A7 | Manager sets opening stock 50 | Balance 50, movement "opening" |
| A8 | Staff creates invoice for 30, confirms | Stock 20; invoice Due; due date = date + credit days |
| A9 | Confirm invoice for more than available | Error naming the item, stock unchanged |
| A10 | Record 10,000 payment on 25,400 invoice | Status Partial, balance 15,400; customer due updates |
| A11 | Manager records sales return of 5 | Stock +5; credit note payment; balance reduced |
| A12 | Cancel invoice with payments | Blocked with clear message |
| A13 | Cancel invoice without payments | Stock restored; status Cancelled |
| A14 | Create PO 20, receive 8 then 12 | Stock +8 then +12; PO Partial then Received; supplier payable = 20 × rate |
| A15 | Over-receive | Rejected |
| A16 | Staff/manager tries to write stock directly (any endpoint or crafted request) | No endpoint exists; only opening/adjust (manager+) and document flows change stock |
| A17 | Staff opens dashboard | Stock value hidden |
| A18 | Manager runs profit report | Sales, cost, profit shown |
| A19 | Print invoice | A4, logo, references, totals, balance, footer, Bangla name prints correctly |
| A20 | Toggle product "Show on website" off | Disappears from public site |
| A21 | Admin assigns manager role to new user | User gains manager access on next load |
| A22 | Lighthouse mobile on Home | Performance ≥ 85, Accessibility ≥ 90 |
| A23 | Open `/api/v1/stock` without login | 401; no data leaked |
| A24 | Upload a `.php` file renamed `.jpg` as product image or enquiry attachment | Rejected |
| A25 | Whole system on cPanel: no request leaves the hosting except email | DB, files and sessions all on cPanel; no third-party database or backend |
| A26 | Next morning after launch | A new `nre_YYYY-MM-DD.sql.gz` exists in `~/backups` |

---

## 13. Open questions and content gaps

Defaults used until the owner answers are in the JSON (`content_gaps`).

| ID | Question | Default until answered |
|---|---|---|
| G1 | NR's own founding year, capacity, staff count? | Not shown |
| G2 | Does NR manufacture in-house or source trims? (cover says manufacturer & exporter) | Neutral "supplier of garments trims & accessories" |
| G3 | Which certificates does NR itself hold, with numbers? | Hidden |
| G4 | NR's own factory/office/team photos? | Cover building photo in About, flagged |
| G5 | Facebook, YouTube, website domain, QR destination? | Icons hidden |
| G6 | Permission to show the 20 client logos? | Shown, flagged unconfirmed |
| G7 | Higher-resolution product photos? | Small card sizes only |
| G8 | Per-product specs, colours, widths, MOQ, units? | Seed defaults |
| G9 | Does NR still supply the 8 trims removed from the updated profile? | Kept |
| G10 | BIN/TIN/trade licence, bank details, invoice terms? | Blank settings fields |
| G11 | Google Maps embed URL? | Placeholder |
| G12 | Bangla website copy? | English only |
| G13 | Existing stock, customers, suppliers, opening dues? | Import after go-live setup |
| G14 | A management message written for NR? | Omitted |

---

## Appendix A — Invoice print layout (A4)

```
┌──────────────────────────────────────────────────────────────┐
│ [NR logo]                                   TAX INVOICE       │
│ NR Enterprise                               Invoice No: INV-0248
│ House # 375/C, Chanpara, Uttarkhan,         Date: 19 Nov 2026 │
│ Dhaka-1230 · +880 1876584213                Due:  19 Dec 2026 │
│ nrenterprisebd2@gmail.com · BIN: (if set)   Terms: Credit 30d │
├──────────────────────────────────────────────────────────────┤
│ Bill to: Alpha Knitwear Ltd., Gazipur       Buyer: ONLY       │
│ Phone / BIN                                 PO: PO-7781       │
│                                             Style: ST-204     │
├────┬──────────────────────────┬────────┬──────┬───────┬───────┤
│ #  │ Item                     │ Qty    │ Unit │ Rate  │Amount │
├────┼──────────────────────────┼────────┼──────┼───────┼───────┤
│ 1  │ Woven label taffeta Navy │ 10,000 │ pcs  │ 1.20  │12,000 │
│ 2  │ Elastic 20 mm White      │ 20     │ roll │ 850   │17,000 │
│ 3  │ Metal snap 15L Antique   │ 6      │ gross│ 1,150 │ 6,900 │
├────┴──────────────────────────┴────────┴──────┴───────┼───────┤
│ In words (BDT): …                         Subtotal     │35,900 │
│                                           Discount     │ −900  │
│ Bank / bKash details (from settings)      VAT (if on)  │   —   │
│                                           TOTAL (৳)    │35,000 │
│                                           Paid         │10,000 │
│                                           BALANCE DUE  │25,000 │
├──────────────────────────────────────────────────────────────┤
│ Received by ________    Authorised by ________   Footer text  │
└──────────────────────────────────────────────────────────────┘
```

## Appendix B — Status flows

- **Sales order:** quotation → confirmed → delivered → invoiced · cancelled
- **Invoice:** draft → (confirm) due → partial → paid · cancelled (manager+, no payments)
- **Purchase order:** draft → ordered → partial → received · cancelled
- **Enquiry:** new → contacted → quoted → won / lost

## Appendix C — Document numbers

`INV-0001` invoice · `SO-0001` sales order · `CH-0001` challan · `RC-0001` money receipt · `PO-0001` purchase order · `SV-0001` supplier voucher · `CUS-0001` customer · `SUP-0001` supplier. Prefixes editable in Settings (admin).

## Appendix D — File map

| File | Purpose |
|---|---|
| `NRE_PRD.md` | This document |
| `NRE_BACKEND_API.md` | Architecture, conventions, security, SQL recipes, 117 endpoints, local dev, cPanel deploy, backend tests |
| `nre-project-spec.json` | Brand, copy, categories, 19 products, clients, pages/sections, admin modules, database rules, API list, phases, gaps |
| `NRE_mysql_schema.sql` | 28 tables and 6 views for MySQL/MariaDB (cPanel-safe, no triggers) |
| `NRE_mysql_seed.sql` | Categories, products, variants, images, clients, certificates (unpublished), settings, units, counters |
| `NRE_CLAUDE_CODE_PROMPTS.md` | Master instruction + one backend prompt per phase for Claude Code |
| `NRE_LOVABLE_PROMPTS.md` | Master instruction + one frontend prompt per phase for Lovable |
| `NRE_Updated_Business_Profile.md` | Profile analysis, corrected wording, gaps |
| `assets/` | `brand/` logos · `products/<slug>/` photos · `clients/` logos · `site/` section photos |
