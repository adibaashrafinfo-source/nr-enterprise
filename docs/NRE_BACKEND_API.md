# NR Enterprise — Backend & API Specification (PHP + MySQL on cPanel)

**For:** Claude Code (builds the backend) and Lovable (builds the frontend against this contract)
**Hosting:** one cPanel account. PHP + MySQL/MariaDB only. **No Supabase, no third-party database, no third-party backend service.** All data stays on the cPanel server.
**Companion files:** `NRE_mysql_schema.sql` · `NRE_mysql_seed.sql` · `nre-project-spec.json` (`api.endpoints` is the same list as section 6) · `NRE_PRD.md`

---

## 1. Architecture

```
Browser ──HTTPS──▶  https://nrenterprise.example/            (React SPA built by Lovable, static files)
                    https://nrenterprise.example/api/v1/...  (PHP REST API, JSON)  ──PDO──▶ MySQL / MariaDB (same cPanel)
```

- **Same origin.** SPA and API share one domain, so no CORS and the session cookie works. Do not enable CORS.
- **Frontend:** React + TypeScript + Vite static build (`dist/`), uploaded to `public_html/`. Built in Lovable.
- **Backend:** PHP 8.1+ (cPanel MultiPHP), PDO MySQL, no framework required. Composer packages are optional; if used, `vendor/` is committed/uploaded because cPanel may lack Composer.
- **Auth:** PHP session cookie (`HttpOnly; Secure; SameSite=Lax`) + CSRF token header. No JWT in browser storage.
- **Business logic lives in PHP services inside DB transactions.** The database has no triggers or stored procedures (shared-hosting safe).
- **Files:** product/client images in `public_html/uploads/` (public). Enquiry attachments in a private folder outside `public_html`, streamed only through the API after an auth check.
- **PDF/print:** browser print CSS (A4). No server PDF library needed. **Excel export:** generated in the browser (SheetJS) from API data.
- **Email (optional):** PHP `mail()` or cPanel SMTP for password reset and new-enquiry notification.
- **Backup:** cPanel cron runs `mysqldump` nightly into `~/backups/` (keep 14 days) plus cPanel's own backup.

### 1.1 Folder layout on the server

```
/home/<cpuser>/
  nre_backend/                  (OUTSIDE public_html, not web-accessible)
    config.php                  DB host/name/user/pass, APP_URL, APP_ENV, mail settings, session name  (chmod 640, never in git)
    config.sample.php           template for config.php
    .htaccess                   Require all denied (safety if the folder is ever placed under public_html)
    src/
      bootstrap.php             boot, error mapping, helpers (paging, like, slugify, listResponse)
      Core/Support.php          Config, Db, Request, Response, Money, V (validator), Audit, Numbering, RateLimit, Mailer, Upload
      Core/Auth.php             Auth (session, CSRF, roles) + Router (role-checked dispatch)
      routes/                   auth public dashboard catalogue stock customers suppliers sales
                                purchases reports enquiries content settings   (one file per group of endpoints)
      Services/                 StockService InvoiceService PaymentService OrderService
                                PurchaseService LedgerService CatalogueService   (all DB transactions live here)
    storage/
      enquiries/                private attachments
      logs/                     app.log (rotated)
    deploy/backup.sh            nightly mysqldump (cron). Health check: GET /api/v1/health?key=HEALTHCHECK_KEY
    tests/                      plain PHP integration tests: run_all.sh (not uploaded to the server)
  backups/                      nightly SQL dumps
  public_html/
    index.html  assets/ (Vite output + /assets/products, /assets/clients, /assets/brand, /assets/site)
    .htaccess                   SPA fallback + security headers
    api/
      index.php                 front controller: require '../../nre_backend/src/bootstrap.php'; run router
      .htaccess                 route everything to index.php
    uploads/
      products/  clients/  brand/
      .htaccess                 disable PHP execution, no directory listing
```

### 1.2 `.htaccess` files

`public_html/.htaccess`
```apache
Options -Indexes
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
RewriteRule ^api/ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set X-Frame-Options "SAMEORIGIN"
  Header always set Referrer-Policy "strict-origin-when-cross-origin"
</IfModule>
```
`public_html/api/.htaccess`
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteRule ^ index.php [L]
```
`public_html/uploads/.htaccess`
```apache
Options -Indexes -ExecCGI
<FilesMatch "\.(php|phtml|php\d|phar|cgi|pl|py|sh)$">
  Require all denied
