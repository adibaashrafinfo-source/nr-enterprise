# NR Enterprise — Lovable Prompts (frontend only)

Lovable builds **only the frontend**: the public website and the admin panel screens. The backend (PHP API + MySQL on cPanel) is built separately with Claude Code (see `NRE_CLAUDE_CODE_PROMPTS.md`). **Do not use Supabase or any hosted database in Lovable.**

## Before you open Lovable (once)

1. Create a new Lovable project. **Do not connect Supabase.**
2. Put these files in the project (upload to chat or GitHub repo):
   - `docs/NRE_PRD.md`, `docs/NRE_BACKEND_API.md`, `docs/nre-project-spec.json`, `docs/NRE_Updated_Business_Profile.md`
   - the whole `assets/` folder → `public/assets/` (so `/assets/products/...`, `/assets/clients/...`, `/assets/brand/...` work)
3. Open Project settings → Knowledge and paste the **Master Instruction** below.
4. Paste **Phase 0**, wait until it finishes and the Check list passes, then **Phase 1**, and so on. One phase at a time.
5. Work in **mock mode** (`VITE_USE_MOCK=true`) while the PHP API is not ready. When the backend phase is finished, test the same screens against the real API (see "Switching to the real API" at the end).

If a result is wrong, reply in the same chat with what to fix. Do not start the next phase until the Check list passes.

---

## MASTER INSTRUCTION (paste once into Project Knowledge)

```
You are building the FRONTEND ONLY for NR Enterprise ("All Kinds of Garments Accessories"), a Bangladeshi garments trims and accessories supplier (labels, tags, stickers, thread, elastic, twill tape, drawcords, cord stoppers, buttons): a public website plus an admin panel.

THERE IS NO SUPABASE AND NO LOVABLE CLOUD BACKEND
The backend is a separate PHP REST API with a MySQL database on the owner's cPanel hosting, built elsewhere. Never add Supabase, Firebase, Lovable Cloud, localStorage-as-database, or any third-party backend/database. The browser talks ONLY to the REST API at /api/v1 (same origin).

SOURCES OF TRUTH (read before every task)
- docs/NRE_BACKEND_API.md : the API contract. Endpoint paths, methods, roles, field names, error format, pagination, money-as-string rules. Section 6 lists every endpoint.
- docs/NRE_PRD.md : requirements, screens, rules, phases, acceptance tests.
- docs/nre-project-spec.json : brand tokens, exact copy, routes, 19 products, clients, admin modules, api.endpoints.
- Product and client images are already in public/assets (paths come from the API and the JSON). Do not generate or hotlink other photos.

STACK
React + TypeScript + Vite, Tailwind, shadcn/ui, React Router, TanStack Query, react-hook-form + zod, date-fns, recharts, lucide-react, SheetJS (xlsx) for Excel export. Poppins font (Hind Siliguri as Bangla fallback).

API CLIENT (build in Phase 0, use everywhere)
- One file src/lib/api.ts with typed functions per endpoint group. No fetch calls inside components.
- fetch with credentials: 'same-origin'; JSON; for non-GET add header X-CSRF-Token (token from GET /auth/me, kept in memory). Parse the standard success {data, meta} and error {error:{code,message,fields}} envelopes. 401 -> go to /admin/login. 403 -> show "Not allowed".
- Money and quantities arrive as decimal STRINGS ("25440.00", "30.000"). Keep them as strings; use a decimal-safe helper (src/lib/money.ts) for display and any arithmetic. Never use parseFloat sums for final totals.
- MOCK MODE: if import.meta.env.VITE_USE_MOCK === 'true', api.ts uses src/mocks/ (an in-memory adapter) instead of fetch. The mock serves the same shapes as the real API, seeded from the spec JSON (categories, products, variants, images, clients) plus a small set of demo admin data (a few customers, suppliers, stock movements, invoices, payments, purchase orders, enquiries, users for each role). Implement mock endpoints phase by phase as screens are built. Mock logic may be simple but must return the same field names and error shapes. Show a small "Demo data" badge in the admin when mock mode is on.
- Production sets VITE_USE_MOCK=false and VITE_API_BASE=/api/v1.

BRAND (match the NR logo exactly)
Yellow #F8C840 (primary CTA, active states), green #6FA33F (decorative), deep green #2F5D1A (links, secondary), ink #201818 (text), ink-green #14210F (dark sections, footer, admin sidebar), cream #FBF8EE (alternate backgrounds), line #E8E2CF.
Text on yellow is always ink. White text only on ink, ink-green or deep green. Never small text in #6FA33F on white.
Use /assets/brand/nr-logo-full.png on light backgrounds and /assets/brand/nr-logo-mark.png on dark backgrounds, favicon and admin sidebar.
Style: premium, clean, rounded (16px cards, pill buttons), soft shadows, faint dotted "NR" watermark, yellow bar under headings, product cards with a yellow caption strip. Subtle fade-up animations only.

CONTENT RULES (very important)
- Never display: "United Nine Bangladesh", "UNB", "Sun Tin Lun", "Founded in 2015", "85 million", "150+ employees", "10+ years", machine lists, capacity numbers or certificate numbers. They belong to another company.
- Certificates, capacity and stats blocks must exist in code but stay hidden (render certificates only from GET /public/certifications which is empty by default; flags SHOW_CAPACITY=false, SHOW_STATS=false in src/config/flags.ts).
- Hide social icons or website link when the value is empty.
- No prices on the public site. No shopping cart.

BUSINESS RULES THE UI MUST RESPECT
- The server owns all calculations and numbers. Never compute or send invoice subtotal, tax, total, paid, balance, status, document numbers (invoice_no, order_no, receipt_no, po_no, voucher_no, code) or stock. Show what the API returns. You may show a live preview of a line amount (qty x rate x (1 - disc%)) while editing, but the saved values come from the API.
- Stock is never edited directly. Only these actions change stock: opening stock, stock adjustment (manager+), confirm/cancel invoice, sales return, receive goods, purchase return.
- Invoices are editable only while status = 'draft'. Confirm, Cancel, Return are separate actions that call their own endpoints and show the exact server error message (409) in a toast/dialog.
- Roles: admin, manager, staff, or none. Read role from GET /auth/me. Users with no role see only a "Waiting for approval" screen. Hide manager-only menu items and cost/price-of-purchase columns for staff, but remember the server enforces it.
- Purchase prices and supplier rates are shown only to manager/admin. Staff screens (stock, variant picker, receiving) never show cost.
- Format money as BDT with en-IN grouping, e.g. ৳ 1,84,500.
- Use server-side pagination for lists (page, per_page). Show loading, empty and error states everywhere. Toast on every write. Confirm dialog for cancel/delete.

WORKING STYLE
Build only the phase I ask for. Keep components small and reusable (DataTable, FormDialog, ConfirmDialog, StatusPill, MoneyText, PageHeader). Make every page responsive (375 / 768 / 1280). Accessible labels and focus states. When finished, list what you built, which endpoints each screen calls, and any assumption you made.
```

