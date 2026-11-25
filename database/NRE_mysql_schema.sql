-- =====================================================================
-- NR ENTERPRISE — MySQL / MariaDB schema  (cPanel-safe)
-- Import with phpMyAdmin (Import tab) into an EMPTY database, then import NRE_mysql_seed.sql.
--
-- Compatible with: MySQL 5.7+/8.x and MariaDB 10.3+ (InnoDB, utf8mb4).
-- cPanel-safe: NO triggers, NO stored procedures/functions, NO DEFINER, NO CREATE DATABASE.
-- All business logic (numbering, totals, stock posting, permissions) lives in the PHP API
-- (see NRE_PRD.md section 8 and NRE_BACKEND_API.md). The browser never talks to MySQL.
--
-- Rules the API must follow (the database cannot enforce them without triggers):
--   * stock_movements is an append-only ledger. Only the StockService inserts rows. Never UPDATE/DELETE.
--   * Stock on hand = SUM(stock_movements.quantity) per variant (see v_stock_balance).
--   * Every multi-table write runs inside ONE transaction (START TRANSACTION ... COMMIT).
--   * Document numbers come from doc_counters using an atomic UPDATE ... LAST_INSERT_ID() (see API doc).
--   * invoices.subtotal / tax_amount / total / paid_amount / status are written only by InvoiceService.
--   * variant_costs (purchase price) is returned only to manager/admin roles.
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- 1. USERS & AUTH
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email          VARCHAR(190) NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,                      -- password_hash(PASSWORD_ARGON2ID or BCRYPT)
  full_name      VARCHAR(160) NOT NULL,
  phone          VARCHAR(30) NULL,
  role           ENUM('admin','manager','staff') NULL,       -- NULL = waiting for approval
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  token_version  INT NOT NULL DEFAULT 0,                     -- bump to log a user out everywhere
  last_login_at  DATETIME NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS password_resets (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NOT NULL,
  token_hash  CHAR(64) NOT NULL,                             -- sha256 of the emailed token
  expires_at  DATETIME NOT NULL,
  used_at     DATETIME NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pr_user (user_id),
  KEY idx_pr_token (token_hash),
  CONSTRAINT fk_pr_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (                  -- simple brute-force throttle
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email       VARCHAR(190) NOT NULL,
  ip_address  VARCHAR(45) NOT NULL,
  succeeded   TINYINT(1) NOT NULL DEFAULT 0,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_la_email_time (email, created_at),
  KEY idx_la_ip_time (ip_address, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. COMPANY SETTINGS + DOCUMENT NUMBERING
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_settings (
  id               TINYINT UNSIGNED NOT NULL DEFAULT 1,      -- singleton row
  company_name     VARCHAR(160) NOT NULL DEFAULT 'NR Enterprise',
  tagline          VARCHAR(190) NULL DEFAULT 'All Kinds of Garments Accessories',
  address          TEXT NULL,
  phones           JSON NULL,                                -- ["+8801...", "..."]
  emails           JSON NULL,
  whatsapp         VARCHAR(30) NULL,
  facebook_url     VARCHAR(255) NULL,
  youtube_url      VARCHAR(255) NULL,
  website_url      VARCHAR(255) NULL,
  bin_number       VARCHAR(60) NULL,                         -- VAT BIN printed on invoices when set
  tin_number       VARCHAR(60) NULL,
  trade_license_no VARCHAR(80) NULL,
  logo_url         VARCHAR(255) NULL,
  currency         VARCHAR(8) NOT NULL DEFAULT 'BDT',
  tax_enabled      TINYINT(1) NOT NULL DEFAULT 0,
  tax_rate         DECIMAL(5,2) NOT NULL DEFAULT 0,
  invoice_footer   TEXT NULL,
  bank_details     TEXT NULL,
  map_embed_url    TEXT NULL,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_company_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS doc_counters (
  doc_type     VARCHAR(30) NOT NULL,                         -- invoice, order, challan, receipt, purchase, voucher, customer, supplier
  prefix       VARCHAR(12) NOT NULL,
  last_number  BIGINT UNSIGNED NOT NULL DEFAULT 0,
  padding      TINYINT UNSIGNED NOT NULL DEFAULT 4,
  PRIMARY KEY (doc_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. CATALOGUE
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS units (
  code          VARCHAR(20) NOT NULL,                        -- pcs, dozen, gross, roll, cone, kg, yard, metre, thousand
  name          VARCHAR(60) NOT NULL,
  pcs_per_unit  DECIMAL(12,3) NULL,
  PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  parent_id    BIGINT UNSIGNED NULL,
  slug         VARCHAR(120) NOT NULL,
  name         VARCHAR(160) NOT NULL,
  description  TEXT NULL,
  image_url    VARCHAR(255) NULL,
  sort_order   INT NOT NULL DEFAULT 0,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug),
  CONSTRAINT fk_cat_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id        BIGINT UNSIGNED NOT NULL,
  slug               VARCHAR(160) NOT NULL,
  name               VARCHAR(200) NOT NULL,
  code               VARCHAR(30) NULL,                        -- SKU prefix
  short_description  VARCHAR(500) NULL,
  description        TEXT NULL,
  features           JSON NULL,                               -- ["...", "..."]
  specs              JSON NULL,                               -- category-specific spec fields / options
  unit_code          VARCHAR(20) NULL,
  moq                DECIMAL(14,3) NULL,
  selling_price      DECIMAL(14,2) NULL,                      -- default selling price (optional, never shown publicly)
  is_active          TINYINT(1) NOT NULL DEFAULT 1,
  show_on_website    TINYINT(1) NOT NULL DEFAULT 1,
  is_featured        TINYINT(1) NOT NULL DEFAULT 0,
  sort_order         INT NOT NULL DEFAULT 0,
  seo_title          VARCHAR(190) NULL,
  seo_description    VARCHAR(300) NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_slug (slug),
  UNIQUE KEY uq_products_code (code),
  KEY idx_products_category (category_id),
  KEY idx_products_public (is_active, show_on_website, sort_order),
  CONSTRAINT fk_prod_cat  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
  CONSTRAINT fk_prod_unit FOREIGN KEY (unit_code)   REFERENCES units(code)    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS product_images (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id  BIGINT UNSIGNED NOT NULL,
  url         VARCHAR(255) NOT NULL,                          -- /assets/products/... (seed) or /uploads/products/... (admin upload)
  alt         VARCHAR(200) NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  is_primary  TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_pi_product (product_id, sort_order),
  CONSTRAINT fk_pi_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Stock is counted per variant (colour / width / size / pack)
CREATE TABLE IF NOT EXISTS product_variants (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id     BIGINT UNSIGNED NOT NULL,
  sku            VARCHAR(60) NOT NULL,
  name           VARCHAR(200) NULL,                           -- e.g. "20 mm - White"
  color          VARCHAR(60) NULL,
  size           VARCHAR(60) NULL,
  material       VARCHAR(80) NULL,
  pack_size      VARCHAR(60) NULL,
  attributes     JSON NULL,
  selling_price  DECIMAL(14,2) NULL,                          -- overrides product price when set
  reorder_level  DECIMAL(14,3) NOT NULL DEFAULT 0,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_variants_sku (sku),
  KEY idx_variants_product (product_id),
  CONSTRAINT fk_var_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Purchase cost kept apart so staff endpoints never join it
CREATE TABLE IF NOT EXISTS variant_costs (
  variant_id      BIGINT UNSIGNED NOT NULL,
  purchase_price  DECIMAL(14,2) NOT NULL DEFAULT 0,
  updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (variant_id),
  CONSTRAINT fk_vc_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. CUSTOMERS & SUPPLIERS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code              VARCHAR(20) NULL,                         -- CUS-0001 (set by API)
  name              VARCHAR(200) NOT NULL,
  contact_person    VARCHAR(160) NULL,
  phone             VARCHAR(30) NULL,
  whatsapp          VARCHAR(30) NULL,
  email             VARCHAR(190) NULL,
  address           TEXT NULL,
  delivery_address  TEXT NULL,
  bin_number        VARCHAR(60) NULL,
  area              VARCHAR(120) NULL,
  customer_type     ENUM('factory','buying_house','brand','retail','other') NOT NULL DEFAULT 'factory',
  credit_days       INT NOT NULL DEFAULT 0,
  credit_limit      DECIMAL(14,2) NOT NULL DEFAULT 0,
  opening_balance   DECIMAL(14,2) NOT NULL DEFAULT 0,          -- existing due before system start
  buyers_served     VARCHAR(255) NULL,
  notes             TEXT NULL,
  is_active         TINYINT(1) NOT NULL DEFAULT 1,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_code (code),
  KEY idx_customers_name (name),
  KEY idx_customers_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS suppliers (
  id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code             VARCHAR(20) NULL,                          -- SUP-0001 (set by API)
  name             VARCHAR(200) NOT NULL,
  contact_person   VARCHAR(160) NULL,
  phone            VARCHAR(30) NULL,
  email            VARCHAR(190) NULL,
  address          TEXT NULL,
  payment_terms    VARCHAR(190) NULL,
  opening_balance  DECIMAL(14,2) NOT NULL DEFAULT 0,          -- existing payable before system start
  notes            TEXT NULL,
  is_active        TINYINT(1) NOT NULL DEFAULT 1,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_suppliers_code (code),
  KEY idx_suppliers_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS supplier_products (
  supplier_id  BIGINT UNSIGNED NOT NULL,
  product_id   BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (supplier_id, product_id),
  CONSTRAINT fk_sp_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  CONSTRAINT fk_sp_product  FOREIGN KEY (product_id)  REFERENCES products(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. STOCK LEDGER (append-only; written only by StockService)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  variant_id      BIGINT UNSIGNED NOT NULL,
  movement_type   ENUM('opening','purchase_in','sale_out','sale_return_in','purchase_return_out',
                       'adjustment_in','adjustment_out','cancel_reverse') NOT NULL,
  quantity        DECIMAL(14,3) NOT NULL,                      -- signed: + in, - out (never 0, enforced by API)
  reference_type  VARCHAR(30) NULL,                            -- invoice | invoice_return | purchase_order | adjustment | opening
  reference_id    BIGINT UNSIGNED NULL,
  buyer_ref       VARCHAR(160) NULL,
  style_no        VARCHAR(80) NULL,
  batch_no        VARCHAR(80) NULL,
  note            VARCHAR(500) NULL,
  created_by      BIGINT UNSIGNED NULL,
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sm_variant (variant_id, created_at),
  KEY idx_sm_ref (reference_type, reference_id),
  CONSTRAINT fk_sm_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
  CONSTRAINT fk_sm_user    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_sm_qty CHECK (quantity <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. SALES: ORDERS, INVOICES, CHALLANS, PAYMENTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sales_orders (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_no       VARCHAR(20) NULL,
  customer_id    BIGINT UNSIGNED NOT NULL,
  order_date     DATE NOT NULL,
  delivery_date  DATE NULL,
  status         ENUM('quotation','confirmed','delivered','invoiced','cancelled') NOT NULL DEFAULT 'quotation',
  buyer_ref      VARCHAR(160) NULL,
  po_no          VARCHAR(80) NULL,
  style_no       VARCHAR(80) NULL,
  subtotal       DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount       DECIMAL(14,2) NOT NULL DEFAULT 0,
  total          DECIMAL(14,2) NOT NULL DEFAULT 0,
  notes          TEXT NULL,
  enquiry_id     BIGINT UNSIGNED NULL,                         -- set when created from a website enquiry
  created_by     BIGINT UNSIGNED NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_so_no (order_no),
  KEY idx_so_customer (customer_id),
  KEY idx_so_status (status),
  CONSTRAINT fk_so_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_so_user     FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sales_order_items (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id          BIGINT UNSIGNED NOT NULL,
  variant_id        BIGINT UNSIGNED NULL,
  description       VARCHAR(400) NOT NULL,
  unit_code         VARCHAR(20) NULL,
  quantity          DECIMAL(14,3) NOT NULL,
  rate              DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_percent  DECIMAL(5,2) NOT NULL DEFAULT 0,
  amount            DECIMAL(14,2) AS (ROUND(quantity * rate * (1 - discount_percent / 100), 2)) STORED,
  sort_order        INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_soi_order (order_id),
  CONSTRAINT fk_soi_order   FOREIGN KEY (order_id)   REFERENCES sales_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_soi_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
  CONSTRAINT chk_soi_qty  CHECK (quantity > 0),
  CONSTRAINT chk_soi_rate CHECK (rate >= 0),
  CONSTRAINT chk_soi_disc CHECK (discount_percent BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_no    VARCHAR(20) NULL,
  customer_id   BIGINT UNSIGNED NOT NULL,
  order_id      BIGINT UNSIGNED NULL,
  invoice_date  DATE NOT NULL,
  due_date      DATE NULL,
  status        ENUM('draft','due','partial','paid','cancelled') NOT NULL DEFAULT 'draft',
  buyer_ref     VARCHAR(160) NULL,
  po_no         VARCHAR(80) NULL,
  style_no      VARCHAR(80) NULL,
  subtotal      DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  tax_rate      DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_amount    DECIMAL(14,2) NOT NULL DEFAULT 0,
  total         DECIMAL(14,2) NOT NULL DEFAULT 0,
  paid_amount   DECIMAL(14,2) NOT NULL DEFAULT 0,
  balance       DECIMAL(14,2) AS (total - paid_amount) STORED,
  notes         TEXT NULL,
  created_by    BIGINT UNSIGNED NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_inv_no (invoice_no),
  KEY idx_inv_customer (customer_id),
  KEY idx_inv_status_date (status, invoice_date),
  CONSTRAINT fk_inv_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_inv_order    FOREIGN KEY (order_id)    REFERENCES sales_orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_inv_user     FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_items (
  id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id        BIGINT UNSIGNED NOT NULL,
  variant_id        BIGINT UNSIGNED NULL,
  description       VARCHAR(400) NOT NULL,
  unit_code         VARCHAR(20) NULL,
  quantity          DECIMAL(14,3) NOT NULL,
  rate              DECIMAL(14,2) NOT NULL DEFAULT 0,
  discount_percent  DECIMAL(5,2) NOT NULL DEFAULT 0,
  amount            DECIMAL(14,2) AS (ROUND(quantity * rate * (1 - discount_percent / 100), 2)) STORED,
  batch_no          VARCHAR(80) NULL,
  sort_order        INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_ii_invoice (invoice_id),
  CONSTRAINT fk_ii_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_ii_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
  CONSTRAINT chk_ii_qty  CHECK (quantity > 0),
  CONSTRAINT chk_ii_rate CHECK (rate >= 0),
  CONSTRAINT chk_ii_disc CHECK (discount_percent BETWEEN 0 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_challans (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  challan_no    VARCHAR(20) NULL,
  invoice_id    BIGINT UNSIGNED NOT NULL,
  challan_date  DATE NOT NULL,
  vehicle_no    VARCHAR(60) NULL,
  driver_name   VARCHAR(120) NULL,
  received_by   VARCHAR(120) NULL,
  note          VARCHAR(500) NULL,
  created_by    BIGINT UNSIGNED NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ch_no (challan_no),
  KEY idx_ch_invoice (invoice_id),
  CONSTRAINT fk_ch_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  CONSTRAINT fk_ch_user    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  receipt_no    VARCHAR(20) NULL,
  customer_id   BIGINT UNSIGNED NOT NULL,
  invoice_id    BIGINT UNSIGNED NULL,                           -- NULL = on-account / advance
  payment_date  DATE NOT NULL,
  method        ENUM('cash','bkash','nagad','bank','cheque','credit_note','other') NOT NULL DEFAULT 'cash',
  reference_no  VARCHAR(80) NULL,
  amount        DECIMAL(14,2) NOT NULL,
  note          VARCHAR(500) NULL,
  created_by    BIGINT UNSIGNED NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pay_receipt (receipt_no),
  KEY idx_pay_customer (customer_id),
  KEY idx_pay_invoice (invoice_id),
  CONSTRAINT fk_pay_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pay_invoice  FOREIGN KEY (invoice_id)  REFERENCES invoices(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_pay_user     FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_pay_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7. PURCHASES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS purchase_orders (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  po_no          VARCHAR(20) NULL,
  supplier_id    BIGINT UNSIGNED NOT NULL,
  order_date     DATE NOT NULL,
  expected_date  DATE NULL,
  status         ENUM('draft','ordered','partial','received','cancelled') NOT NULL DEFAULT 'draft',
  bill_no        VARCHAR(80) NULL,                              -- supplier bill number
  total          DECIMAL(14,2) NOT NULL DEFAULT 0,              -- ordered value (API recalculates)
  notes          TEXT NULL,
  created_by     BIGINT UNSIGNED NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_po_no (po_no),
  KEY idx_po_supplier (supplier_id),
  KEY idx_po_status (status),
  CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_po_user     FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  po_id           BIGINT UNSIGNED NOT NULL,
  variant_id      BIGINT UNSIGNED NOT NULL,
  qty_ordered     DECIMAL(14,3) NOT NULL,
  qty_received    DECIMAL(14,3) NOT NULL DEFAULT 0,
  rate            DECIMAL(14,2) NOT NULL DEFAULT 0,
  line_total      DECIMAL(14,2) AS (ROUND(qty_ordered * rate, 2)) STORED,
  received_value  DECIMAL(14,2) AS (ROUND(qty_received * rate, 2)) STORED,
  PRIMARY KEY (id),
  KEY idx_poi_po (po_id),
  KEY idx_poi_variant (variant_id),
  CONSTRAINT fk_poi_po      FOREIGN KEY (po_id)      REFERENCES purchase_orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_poi_variant FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE RESTRICT,
  CONSTRAINT chk_poi_ordered  CHECK (qty_ordered > 0),
  CONSTRAINT chk_poi_received CHECK (qty_received >= 0),
  CONSTRAINT chk_poi_rate     CHECK (rate >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS supplier_payments (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  voucher_no    VARCHAR(20) NULL,
  supplier_id   BIGINT UNSIGNED NOT NULL,
  po_id         BIGINT UNSIGNED NULL,
  payment_date  DATE NOT NULL,
  method        ENUM('cash','bkash','nagad','bank','cheque','credit_note','other') NOT NULL DEFAULT 'cash',
  reference_no  VARCHAR(80) NULL,
  amount        DECIMAL(14,2) NOT NULL,
  note          VARCHAR(500) NULL,
  created_by    BIGINT UNSIGNED NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sp_voucher (voucher_no),
  KEY idx_sp_supplier (supplier_id),
  CONSTRAINT fk_spay_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_spay_po       FOREIGN KEY (po_id)       REFERENCES purchase_orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_spay_user     FOREIGN KEY (created_by)  REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_spay_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 8. WEBSITE DATA: ENQUIRIES, CLIENTS, CERTIFICATIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enquiries (
  id                  BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                VARCHAR(120) NOT NULL,
  company             VARCHAR(160) NULL,
  phone               VARCHAR(30) NOT NULL,
  email               VARCHAR(160) NULL,
  category_id         BIGINT UNSIGNED NULL,
  product_id          BIGINT UNSIGNED NULL,
  quantity            VARCHAR(80) NULL,
  required_date       DATE NULL,
  message             VARCHAR(2000) NULL,
  attachment_path     VARCHAR(255) NULL,                         -- /storage-private/enquiries/... served only through the API
  wants_sample        TINYINT(1) NOT NULL DEFAULT 0,
  status              ENUM('new','contacted','quoted','won','lost') NOT NULL DEFAULT 'new',
  internal_note       TEXT NULL,
  converted_order_id  BIGINT UNSIGNED NULL,
  ip_address          VARCHAR(45) NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_enq_status (status, created_at),
  CONSTRAINT fk_enq_cat   FOREIGN KEY (category_id)        REFERENCES categories(id)   ON DELETE SET NULL,
  CONSTRAINT fk_enq_prod  FOREIGN KEY (product_id)         REFERENCES products(id)     ON DELETE SET NULL,
  CONSTRAINT fk_enq_order FOREIGN KEY (converted_order_id) REFERENCES sales_orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clients (
  id                    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name                  VARCHAR(160) NOT NULL,
  logo_url              VARCHAR(255) NOT NULL,
  website               VARCHAR(255) NULL,
  sort_order            INT NOT NULL DEFAULT 0,
  is_active             TINYINT(1) NOT NULL DEFAULT 1,           -- show on website
  permission_confirmed  TINYINT(1) NOT NULL DEFAULT 0,           -- NR confirmed it may show this logo
  created_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS certifications (
  id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name            VARCHAR(200) NOT NULL,
  description     VARCHAR(500) NULL,
  logo_url        VARCHAR(255) NULL,
  certificate_no  VARCHAR(80) NULL,
  sort_order      INT NOT NULL DEFAULT 0,
  is_published    TINYINT(1) NOT NULL DEFAULT 0,                 -- publish only after NR confirms it holds the certificate
  holder_confirmed TINYINT(1) NOT NULL DEFAULT 0,                -- admin ticks this once NR confirms it holds the certificate
  created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 9. AUDIT LOG (written by the API on every create/update/delete of key tables)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_log (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     BIGINT UNSIGNED NULL,
  table_name  VARCHAR(60) NOT NULL,
  action      VARCHAR(20) NOT NULL,                              -- INSERT | UPDATE | DELETE | CONFIRM | CANCEL ...
  record_id   VARCHAR(40) NULL,
  details     JSON NULL,
  ip_address  VARCHAR(45) NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_al_created (created_at),
  KEY idx_al_table (table_name, record_id),
  CONSTRAINT fk_al_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 10. VIEWS (read-only helpers; the API decides which roles may query which view)
--     No DEFINER clause so they import cleanly on shared hosting.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_stock_balance AS
SELECT v.id                         AS variant_id,
       p.id                         AS product_id,
       c.id                         AS category_id,
       c.name                       AS category_name,
       p.name                       AS product_name,
       v.sku                        AS sku,
       COALESCE(v.name, p.name)     AS variant_name,
       v.color                      AS color,
       v.size                       AS size,
       v.material                   AS material,
       p.unit_code                  AS unit_code,
       COALESCE(m.qty, 0)           AS qty_on_hand,
       v.reorder_level              AS reorder_level,
       CASE WHEN COALESCE(m.qty, 0) <= 0 THEN 'out'
            WHEN COALESCE(m.qty, 0) <= v.reorder_level THEN 'low'
            ELSE 'ok' END           AS stock_status,
       COALESCE(v.selling_price, p.selling_price) AS selling_price,
       v.is_active                  AS is_active
FROM product_variants v
JOIN products p   ON p.id = v.product_id
JOIN categories c ON c.id = p.category_id
LEFT JOIN (SELECT variant_id, SUM(quantity) AS qty FROM stock_movements GROUP BY variant_id) m
       ON m.variant_id = v.id;

CREATE OR REPLACE VIEW v_customer_balance AS
SELECT c.id AS customer_id, c.code, c.name, c.phone, c.area, c.customer_type, c.credit_limit, c.credit_days,
       c.opening_balance,
       COALESCE(s.total_sales, 0) AS total_sales,
       COALESCE(p.total_paid, 0)  AS total_paid,
       (c.opening_balance + COALESCE(s.total_sales, 0) - COALESCE(p.total_paid, 0)) AS due_balance,
       c.is_active
FROM customers c
LEFT JOIN (SELECT customer_id, SUM(total) AS total_sales FROM invoices
            WHERE status IN ('due','partial','paid') GROUP BY customer_id) s ON s.customer_id = c.id
LEFT JOIN (SELECT customer_id, SUM(amount) AS total_paid FROM payments GROUP BY customer_id) p ON p.customer_id = c.id;

CREATE OR REPLACE VIEW v_invoice_aging AS
SELECT i.id AS invoice_id, i.invoice_no, i.customer_id, c.name AS customer_name, i.invoice_date, i.due_date,
       i.total, i.paid_amount, i.balance, i.status,
       GREATEST(DATEDIFF(CURDATE(), COALESCE(i.due_date, i.invoice_date)), 0) AS days_overdue
FROM invoices i JOIN customers c ON c.id = i.customer_id
WHERE i.status IN ('due','partial');

CREATE OR REPLACE VIEW v_supplier_balance AS
SELECT s.id AS supplier_id, s.code, s.name, s.phone, s.opening_balance,
       COALESCE(r.total_purchased, 0) AS total_purchased,
       COALESCE(p.total_paid, 0)      AS total_paid,
       (s.opening_balance + COALESCE(r.total_purchased, 0) - COALESCE(p.total_paid, 0)) AS payable_balance,
       s.is_active
FROM suppliers s
LEFT JOIN (SELECT po.supplier_id, SUM(i.received_value) AS total_purchased
             FROM purchase_orders po JOIN purchase_order_items i ON i.po_id = po.id
            WHERE po.status <> 'cancelled' GROUP BY po.supplier_id) r ON r.supplier_id = s.id
LEFT JOIN (SELECT supplier_id, SUM(amount) AS total_paid FROM supplier_payments GROUP BY supplier_id) p ON p.supplier_id = s.id;

CREATE OR REPLACE VIEW v_last_purchase_rate AS
SELECT x.variant_id, x.rate, x.order_date, x.supplier_id
FROM (SELECT i.variant_id, i.rate, po.order_date, po.supplier_id,
             ROW_NUMBER() OVER (PARTITION BY i.variant_id ORDER BY po.order_date DESC, po.id DESC) AS rn
        FROM purchase_order_items i JOIN purchase_orders po ON po.id = i.po_id
       WHERE po.status <> 'cancelled') x
WHERE x.rn = 1;

-- Staff-safe: no prices. The receiving screen for ALL staff reads this view only.
CREATE OR REPLACE VIEW v_pending_receipts AS
SELECT i.id AS po_item_id, po.id AS po_id, po.po_no, s.name AS supplier_name, po.expected_date,
       i.variant_id, v.sku, COALESCE(v.name, p.name) AS variant_name, p.unit_code,
       i.qty_ordered, i.qty_received, (i.qty_ordered - i.qty_received) AS qty_pending
FROM purchase_order_items i
JOIN purchase_orders po ON po.id = i.po_id
JOIN suppliers s ON s.id = po.supplier_id
JOIN product_variants v ON v.id = i.variant_id
JOIN products p ON p.id = v.product_id
WHERE po.status IN ('ordered','partial') AND i.qty_received < i.qty_ordered;

-- =====================================================================
-- END OF SCHEMA. Next: import NRE_mysql_seed.sql
-- =====================================================================