</FilesMatch>
```

---

## 2. Conventions

| Topic | Rule |
|---|---|
| Base URL | `/api/v1` |
| Format | JSON in and out (`Content-Type: application/json`), except multipart uploads |
| Success | `200/201` → `{ "data": ... , "meta": { "page":1, "per_page":25, "total":120 } }` (`meta` only on lists) |
| Error | `{ "error": { "code": "STOCK_SHORT", "message": "Insufficient stock for \"Woven Label\": available 20, needed 30", "fields": { "quantity": "..." } } }` |
| Status codes | 400 bad request · 401 not logged in · 403 role not allowed · 404 not found · 409 business-rule conflict · 422 validation · 429 rate limited · 500 server (generic message, details only in log) |
| Pagination | `?page=1&per_page=25` (max 100). Sorting `?sort=field&dir=asc|desc` from a whitelist |
| Money & quantity | Returned as **strings** with fixed decimals (`"25440.00"`, `"30.000"`). Never floats. Frontend formats with a decimal-safe helper |
| Dates | `YYYY-MM-DD`; timestamps `YYYY-MM-DD HH:MM:SS` in `Asia/Dhaka` (set `date_default_timezone_set` and MySQL `time_zone='+06:00'` per connection) |
| Booleans | `true/false` in JSON (cast from TINYINT) |
| IDs | integers |
| JSON columns | `features`, `specs`, `phones`, `emails`, `attributes` returned as real arrays/objects |
| Caching | Public GET endpoints send `Cache-Control: public, max-age=300`; admin endpoints `no-store` |
| Auth header | Cookie session; every non-GET request must send `X-CSRF-Token` (value from `/auth/me`) |
| Roles | P public · S* logged in (role may be empty) · S staff+ · M manager+ · A admin |

Role order: `admin > manager > staff`. A logged-in user with `role = NULL` may only call `/auth/*`.

---

## 3. Security requirements (must pass before launch)

1. PDO with `ATTR_ERRMODE=EXCEPTION`, `ATTR_EMULATE_PREPARES=false`; **prepared statements only**, no string-built SQL (whitelist column names for sort).
2. `password_hash()` / `password_verify()`; minimum 8 chars; `session_regenerate_id(true)` on login; bump `token_version` on password reset/deactivation and verify it on each request.
3. Login throttle: 5 failures per email or IP in 15 minutes → 429 (table `login_attempts`). Public enquiry: 5 per hour per IP; honeypot field `website` must be empty (silently accept and discard if filled).
4. CSRF token required on all state-changing requests. Reject missing/invalid with 403.
5. Role check at the top of every controller action using a single `Auth::require('manager')` helper; never rely on the frontend hiding things.
6. **Cost privacy:** queries for `staff` must never select from `variant_costs`, supplier prices or PO rates. Dedicated serializers for staff vs manager output.
7. Uploads: check size (≤5 MB), real MIME with `finfo`, extension whitelist (jpg, png, webp; pdf only for enquiries), re-encode images with GD, random file names, no original name in path. Enquiry files stored outside web root.
8. Output encoding handled by the SPA (React). API never returns HTML. Send `Content-Type: application/json; charset=utf-8` and `X-Content-Type-Options: nosniff`.
9. Errors: log to `storage/logs/app.log`, return generic 500 to the client; `display_errors=Off` in production.
10. Secrets only in `config.php` (outside web root, chmod 640). Never commit it. Provide `config.sample.php`.
11. Audit log: write a row to `activity_log` for create/update/delete on products, variants, costs, customers, suppliers, invoices, payments, purchase orders, supplier payments, settings, users, plus stock movements and invoice confirm/cancel.
12. Force HTTPS (AutoSSL) and set session cookie `Secure`.

---

## 4. Transaction recipes (the logic that replaces triggers/procedures)

Every recipe runs inside `START TRANSACTION … COMMIT`; on any exception `ROLLBACK` and return the mapped error. Lock rows in ascending id order to avoid deadlocks. Tested on MariaDB 10.11 against `NRE_mysql_schema.sql`.

### 4.1 Document numbers (atomic, no gaps on rollback)
```sql
UPDATE doc_counters SET last_number = LAST_INSERT_ID(last_number + 1) WHERE doc_type = :type;
SELECT CONCAT(prefix, LPAD(LAST_INSERT_ID(), padding, '0')) AS doc_no FROM doc_counters WHERE doc_type = :type;
```
Use in the same transaction as the insert. Types: `invoice`→`invoice_no`, `order`→`order_no`, `challan`→`challan_no`, `receipt`→`receipt_no`, `purchase`→`po_no`, `voucher`→`voucher_no`, `customer`→`code`, `supplier`→`code`. The client never sends these values.

### 4.2 Stock on hand (per variant) with lock
```sql
SELECT id FROM product_variants WHERE id = :v FOR UPDATE;           -- serialises stock changes per variant
SELECT COALESCE(SUM(quantity),0) FROM stock_movements WHERE variant_id = :v;
```
Only `StockService::post($variantId, $type, $signedQty, $refType, $refId, $note, ...)` inserts into `stock_movements`. Quantity must not be 0. Never UPDATE or DELETE rows there.

### 4.3 Invoice totals (call after every item/header change)
```sql
UPDATE invoices i SET
  subtotal   = (SELECT COALESCE(SUM(amount),0) FROM invoice_items WHERE invoice_id = i.id),
  tax_amount = ROUND(GREATEST((SELECT COALESCE(SUM(amount),0) FROM invoice_items WHERE invoice_id = i.id) - i.discount, 0) * i.tax_rate / 100, 2)
WHERE i.id = :id;
UPDATE invoices SET total = GREATEST(subtotal - discount, 0) + tax_amount WHERE id = :id;
```
Same pattern for `sales_orders` (`total = GREATEST(subtotal - discount,0)`) and `purchase_orders.total = SUM(purchase_order_items.line_total)`. `invoice_items.amount` and `invoices.balance` are generated columns; never write them.

### 4.4 Payment sync (after every payment insert/update/delete on an invoice)
```sql
UPDATE invoices i SET
  paid_amount = (SELECT COALESCE(SUM(amount),0) FROM payments WHERE invoice_id = i.id),
  status = CASE WHEN (SELECT COALESCE(SUM(amount),0) FROM payments WHERE invoice_id = i.id) >= i.total AND i.total > 0 THEN 'paid'
                WHEN (SELECT COALESCE(SUM(amount),0) FROM payments WHERE invoice_id = i.id) > 0 THEN 'partial'
                ELSE 'due' END
WHERE i.id = :id AND i.status IN ('due','partial','paid');
```
A payment is rejected (409) if the invoice is `draft` or `cancelled`, or if `amount > balance`.

### 4.5 Confirm invoice (`POST /invoices/{id}/confirm`, staff+)
1. `SELECT … FROM invoices WHERE id=:id FOR UPDATE`; must be `draft`, must have ≥1 item.
2. For each item with `variant_id` (ascending variant id): lock variant (4.2), if `on_hand < quantity` → **409 `STOCK_SHORT`** with message `Insufficient stock for "<description>": available X, needed Y`.
3. Insert `sale_out` movement with `-quantity`, `reference_type='invoice'`, `reference_id=invoice id`, copy `buyer_ref`, `style_no`, `batch_no`, note `Invoice <no>`.
4. Set `due_date = COALESCE(due_date, invoice_date + customer.credit_days)`.
5. `paid_amount` = sum of existing payments on it (normally 0); status by 4.4 rule (`due` if none).
6. If `order_id` is set: `UPDATE sales_orders SET status='invoiced'`.
7. Credit limit is a **warning only** (returned in the response as `warnings[]`), never a block.

The invoice number (`INV-0001`) is assigned when the **draft is created** (`POST /invoices`), so the printed draft already shows it. Numbers are never reused.

### 4.6 Cancel invoice (`/cancel`, manager+)
Lock invoice; reject if already cancelled or if any payment exists (**409 `HAS_PAYMENTS`**: "Invoice has payments. Remove or reassign them first"). If status ≠ `draft`, insert `cancel_reverse` movements (`+quantity`) for each item. Set status `cancelled`, append `Cancelled: <reason>` to notes.

### 4.7 Sales return (`/invoice-items/{id}/return`, manager+)
Invoice must be confirmed (not draft/cancelled). Already returned = `SUM(quantity)` of `sale_return_in` movements with `reference_type='invoice_return'` and `reference_id=item id`. Reject if `qty <= 0` or `qty + returned > item.quantity`. Insert `sale_return_in` (+qty). Insert a `payments` row: `method='credit_note'`, `amount = ROUND(qty * rate * (1 - discount_percent/100), 2)`, receipt number (4.1), then run 4.4.

### 4.8 Convert order → invoice (`/orders/{id}/convert`)
Order must not be `invoiced`/`cancelled`. Insert draft invoice (customer, order_id, buyer_ref, po_no, style_no, discount, `tax_rate = company_settings.tax_enabled ? tax_rate : 0`, notes), copy items, run 4.3, return the new id. Order becomes `invoiced` only when that invoice is confirmed (4.5).

### 4.9 Opening stock & adjustment (manager+)
- Opening: quantity > 0; insert `opening` movement; if `cost` given upsert `variant_costs` (`INSERT … ON DUPLICATE KEY UPDATE purchase_price = VALUES(purchase_price)`).
- Adjust: quantity ≠ 0, reason required; lock variant; if `qty < 0` and `on_hand + qty < 0` → 409 "Adjustment would make stock negative"; insert `adjustment_in`/`adjustment_out`.

### 4.10 Receive purchase (`/purchase-items/{id}/receive`, staff+)
Lock item then PO; PO must be `ordered` or `partial` (else 409). `quantity > 0` and `qty_received + quantity <= qty_ordered` else 409 `Invalid quantity: pending is N`. `UPDATE purchase_order_items SET qty_received = qty_received + :q`. Insert `purchase_in` movement (`reference_type='purchase_order'`, `reference_id=po id`, batch_no, note). Count open lines; PO status = `received` if none open else `partial`. Staff response must not contain rates or values.

### 4.11 Purchase return (manager+)
`0 < quantity <= qty_received` and `on_hand >= quantity`. Decrease `qty_received`, insert `purchase_return_out` (−qty). If PO was `received` set `partial`.

### 4.12 Balances (formulas — views already exist)
- Customer due = `opening_balance + SUM(confirmed invoices.total) − SUM(all payments)` → `v_customer_balance.due_balance`.
- Supplier payable = `opening_balance + SUM(received_value of non-cancelled POs) − SUM(supplier_payments)` → `v_supplier_balance.payable_balance`.
- Stock = `SUM(stock_movements.quantity)` → `v_stock_balance.qty_on_hand`; status `out` if ≤0, `low` if ≤ reorder_level.

### 4.13 Customer ledger (`GET /customers/{id}/ledger`)
```sql
SELECT invoice_date AS d, 'Invoice' AS t, invoice_no AS n, total AS debit, 0 AS credit, id, 0 AS ord
  FROM invoices WHERE customer_id = :c AND status IN ('due','partial','paid')
UNION ALL
SELECT payment_date, IF(method='credit_note','Credit note','Payment'), receipt_no, 0, amount, id, 1
  FROM payments WHERE customer_id = :c
ORDER BY d, ord, id;
```
Compute `running_balance` in PHP starting from `customers.opening_balance` (add debit, subtract credit). If `from` is set, start from the balance before `from`. Supplier ledger is built the same way (received POs = credit to supplier, payments = debit), starting from `suppliers.opening_balance`.

### 4.14 Dashboard & reports (SQL sketches)
```sql
-- sales today / yesterday
SELECT COALESCE(SUM(total),0) FROM invoices WHERE invoice_date = CURDATE() AND status IN ('due','partial','paid');
-- customer dues
SELECT COALESCE(SUM(balance),0), COUNT(*) FROM invoices WHERE status IN ('due','partial');
-- low stock count
SELECT COUNT(*) FROM v_stock_balance WHERE is_active = 1 AND stock_status IN ('low','out');
-- stock value (manager+ only)
SELECT COALESCE(SUM(b.qty_on_hand * COALESCE(c.purchase_price,0)),0)
  FROM v_stock_balance b LEFT JOIN variant_costs c ON c.variant_id = b.variant_id WHERE b.qty_on_hand > 0;
-- sales by day: generate the date list in PHP, LEFT JOIN results, fill zeros
-- profit (manager+)
SELECT SUM(subtotal - discount) AS sales FROM invoices WHERE status IN ('due','partial','paid') AND invoice_date BETWEEN :f AND :t;
SELECT SUM(it.quantity * COALESCE(vc.purchase_price,0)) AS cost
  FROM invoice_items it JOIN invoices i ON i.id = it.invoice_id AND i.status IN ('due','partial','paid')
  LEFT JOIN variant_costs vc ON vc.variant_id = it.variant_id WHERE i.invoice_date BETWEEN :f AND :t;
```

### 4.15 Invoice rules
- Draft invoices may be edited and deleted (manager+); any other status is read-only (409 `NOT_DRAFT`).
- Item `description` defaults to the variant display name; `rate` defaults to variant/product selling price but is editable.
- Reject duplicate submission: use an optional `Idempotency-Key` header on POST create/confirm/payment (store key+response hash in memory/table) — optional but recommended.

---

## 5. Roles & permissions summary

| Area | staff | manager | admin |
|---|:-:|:-:|:-:|
| Public data / enquiry submit | – | – | – (public) |
| Dashboard (no stock value for staff) | ✓ | ✓ | ✓ |
| Products, variants, categories, units — view (no costs) | ✓ | ✓ | ✓ |
| Products etc. — edit, costs, import | – | ✓ | ✓ |
| Stock overview, movements | ✓ | ✓ | ✓ |
| Opening stock, adjustment, stock value | – | ✓ | ✓ |
| Customers add/edit | ✓ | ✓ | ✓ |
| Orders, invoices (draft/confirm), payments (add), challans | ✓ | ✓ | ✓ |
| Cancel invoice, sales return, edit/delete payment, delete draft | – | ✓ | ✓ |
| Suppliers, purchase orders, supplier payments | – | ✓ | ✓ |
| Receive goods (pending list without prices) | ✓ | ✓ | ✓ |
| Purchase return | – | ✓ | ✓ |
| Reports: low stock, movements, dues | ✓ | ✓ | ✓ |
| Reports: stock value, sales, purchases, payables, profit | – | ✓ | ✓ |
| Enquiries | ✓ | ✓ | ✓ |
| Clients & certifications content | – | ✓ | ✓ |
| Settings, numbering, users, activity log | – | – | ✓ |

---

## 6. Endpoint catalogue


### Auth

| Method | Path | Role | What it does |
|---|---|:-:|---|
| POST | `/api/v1/auth/register` | P | Create account (email, password, full_name). First ever user becomes admin; later users get role NULL and see 'Waiting for approval'. Rate limited. |
| POST | `/api/v1/auth/login` | P | Email + password. Starts PHP session (HttpOnly, Secure, SameSite=Lax). Returns user and csrf_token. Throttled by login_attempts. |
| POST | `/api/v1/auth/logout` | S* | Destroy session. (* any logged-in user, even without role) |
| GET | `/api/v1/auth/me` | S* | Current user {id,email,full_name,role,is_active} + csrf_token. role may be null. |
| POST | `/api/v1/auth/forgot-password` | P | Email a reset link (token stored hashed in password_resets, 1 hour). Always answers 200. |
| POST | `/api/v1/auth/reset-password` | P | Token + new password. Bumps users.token_version. |
| POST | `/api/v1/auth/change-password` | S* | Current + new password. |

### Public

| Method | Path | Role | What it does |
|---|---|:-:|---|
| GET | `/api/v1/public/settings` | P | Company name, tagline, address, phones, emails, whatsapp, social urls, map_embed_url, logo_url. Never bank/BIN/TIN. |
| GET | `/api/v1/public/categories` | P | Active categories with product_count. |
| GET | `/api/v1/public/products` | P | Active + show_on_website products. Query: category, q (name/code), featured=1, page, per_page(<=48). Includes primary image and category. No prices. |
| GET | `/api/v1/public/products/{slug}` | P | Product + images + active variants (name,color,size,material,pack_size) + related. No prices, no costs. |
| GET | `/api/v1/public/clients` | P | Clients where is_active=1. |
| GET | `/api/v1/public/certifications` | P | Certifications where is_published=1 (empty by default). |
| POST | `/api/v1/public/enquiries` | P | multipart/form-data. Fields: name, company, phone, email, category_id, product_id, quantity, required_date, message, wants_sample, file (jpg/png/webp/pdf <=5MB), website (honeypot, must be empty). Rate limit 5/hour/IP. Stores file outside web root. |

### Dashboard

| Method | Path | Role | What it does |
|---|---|:-:|---|
| GET | `/api/v1/dashboard/summary` | S | sales_today, sales_yesterday, customer_dues, unpaid_invoices, low_stock_count, new_enquiries, variant_count, stock_value (manager+ only, else null). |
| GET | `/api/v1/dashboard/sales-by-day?days=7|30` | S | [{day,total}] with zero-filled days. |
| GET | `/api/v1/search?q=` | S | Global search: products/variants (code/name), customers (name/phone), invoices (number). Max 5 each. |

### Catalogue

| Method | Path | Role | What it does |
|---|---|:-:|---|
| GET | `/api/v1/categories` | S | All categories (incl. inactive). |
| POST | `/api/v1/categories` | M | Create. |
| PUT | `/api/v1/categories/{id}` | M | Update. |
| DELETE | `/api/v1/categories/{id}` | M | Delete only if it has no products, else 409. |
| GET | `/api/v1/units` | S | List units. |
| POST | `/api/v1/units` | M | Create/update unit (code unique). |
| GET | `/api/v1/products` | S | Admin list. Query: q, category_id, status(active|archived), page, per_page. Includes variant_count and total stock. |
| POST | `/api/v1/products` | M | Create product (slug auto from name if empty). |
| GET | `/api/v1/products/{id}` | S | Product + images + variants. purchase_price included only for manager+. |
| PUT | `/api/v1/products/{id}` | M | Update product fields (name, slug, code, category_id, unit_code, moq, descriptions, features[], specs{}, flags, seo). |
| DELETE | `/api/v1/products/{id}` | M | Archive (is_active=0). Hard delete only if the product has no stock movements and no document lines. |
| POST | `/api/v1/products/{id}/images` | M | multipart upload (jpg/png/webp <=5MB, re-encoded, max 1600px). Saved in /uploads/products/. |
| PUT | `/api/v1/products/{id}/images/order` | M | Body {ids:[...], primary_id}. |
| DELETE | `/api/v1/product-images/{id}` | M | Delete image row (and file if under /uploads). |
| POST | `/api/v1/products/{id}/variants` | M | Create variant. SKU auto = product code + suffix if empty. Optional purchase_price (writes variant_costs). |
| PUT | `/api/v1/variants/{id}` | M | Update variant (+ purchase_price). |
| DELETE | `/api/v1/variants/{id}` | M | Archive; hard delete only if no movements/lines. |
| GET | `/api/v1/variants/search?q=&in_stock=` | S | Line-item picker: id, sku, display name, unit, selling_price, qty_on_hand. NEVER cost. |
| POST | `/api/v1/products/import` | M | JSON rows [{product..., variants:[...]}] after client-side CSV/Excel parsing; validates all rows then inserts in one transaction; returns per-row errors. |

### Stock

| Method | Path | Role | What it does |
|---|---|:-:|---|
| GET | `/api/v1/stock` | S | v_stock_balance. Query: q, category_id, status(ok|low|out), page. Cost never included. |
| GET | `/api/v1/stock/{variantId}/movements` | S | Ledger rows with user name and document link (reference_type/id). Query: type, from, to, page. |
| GET | `/api/v1/stock/value` | M | Total and per-category stock value = SUM(qty * purchase_price). |
| POST | `/api/v1/stock/opening` | M | {variant_id, quantity>0, cost?, note?}. Inserts 'opening' movement, upserts variant_costs. |
| POST | `/api/v1/stock/adjust` | M | {variant_id, quantity (+/-, !=0), reason required}. Locks the variant's stock, rejects if result < 0. |

### Customers

| Method | Path | Role | What it does |
|---|---|:-:|---|
| GET | `/api/v1/customers` | S | Joins v_customer_balance. Query: q, type, has_due=1, page. |
| POST | `/api/v1/customers` | S | Create; code CUS-0001 from doc_counters. |
| GET | `/api/v1/customers/{id}` | S | Customer + balance + counts. |
| PUT | `/api/v1/customers/{id}` | S | Update. |
| DELETE | `/api/v1/customers/{id}` | M | Only if no documents, else archive (is_active=0). |
| GET | `/api/v1/customers/{id}/ledger?from=&to=` | S | Rows {date,type,doc_no,debit,credit,running_balance}; starts from opening_balance. |
| GET | `/api/v1/customers/dues` | S | v_invoice_aging (days_overdue), sorted by oldest. |

### Suppliers

| Method | Path | Role | What it does |
|---|---|:-:|---|
| GET | `/api/v1/suppliers` | M | Joins v_supplier_balance. |
| POST | `/api/v1/suppliers` | M | Create; code SUP-0001. |
| GET | `/api/v1/suppliers/{id}` | M | Supplier + balance + product ids. |
| PUT | `/api/v1/suppliers/{id}` | M | Update (+ product_ids[] sync into supplier_products). |
| DELETE | `/api/v1/suppliers/{id}` | M | Only if no documents, else archive. |
| GET | `/api/v1/suppliers/{id}/ledger?from=&to=` | M | Purchases received (credit) and payments (debit) with running payable. |
| POST | `/api/v1/suppliers/{id}/payments` | M | {payment_date, method, reference_no, amount>0, po_id?, note}. Voucher SV-0001. |
| GET | `/api/v1/supplier-payments/{id}` | M | Voucher for print. |

### Sales

| Method | Path | Role | What it does |
|---|---|:-:|---|
| GET | `/api/v1/orders` | S | Query: status, customer_id, from, to, q, page. |
| POST | `/api/v1/orders` | S | Header + items[]; totals computed by API. |
| GET | `/api/v1/orders/{id}` | S | Order + items + customer. |
| PUT | `/api/v1/orders/{id}` | S | Replace header+items while status is quotation/confirmed. |
| POST | `/api/v1/orders/{id}/status` | S | {status}. Allowed: quotation>confirmed>delivered, any>cancelled (manager+). |
| POST | `/api/v1/orders/{id}/convert` | S | Creates a draft invoice with copied items and references. Returns invoice id. |
| GET | `/api/v1/invoices` | S | Query: status, customer_id, from, to, q, page. |
| POST | `/api/v1/invoices` | S | Draft invoice header + items[]. API computes subtotal/tax/total. |
| GET | `/api/v1/invoices/{id}` | S | Invoice + items + payments + challans + customer + company print block (bank, BIN, footer). |
| PUT | `/api/v1/invoices/{id}` | S | Only while draft (409 otherwise). Replaces header and items. |
| DELETE | `/api/v1/invoices/{id}` | M | Delete a DRAFT invoice only. |
| POST | `/api/v1/invoices/{id}/confirm` | S | Transaction: lock invoice, check stock per line (message names the item), insert sale_out movements, set status due/partial/paid, due_date = date + credit_days, mark linked order invoiced. |
| POST | `/api/v1/invoices/{id}/cancel` | M | {reason}. Blocked if payments exist. Inserts cancel_reverse movements for confirmed invoices. |
| POST | `/api/v1/invoice-items/{id}/return` | M | {quantity, note}. Stock back in + credit_note payment for the line value. |
| POST | `/api/v1/invoices/{id}/payments` | S | {payment_date, method, reference_no, amount (<= balance), note}. Receipt RC-0001; resyncs invoice paid/status. |
| GET | `/api/v1/payments` | S | Query: customer_id, from, to, method, page. |
| GET | `/api/v1/payments/{id}` | S | Receipt for print. |
| PUT | `/api/v1/payments/{id}` | M | Edit (resync invoice). |
| DELETE | `/api/v1/payments/{id}` | M | Delete (resync invoice). |
| POST | `/api/v1/invoices/{id}/challans` | S | {challan_date, vehicle_no, driver_name, received_by, note}. CH-0001. |
| GET | `/api/v1/challans/{id}` | S | Challan + invoice lines WITHOUT prices. |

### Purchases

| Method | Path | Role | What it does |
|---|---|:-:|---|
| GET | `/api/v1/purchases` | M | Query: status, supplier_id, from, to, page. |
| POST | `/api/v1/purchases` | M | Header + items[{variant_id,qty_ordered,rate}]. PO-0001. |
| GET | `/api/v1/purchases/{id}` | M | PO + items + supplier + payments. |
| PUT | `/api/v1/purchases/{id}` | M | Only draft/ordered with nothing received. |
| POST | `/api/v1/purchases/{id}/status` | M | {status}: draft>ordered, any>cancelled (if nothing received). |
| GET | `/api/v1/receiving/pending` | S | v_pending_receipts (NO prices). Visible to all roles. |
| POST | `/api/v1/purchase-items/{id}/receive` | S | {quantity <= pending, batch_no?, note?}. Updates qty_received, inserts purchase_in movement, sets PO partial/received. |
| POST | `/api/v1/purchase-items/{id}/return` | M | {quantity <= received, note}. purchase_return_out movement; reduces qty_received. |
| GET | `/api/v1/purchases/reorder-suggestions` | M | Low/out variants with last purchase rate (v_last_purchase_rate). |

### Reports

| Method | Path | Role | What it does |
|---|---|:-:|---|
| GET | `/api/v1/reports/stock` | M | Qty and value by product/category. |
| GET | `/api/v1/reports/low-stock` | S | Low and out of stock. |
| GET | `/api/v1/reports/movements?from=&to=&variant_id=&type=` | S | Stock movement report. |
| GET | `/api/v1/reports/sales?from=&to=&group=day|customer|product` | M | Confirmed invoices only. |
| GET | `/api/v1/reports/purchases?from=&to=&group=day|supplier|product` | M | Received value. |
| GET | `/api/v1/reports/dues` | S | Customer dues + aging buckets (0-30, 31-60, 61-90, 90+). |
| GET | `/api/v1/reports/payables` | M | Supplier payable. |
| GET | `/api/v1/reports/profit?from=&to=` | M | {sales, cost, profit}; sales = SUM(subtotal - discount) of confirmed invoices; cost = SUM(qty * current purchase_price). |

### Enquiries

| Method | Path | Role | What it does |
|---|---|:-:|---|
| GET | `/api/v1/enquiries` | S | Query: status, q, page. |
| GET | `/api/v1/enquiries/{id}` | S | Detail. |
| PUT | `/api/v1/enquiries/{id}` | S | Update status and internal_note. |
| GET | `/api/v1/enquiries/{id}/attachment` | S | Streams the private file after auth check. |
| POST | `/api/v1/enquiries/{id}/convert` | S | Creates a quotation (customer_id or new customer payload), sets enquiry converted_order_id and status quoted. |

### Content

| Method | Path | Role | What it does |
|---|---|:-:|---|
| GET | `/api/v1/clients` | M | All clients. |
| POST | `/api/v1/clients` | M | Create (logo upload multipart or url). |
| PUT | `/api/v1/clients/{id}` | M | Update incl. is_active, permission_confirmed, sort_order. |
| DELETE | `/api/v1/clients/{id}` | M | Delete. |
| GET | `/api/v1/certifications` | M | All certifications. |
| POST | `/api/v1/certifications` | M | Create. |
| PUT | `/api/v1/certifications/{id}` | M | Update incl. is_published. |
| DELETE | `/api/v1/certifications/{id}` | M | Delete. |

### Settings

| Method | Path | Role | What it does |
|---|---|:-:|---|
| GET | `/api/v1/settings` | M | Full company_settings (incl. bank, BIN, TIN). |
| PUT | `/api/v1/settings` | A | Update company_settings. |
| GET | `/api/v1/settings/numbering` | A | doc_counters. |
| PUT | `/api/v1/settings/numbering` | A | Update prefix/padding (never lower last_number). |
| POST | `/api/v1/settings/logo` | A | Upload company logo. |
| GET | `/api/v1/users` | A | List users with roles. |
| POST | `/api/v1/users` | A | Create user with role (invite-only mode). |
| PUT | `/api/v1/users/{id}` | A | Set role (admin|manager|staff|null), is_active, full_name; bumps token_version when deactivated. Cannot remove the last admin. |
| POST | `/api/v1/users/{id}/reset-password` | A | Set a temporary password. |
| GET | `/api/v1/activity-log` | A | Query: table, user_id, action, from, to, page. |

Role key: **P** = public · **S*** = any logged-in user (role may be empty) · **S** = staff, manager, admin · **M** = manager, admin · **A** = admin only

Total endpoints: 117.

Request/response field names use the column names in `NRE_mysql_schema.sql` (snake_case). List endpoints return the joined display fields the screens need (e.g. `customer_name` on invoices). Nested documents (`invoices/{id}`) return `items[]`, `payments[]`, `challans[]`.

---

## 7. Local development

1. Install PHP 8.1+ and MariaDB 10.6+ / MySQL 8 locally (or Docker).
2. `mysql -e "CREATE DATABASE nre CHARACTER SET utf8mb4"`; import `NRE_mysql_schema.sql` then `NRE_mysql_seed.sql`.
3. Copy `config.sample.php` to `config.php`; point to the local DB.
4. Serve: `php -S 127.0.0.1:8000 -t public_html public_html/router.php` (a tiny dev router that sends `/api/*` to `api/index.php`, other paths to files).
5. Frontend: `npm run dev` with Vite proxy `/api` → `http://127.0.0.1:8000`.
6. First registered user becomes admin. Create manager/staff users from Settings → Users.

---

## 8. cPanel deployment (production)

1. **PHP:** cPanel → MultiPHP Manager → PHP 8.1 or newer. Enable extensions: `pdo_mysql, mbstring, gd, fileinfo, intl` (Select PHP Version).
2. **Database:** cPanel → MySQL® Database Wizard → create DB + user with ALL PRIVILEGES. Note full names (`cpuser_nre`, `cpuser_nreapp`).
3. **Import:** phpMyAdmin → select the DB → Import `NRE_mysql_schema.sql`, then `NRE_mysql_seed.sql`. If the file is large raise limits or split.
4. **Backend:** File Manager → upload `nre_backend.zip` to `/home/<cpuser>/` and extract so `nre_backend/` sits next to `public_html/`. Copy `config.sample.php` → `config.php`, fill DB credentials, `APP_URL`, a random `APP_KEY`. `chmod 640 config.php`, `chmod 750 storage storage/*`.
5. **API entry:** upload `public_html/api/` (index.php + .htaccess) and `public_html/uploads/` (+ .htaccess).
6. **Frontend:** `npm run build` (Lovable/GitHub export) → upload everything inside `dist/` into `public_html/`, plus `assets/` photo folders and root `.htaccess`.
7. **SSL:** cPanel → SSL/TLS Status → run AutoSSL. Then confirm HTTPS redirect works.
8. **Cron (backup):** cPanel → Cron Jobs, daily 02:30 Dhaka:
   `/usr/bin/mysqldump --single-transaction -u CPUSER_nreapp -p'PASSWORD' CPUSER_nre | gzip > /home/CPUSER/backups/nre_$(date +\%F).sql.gz && find /home/CPUSER/backups -name 'nre_*.sql.gz' -mtime +14 -delete`
   (store credentials in `~/.my.cnf` instead of the command line if possible).
9. **Smoke test:** open `/api/v1/public/settings` (JSON), the home page, register the first user (becomes admin), then create a staff user and check the role matrix (PRD section 12).
10. **After first admin exists:** set `ALLOW_REGISTRATION=false` in `config.php` (invite-only via Settings → Users).

Updating later: upload new `dist/` files (and changed backend files). DB changes ship as numbered `.sql` migration files (`migrations/2026_12_01_add_x.sql`) imported by phpMyAdmin; never edit the live schema by hand.

---

## 9. Backend tests (Claude Code must write and run these)

Plain PHP test script or PHPUnit against a throwaway database created from the two SQL files. Minimum cases (map to PRD section 12):

1. First registered user is admin; second has no role and gets 403 on `/dashboard/summary`.
2. Doc numbers increment without duplicates under 20 parallel inserts.
3. Opening stock 50 → confirm invoice of 30 → on hand 20; confirm of 25 more fails with `STOCK_SHORT` and changes nothing.
4. Payment 10,000 on invoice total 25,440 → status `partial`, balance 15,440; payment above balance → 409.
5. Return 5 → stock +5, credit_note payment created, balance reduced.
6. Cancel with payments → 409; cancel without payments → stock restored, status `cancelled`.
7. PO 20: receive 8 then 12 → stock +8, +12; status `partial` then `received`; receiving 1 more → 409; supplier payable equals 20 × rate.
8. Staff token: `/stock`, `/variants/search`, `/receiving/pending`, `/orders` responses contain **no** `purchase_price`, `cost`, `rate` from POs; `/purchases`, `/suppliers`, `/reports/profit` → 403.
9. Anonymous: `/public/*` works; every other route → 401; `POST /public/enquiries` with honeypot filled stores nothing.
10. Public product list returns only `is_active=1 AND show_on_website=1`; no price fields.
11. SQL injection probes (`' OR 1=1 --`) in `q`, `sort`, ids return 422/empty, never a 500.
12. Upload of a `.php` renamed to `.jpg` is rejected.