---

## PHASE 0 — Foundation, design system, API client

```
Phase 0 of docs/NRE_PRD.md section 11 (Frontend part). Read docs/NRE_PRD.md, docs/NRE_BACKEND_API.md and docs/nre-project-spec.json first. Do not connect any backend service.

Build:
1. Tailwind theme and CSS variables from spec.brand.colors; Poppins (400/500/600/700) and Hind Siliguri fallback; radius, shadow and motion tokens.
2. Reusable components: Button (yellow primary with ink text, deep-green secondary, outline), Card, Badge, StatusPill (ok/low/out/draft/due/partial/paid/cancelled), SectionHeading (heading with short yellow bar), ProductCard (image + yellow caption strip, category chip, "Get quote"), MoneyText (BDT en-IN, string-safe), PageHeader, EmptyState, LoadingSkeleton, DataTable (server-side pagination, sort, search), FormDialog, ConfirmDialog.
3. Layouts: PublicLayout (placeholder header/footer) and AdminLayout (ink-green sidebar with the NR mark, white top bar, content area).
4. React Router with ALL routes from the PRD section 4 stubbed with titles: public routes, /admin/* routes, 404.
5. API client exactly as described in the Master Instruction: src/lib/api.ts (typed functions for the Auth and Public groups now, the rest later), src/lib/money.ts, src/lib/types.ts (TypeScript types for the entities in the API doc), src/mocks/ adapter with seed data from the spec JSON, VITE_USE_MOCK flag (default true for now), TanStack Query provider.
6. AuthContext: calls GET /auth/me, exposes user, role, csrfToken, login/logout; useRole hook with helpers isStaffPlus, isManagerPlus, isAdmin.
7. A /styleguide route showing colours, typography, buttons, cards, pills and the logo on light and dark backgrounds.
8. Favicon and page title using the NR circle mark. .env.example with VITE_USE_MOCK and VITE_API_BASE.

Do NOT build real pages yet.

Check: app runs in mock mode; /styleguide shows all tokens/components; mock GET /public/products returns the 19 products; no Supabase or other backend code exists in the project.
```

## PHASE 1 — Public site: core catalogue

```
Phase 1 (Frontend): Public site core catalogue. Use spec.website.global and spec.website.pages for Home, Products, Category and Product detail. Data comes from GET /public/categories, /public/products, /public/products/{slug}, /public/settings via src/lib/api.ts (mock mode for now).

Build:
1. Real header (sticky, logo, nav, phone, yellow "Request a Quote"), Products mega menu from categories, footer (ink-green with dotted NR watermark, contact from settings), floating WhatsApp button (settings.whatsapp), mobile bottom bar (Call, WhatsApp, Quote).
2. Home sections 1-5 and 9 (hero, trust strip, category cards, featured products, why NR, quote CTA). Exact copy from spec.website.pages[0].
3. /products: search (name/code), category tabs, 3-column grid, server pagination 12 per page.
4. /products/:categorySlug: hero, filter bar, grid, related categories.
5. /products/:categorySlug/:productSlug: gallery with zoom, summary panel (name, code, short description, features, variant chips, MOQ and unit, Request a Quote, WhatsApp link), tabs (Description, Specifications built from product.specs, Finishing options only for offset tags), related products. No prices.
6. Request-a-Quote drawer opened from product cards/pages, prefilled with the product (submit is wired in Phase 2; for now validate and show a toast).
7. SEO: page titles, meta descriptions, Open Graph, JSON-LD Organization and Product (use react-helmet-async or equivalent).

Check: all 3 categories and 19 products show with correct images; search and filters work; responsive at 375/768/1280; no banned content; every data call goes through src/lib/api.ts.
```

## PHASE 2 — Public site: trust pages and enquiries

```
Phase 2 (Frontend): Trust pages and enquiries.

Build:
1. Pages: About, Capabilities, Sustainability, Clients, Contact, 404 — sections and copy from spec.website.pages. NR Enterprise wording only (see CONTENT RULES). Capacity block behind SHOW_CAPACITY=false; certificates section only when GET /public/certifications returns rows (hidden when empty); stats hidden by SHOW_STATS=false.
2. Home sections 6-8: process strip, sustainability band (Reduce, Reuse, Recycle, Recover icons), clients marquee from GET /public/clients (grayscale to colour on hover; hidden when empty).
3. Contact page quote form: fields name*, company, phone*, email, category, product, quantity, required date, message, file upload (jpg/png/webp/pdf up to 5 MB), checkbox "I need a sample first", hidden honeypot field named "website". Zod validation. Submit with POST /public/enquiries as multipart/form-data (see API doc). Success state with thank-you text and WhatsApp link. Show field errors from the API (422). Prefill from ?product=slug&sample=1. Connect the Home mini form and the quote drawer to the same submit function. Mock mode: store in memory and return {data:{id, ok:true}}.
4. Contact details block (address, tap-to-call phones, email, WhatsApp; social icons only if URLs exist), map embed from settings.map_embed_url with a placeholder card when empty.
5. sitemap.xml and robots.txt in public/, meta tags per page.

Check: submitting the form works in mock mode and builds the correct multipart request (verify in the network tab); honeypot is present and hidden; no UNB name, numbers or certificate IDs anywhere; Lighthouse mobile performance 85+ and accessibility 90+.
```

## PHASE 3 — Admin shell, auth and dashboard

```
Phase 3 (Frontend): Admin shell, authentication and dashboard. Read PRD sections 7.1, 7.2 and API doc Auth, Dashboard groups.

Build:
1. /admin/login (email + password, forgot password link, show/hide password), /admin/forgot-password, /admin/reset-password?token=, change password in the user menu. Route guard: not signed in -> login; signed in with role null -> "Waiting for approval" screen with sign-out. Optional /admin/register screen (first admin setup) shown only if the API says registration is allowed (try POST and show the error otherwise).
2. Sidebar menu by role: admin sees everything; manager sees all except Settings & Users; staff sees Dashboard, Stock (view), Sales Orders, Invoices, Customers, Purchases (Pending receipts only), Enquiries. Collapsible, icons, yellow active state, enquiries badge with the count of new enquiries.
3. Top bar: global search (GET /search?q=) with grouped results, user menu. On mobile the sidebar is a drawer.
4. Dashboard from GET /dashboard/summary and /dashboard/sales-by-day: KPI cards (sales today vs yesterday, stock value only if not null, customer dues + unpaid count, low stock count), sales chart with 7/30 day toggle, low-stock list (GET /stock?status=low) with "Create purchase" link, recent invoices with status pills, new enquiries card, quick actions.
5. Finish the shared DataTable (server pagination, sort, filter chips, column visibility, Excel export via SheetJS), FormDialog, ConfirmDialog.
6. Extend mock mode with three demo users (admin, manager, staff) and a "no role" user so every role can be tried; the login form in mock mode can show the demo accounts.

Check: /admin is unreachable logged out; staff does not see manager-only menu items or stock value; no-role user sees only the waiting screen; dashboard works in mock mode; mobile drawer works.
```

## PHASE 4 — Catalogue management

```
Phase 4 (Frontend): Catalogue management (PRD 7.3; API doc Catalogue group). admin and manager can edit; staff can only view (no cost).

Build:
1. /admin/products list: search, filter by category and status, columns (image, name, code, category, variants count, total stock, website visible, featured, status), row actions.
2. Product form with tabs: Basic (name, auto slug, code, category, unit, MOQ, short/full description, features list), Images (upload via POST /products/{id}/images, drag to reorder via PUT .../images/order, set primary, delete), Specs (render inputs from the category's field template in spec.products[].specs.fields; save to specs), Variants, Website/SEO (show_on_website, is_featured, seo fields).
3. Variants table inside the product: colour, size/width, material, pack size, SKU (auto when empty, editable), selling price, purchase price (visible and editable only for manager/admin), reorder level, active toggle.
4. /admin/products/categories and /admin/products/units screens (CRUD).
5. Import from Excel/CSV: parse in the browser (SheetJS), column mapping, preview with row errors, then POST /products/import.
6. Archive instead of delete; show the server's 409 message when delete is blocked.
7. Mock mode: implement these endpoints in the mock adapter.

Check: product with 3 variants and 2 images can be created in mock mode; staff view never renders a purchase price field; SKU duplicate error from the API is shown on the field.
```

## PHASE 5 — Stock

```
Phase 5 (Frontend): Stock (PRD 7.4; API doc Stock group).

Build:
1. /admin/stock overview (GET /stock): product/variant, category, unit, in stock, reorder level, status pill (ok/low/out), selling price. Filters: category, status, search. Excel export. Stock value card for manager/admin only (GET /stock/value).
2. Variant stock card /admin/stock/:variantId: header with current stock, movement history (date, type, quantity with + or -, document link by reference_type/reference_id, buyer, style no, batch, user, note), filter by type and date.
3. Opening stock wizard (manager/admin): editable grid of variants with quantity and purchase cost; one POST /stock/opening per row with per-row success/error.
4. Adjustment dialog (manager/admin): variant, quantity (+/-), required reason; POST /stock/adjust; show the "would make stock negative" error.
5. Low and out-of-stock badges; link from the dashboard low-stock card.
No direct Stock In/Out buttons: stock in comes from receiving (Phase 8), stock out from invoice confirmation (Phase 7).
6. Mock mode: implement a simple in-memory stock ledger with the same rules.

Check: opening stock then an adjustment updates balance and history; staff can view but not adjust or see value.
```

## PHASE 6 — Customers and suppliers

```
Phase 6 (Frontend): Customers and suppliers (PRD 7.7, 7.8; API doc Customers, Suppliers groups).

Customers (staff, manager, admin can add/edit; delete manager+):
1. /admin/customers list (code, name, phone, area, type, total sales, due balance). Search by name/phone/area; filters by type and "has due". "Due follow-up" tab from GET /customers/dues with days overdue.
2. Customer form: name*, contact person, phone, WhatsApp, email, billing address, delivery address, area, type (factory, buying_house, brand, retail, other), credit days, credit limit, opening balance, buyers served, BIN, notes, active. Do not send code.
3. Customer profile with tabs: Orders, Invoices, Payments, Ledger (GET /customers/{id}/ledger with running balance and a Print button), Notes. Buttons: New order, New invoice, Receive payment (wired in Phase 7).
4. Excel import/export.

Suppliers (manager/admin only):
5. /admin/suppliers list (total purchased, paid, payable). Supplier form: name*, contact person, phone, email, address, payment terms, opening balance, notes, active, products supplied (multi-select). Profile tabs: Purchases, Payments, Ledger, Products. Buttons: New purchase, Make payment (wired in Phase 8).
6. Mock mode for both.

Check: the ledger's final balance equals the list's due balance; staff cannot open Suppliers (menu hidden and route blocked).
```

## PHASE 7 — Sales orders, invoices and payments

```
Phase 7 (Frontend): Sales orders, invoices, payments, challan and printing (PRD 7.5, 7.6, 10, Appendix A; API doc Sales group). Roles: staff, manager, admin; cancel, sales return and payment edit/delete are manager/admin.

Build:
1. /admin/orders: list, form (customer, dates, buyer/brand, buyer PO no., style no., lines with variant search via GET /variants/search, description, unit, quantity, rate defaulting to selling price, discount %, order discount, notes), live stock indicator per line (warning only), statuses quotation/confirmed/delivered/invoiced/cancelled, printable quotation. "Convert to invoice" calls POST /orders/{id}/convert and opens the new draft invoice.
2. /admin/invoices: list (filters status, customer, date range; columns number, date, customer, total, paid, balance, status pill) and form. Draft is editable; other statuses are read-only. Default due date = date + customer credit days (preview only; server decides). VAT rate preview from settings when tax enabled. Show credit-limit warnings returned by confirm.
3. Buttons: Confirm (POST /invoices/{id}/confirm; show the exact stock error), Cancel (manager/admin, with reason; show the "has payments" error), Sales return (manager/admin, per line), Receive payment dialog (date, method cash/bkash/nagad/bank/cheque, reference no., amount not above balance, note) via POST /invoices/{id}/payments, then show the receipt number and a printable money receipt.
4. Delivery challan: dialog (vehicle no., driver, received by, note); printable challan listing invoice lines without prices.
5. Print/PDF views for invoice, challan, receipt and quotation using a print stylesheet (A4): NR logo, company block (address, phones, email, BIN if set), buyer references, lines, totals, balance, bank details and footer from the invoice's company block, "amount in words" in BDT, signature lines. Layout as PRD Appendix A. Embed Hind Siliguri or Noto Sans Bengali so Bangla customer names print.
6. Share: WhatsApp link (wa.me with invoice number, total, balance) and mailto link.
7. Customer profile buttons (Phase 6) now work.
8. Mock mode: implement the same rules in simple form (stock check, draft-only edit, payment status).

Check: in mock mode confirm reduces stock and over-selling shows an error naming the item; cancel restores stock; partial payment shows Partial, full shows Paid; print preview matches Appendix A and Bangla names render.
```

## PHASE 8 — Purchases and receiving

```
Phase 8 (Frontend): Purchases and receiving (PRD 7.9; API doc Purchases group, supplier payments).

Build:
1. /admin/purchases (manager/admin): PO list and form (supplier, order date, expected date, lines with variant, quantity ordered, rate with a "last purchase rate" hint, notes). Statuses draft, ordered, partial, received, cancelled. Supplier bill number field. Printable PO.
2. Receive goods screen: per line quantity (not above pending), optional batch/lot and note; POST /purchase-items/{id}/receive; show updated status.
3. Staff-safe screen /admin/purchases/receiving for ALL roles using GET /receiving/pending (no prices) with the same receive action. Staff must not see the PO list or rates.
4. Supplier payments (manager/admin): dialog with date, method, reference, amount, optional PO; printable voucher; supplier profile tabs now show purchases, payments and ledger.
5. Purchase return (manager/admin) per line.
6. Reorder suggestions from GET /purchases/reorder-suggestions with a one-click "Create PO" that pre-fills lines.
7. Mock mode.

Check: receiving 8 then 12 of a 20-unit line moves the PO to Partial then Received; over-receiving shows the server error; staff never see prices.
```

## PHASE 9 — Reports, enquiries, content and settings

```
Phase 9 (Frontend): Reports, enquiries, website content, settings and users (PRD 7.10 to 7.13; API doc Reports, Enquiries, Content, Settings groups).

Build:
1. /admin/reports: stock report (qty and value), low stock, stock movement by date range, sales by date/customer/product, purchases by date/supplier/product, customer dues and aging, supplier payable, profit summary. Manager-only reports hidden from staff. Each has date filters, print view and Excel export.
2. /admin/enquiries (all roles): inbox with status filter (new, contacted, quoted, won, lost), detail view with attachment link (GET /enquiries/{id}/attachment), internal note, call and WhatsApp buttons, status change, and "Convert to quotation" (POST /enquiries/{id}/convert) then open the order.
3. /admin/content (manager/admin): Clients (upload logo, sort order, show/hide, permission_confirmed toggle with a warning when off) and Certifications (name, description, certificate number, logo, publish toggle; publishing requires ticking "I confirm NR Enterprise holds this certificate").
4. /admin/settings (admin only): company details (name, tagline, address, phones, emails, WhatsApp, social links, website, map embed, BIN, TIN, trade licence, logo upload, bank details, invoice footer), tax on/off and rate, document number prefixes, Users & Roles (list, create, set role, deactivate, reset password), Activity log table with filters by table, action and user.
5. Mock mode for all of the above.

Check: reports render in mock mode; admin can assign a role in mock mode; settings fields match API doc; staff cannot reach Settings or manager-only reports.
```

## PHASE 10 — QA, polish and production build

```
Phase 10 (Frontend): QA and polish. Walk through PRD section 12 (A1-A22) for everything the frontend controls and fix every failure.

Do:
1. Test as admin, manager, staff, a no-role user and anonymous in mock mode. Fix any screen that shows data or actions the role should not have.
2. Mobile pass for the admin: tables become stacked cards, dialogs fit, sidebar is a drawer.
3. Empty, loading and error states wherever missing; every write shows a toast and every destructive action has a confirm dialog.
4. Accessibility: labels, focus rings, keyboard use of dialogs, contrast; Lighthouse mobile for Home: performance 85+, accessibility 90+.
5. Search the whole codebase for banned text: "United Nine", "UNB", "Sun Tin Lun", "2015", "85 million", "150+", "FSC C", "GSCI", and for any "supabase" import. Remove every hit.
6. SEO: titles, descriptions, canonical, sitemap.xml, robots.txt, JSON-LD.
7. Production config: VITE_USE_MOCK=false, VITE_API_BASE=/api/v1, base path "/", no absolute dev URLs. Make sure `npm run build` outputs a static dist/ that works when served from the root of a cPanel public_html with the .htaccess SPA fallback from NRE_BACKEND_API.md section 1.2.
8. Write docs/HANDOVER.md for staff (login, add a product, set opening stock, make an invoice, receive payment, receive goods, run a report) in simple English.
9. List remaining items I must supply (see spec.content_gaps) and where to enter them in the admin.

Output a pass/fail table for the frontend-testable items of A1-A22.
```

---

## Switching to the real API (after Claude Code finishes a backend phase)

```
The PHP backend for this phase is ready. Switch the screens of this phase from mock to the real API: set VITE_USE_MOCK=false, VITE_API_BASE to the local or staging URL (use a Vite dev proxy for /api to avoid CORS), then run through each screen. Fix any mismatch between the mock and the real responses by changing the frontend to follow docs/NRE_BACKEND_API.md. Report every difference you found. Do not change the API contract; if the contract looks wrong, tell me.
```

## Optional follow-up prompts

**Replace placeholder photos**
```
In the admin Products screen, show a "Low-resolution image" banner for images under 600 px wide (check natural size in the browser) and a one-click Replace button that uploads through POST /products/{id}/images and removes the old one.
```

**Bangla toggle (later)**
```
Add an English/Bangla language toggle for the public site only. Extract all static public strings into translation files (en, bn), default English, remember the choice. Do not translate product data yet.
```
