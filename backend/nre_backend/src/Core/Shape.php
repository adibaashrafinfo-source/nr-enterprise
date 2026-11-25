<?php
declare(strict_types=1);

/** Maps DB rows to the exact JSON shapes the React frontend (src/lib/types.ts) expects, and its inputs to DB columns. */
final class Shape
{
    public static function dec(mixed $v, int $scale = 2): string { return number_format((float)($v ?? 0), $scale, '.', ''); }
    public static function nz(mixed $v): string { return $v === null ? '' : (string)$v; }
    public static function obj(mixed $v): mixed { if (is_string($v)) $v = json_decode($v, true); return is_array($v) && $v ? $v : new stdClass(); }
    public static function list(mixed $v): array { if (is_string($v)) $v = json_decode($v, true); return is_array($v) ? array_values($v) : []; }

    public static function company(): array
    {
        $s = Db::one('SELECT * FROM company_settings WHERE id=1') ?: [];
        return ['company_name' => $s['company_name'] ?? '', 'address' => self::nz($s['address'] ?? ''), 'phones' => $s['phones'] ?? '[]', 'emails' => $s['emails'] ?? '[]',
            'logo_url' => self::nz($s['logo_url'] ?? ''), 'bin' => $s['bin_number'] ?? null, 'bank_details' => $s['bank_details'] ?? null, 'footer' => $s['invoice_footer'] ?? null,
            'tax_enabled' => $s['tax_enabled'] ?? 0, 'tax_rate' => self::dec($s['tax_rate'] ?? 0), 'whatsapp' => $s['whatsapp'] ?? null];
    }
    public static function settings(array $s): array
    {
        return ['company_name' => $s['company_name'], 'tagline' => self::nz($s['tagline']), 'address' => self::nz($s['address']), 'phones' => $s['phones'] ?? '[]', 'emails' => $s['emails'] ?? '[]',
            'whatsapp' => $s['whatsapp'], 'facebook_url' => $s['facebook_url'], 'youtube_url' => $s['youtube_url'], 'website_url' => $s['website_url'], 'map_embed_url' => $s['map_embed_url'],
            'logo_url' => self::nz($s['logo_url']), 'bin' => $s['bin_number'], 'tin' => $s['tin_number'], 'trade_licence' => $s['trade_license_no'], 'bank_details' => $s['bank_details'],
            'invoice_footer' => $s['invoice_footer'], 'tax_enabled' => $s['tax_enabled'], 'tax_rate' => self::dec($s['tax_rate'])];
    }

    // ---- catalogue
    public const PRODUCT_SELECT = 'p.id, p.slug, p.name, p.code, p.short_description, p.unit_code, p.moq, p.is_featured, p.sort_order, p.show_on_website, p.is_active,
        c.id AS cat_id, c.slug AS cat_slug, c.name AS cat_name,
        (SELECT url FROM product_images i WHERE i.product_id=p.id ORDER BY i.is_primary DESC, i.sort_order, i.id LIMIT 1) AS primary_image';
    public static function productSummary(array $r): array
    {
        return ['id' => (int)$r['id'], 'slug' => $r['slug'], 'name' => $r['name'], 'code' => self::nz($r['code']), 'short_description' => self::nz($r['short_description']),
            'unit_code' => $r['unit_code'], 'moq' => self::dec($r['moq'], 3), 'is_featured' => $r['is_featured'], 'sort_order' => (int)$r['sort_order'], 'primary_image' => $r['primary_image'],
            'category' => ['id' => (int)$r['cat_id'], 'slug' => $r['cat_slug'], 'name' => $r['cat_name']]];
    }
    public static function images(int $productId): array
    {
        return array_map(fn($i) => ['id' => (int)$i['id'], 'url' => $i['url'], 'is_primary' => $i['is_primary'], 'sort_order' => (int)$i['sort_order']],
            Db::all('SELECT id, url, sort_order, is_primary FROM product_images WHERE product_id=? ORDER BY is_primary DESC, sort_order, id', [$productId]));
    }
    public static function category(array $c): array
    {
        $o = ['id' => (int)$c['id'], 'slug' => $c['slug'], 'name' => $c['name'], 'description' => self::nz($c['description']), 'image_url' => self::nz($c['image_url']), 'sort_order' => (int)$c['sort_order']];
        if (isset($c['product_count'])) $o['product_count'] = (int)$c['product_count'];
        if (array_key_exists('is_active', $c)) $o['is_active'] = $c['is_active'];
        return $o;
    }

    // ---- customers / suppliers
    public const CUSTOMER_SELECT = 'c.*, COALESCE(b.total_sales,0) AS total_sales, COALESCE(b.due_balance,0) AS due_balance,
        (SELECT COUNT(*) FROM invoices x WHERE x.customer_id=c.id AND x.status<>\'cancelled\') AS invoice_count, (SELECT COUNT(*) FROM sales_orders o WHERE o.customer_id=c.id) AS order_count';
    public static function customer(array $c): array
    {
        return ['id' => (int)$c['id'], 'code' => $c['code'], 'name' => $c['name'], 'contact_person' => $c['contact_person'], 'phone' => $c['phone'], 'whatsapp' => $c['whatsapp'], 'email' => $c['email'],
            'billing_address' => $c['address'], 'delivery_address' => $c['delivery_address'], 'area' => $c['area'], 'type' => $c['customer_type'], 'credit_days' => (int)$c['credit_days'],
            'credit_limit' => self::dec($c['credit_limit']), 'opening_balance' => self::dec($c['opening_balance']), 'buyers_served' => $c['buyers_served'], 'bin' => $c['bin_number'], 'notes' => $c['notes'],
            'is_active' => $c['is_active'], 'total_sales' => self::dec($c['total_sales'] ?? 0), 'due_balance' => self::dec($c['due_balance'] ?? 0), 'invoice_count' => (int)($c['invoice_count'] ?? 0), 'order_count' => (int)($c['order_count'] ?? 0)];
    }
    public static function customerById(int $id): array
    {
        return self::customer(needRow(Db::one('SELECT ' . self::CUSTOMER_SELECT . ' FROM customers c LEFT JOIN v_customer_balance b ON b.customer_id=c.id WHERE c.id=?', [$id]), 'Customer'));
    }
    public static function customerIn(array $b): array
    {
        foreach (['billing_address' => 'address', 'type' => 'customer_type', 'bin' => 'bin_number'] as $from => $to) if (array_key_exists($from, $b)) { $b[$to] = $b[$from]; unset($b[$from]); }
        return $b;
    }
    public static function supplierById(int $id): array
    {
        $s = needRow(Db::one('SELECT s.*, COALESCE(b.total_purchased,0) AS total_purchased, COALESCE(b.total_paid,0) AS paid, COALESCE(b.payable_balance,s.opening_balance) AS payable_balance FROM suppliers s LEFT JOIN v_supplier_balance b ON b.supplier_id=s.id WHERE s.id=?', [$id]), 'Supplier');
        return self::supplier($s);
    }
    public static function supplier(array $s): array
    {
        $ids = isset($s['product_ids']) ? $s['product_ids'] : array_map('intval', array_column(Db::all('SELECT product_id FROM supplier_products WHERE supplier_id=?', [$s['id']]), 'product_id'));
        return ['id' => (int)$s['id'], 'code' => $s['code'], 'name' => $s['name'], 'contact_person' => $s['contact_person'], 'phone' => $s['phone'], 'email' => $s['email'], 'address' => $s['address'],
            'payment_terms' => $s['payment_terms'], 'opening_balance' => self::dec($s['opening_balance']), 'notes' => $s['notes'], 'is_active' => $s['is_active'], 'product_ids' => $ids,
            'total_purchased' => self::dec($s['total_purchased'] ?? 0), 'paid' => self::dec($s['paid'] ?? 0), 'payable_balance' => self::dec($s['payable_balance'] ?? 0)];
    }

    // ---- stock
    public static function stockRow(array $r): array
    {
        return ['variant_id' => (int)$r['variant_id'], 'product_id' => (int)$r['product_id'], 'sku' => $r['sku'], 'display_name' => $r['variant_name'], 'product_name' => $r['product_name'],
            'category_id' => (int)$r['category_id'], 'category_name' => $r['category_name'], 'unit_code' => $r['unit_code'], 'qty_on_hand' => self::dec($r['qty_on_hand'], 3),
            'reorder_level' => self::dec($r['reorder_level'], 3), 'selling_price' => self::dec($r['selling_price'] ?? 0), 'status' => $r['stock_status']];
    }
    public static function stockRowById(int $variantId): array
    {
        return self::stockRow(needRow(Db::one('SELECT * FROM v_stock_balance WHERE variant_id=?', [$variantId]), 'Variant'));
    }
    public static function ledgerRow(array $r): array
    {
        $rt = in_array($r['reference_type'], ['invoice', 'purchase_order', 'invoice_item', 'invoice_return'], true) ? $r['reference_type'] : null;
        return ['id' => (int)$r['id'], 'variant_id' => (int)$r['variant_id'], 'type' => $r['movement_type'], 'quantity' => self::dec($r['quantity'], 3), 'reference_type' => $rt,
            'reference_id' => $rt && $r['reference_id'] !== null ? (int)$r['reference_id'] : null, 'buyer' => $r['buyer_ref'], 'style_no' => $r['style_no'], 'batch' => $r['batch_no'],
            'user_name' => self::nz($r['user_name'] ?? ''), 'note' => $r['note'], 'created_at' => $r['created_at']];
    }
    public static function ledgerById(int $id): array
    {
        return self::ledgerRow(needRow(Db::one('SELECT m.*, u.full_name AS user_name FROM stock_movements m LEFT JOIN users u ON u.id=m.created_by WHERE m.id=?', [$id]), 'Movement'));
    }

    // ---- sales
    public static function invoiceRow(array $i): array
    {
        return ['id' => (int)$i['id'], 'invoice_no' => $i['invoice_no'], 'invoice_date' => $i['invoice_date'], 'due_date' => $i['due_date'], 'customer_id' => (int)$i['customer_id'],
            'customer_name' => $i['customer_name'], 'status' => $i['status'], 'order_id' => $i['order_id'] !== null ? (int)$i['order_id'] : null, 'buyer_ref' => $i['buyer_ref'], 'po_no' => $i['po_no'],
            'style_no' => $i['style_no'], 'notes' => $i['notes'], 'subtotal' => self::dec($i['subtotal']), 'discount' => self::dec($i['discount']), 'tax_rate' => self::dec($i['tax_rate']),
            'tax_amount' => self::dec($i['tax_amount']), 'total' => self::dec($i['total']), 'paid' => self::dec($i['paid_amount']), 'balance' => self::dec($i['balance'])];
    }
    public static function line(array $it): array
    {
        $o = ['id' => (int)$it['id'], 'variant_id' => $it['variant_id'] !== null ? (int)$it['variant_id'] : null, 'description' => $it['description'], 'unit_code' => self::nz($it['unit_code']),
            'quantity' => self::dec($it['quantity'], 3), 'rate' => self::dec($it['rate']), 'discount_percent' => self::dec($it['discount_percent']), 'amount' => self::dec($it['amount'])];
        if (array_key_exists('returned_qty', $it)) $o['returned_qty'] = self::dec($it['returned_qty'], 3);
        return $o;
    }
    public static function payment(array $p): array
    {
        return ['id' => (int)$p['id'], 'receipt_no' => $p['receipt_no'], 'payment_date' => $p['payment_date'], 'customer_id' => (int)$p['customer_id'], 'customer_name' => $p['customer_name'],
            'invoice_id' => $p['invoice_id'] !== null ? (int)$p['invoice_id'] : null, 'invoice_no' => $p['invoice_no'], 'amount' => self::dec($p['amount']), 'method' => $p['method'],
            'reference_no' => $p['reference_no'], 'note' => $p['note']];
    }
    public const PAYMENT_SELECT = 'SELECT p.*, c.name AS customer_name, i.invoice_no FROM payments p JOIN customers c ON c.id=p.customer_id LEFT JOIN invoices i ON i.id=p.invoice_id';
    public static function paymentById(int $id): array
    {
        return self::payment(needRow(Db::one(self::PAYMENT_SELECT . ' WHERE p.id=?', [$id]), 'Payment'));
    }
    public static function challan(array $c): array
    {
        return ['id' => (int)$c['id'], 'challan_no' => $c['challan_no'], 'challan_date' => $c['challan_date'], 'invoice_id' => (int)$c['invoice_id'], 'vehicle_no' => $c['vehicle_no'],
            'driver_name' => $c['driver_name'], 'received_by' => $c['received_by'], 'note' => $c['note']];
    }

    // ---- purchases
    public static function purchaseRow(array $p): array
    {
        return ['id' => (int)$p['id'], 'po_no' => $p['po_no'], 'supplier_id' => (int)$p['supplier_id'], 'supplier_name' => $p['supplier_name'], 'order_date' => $p['order_date'], 'expected_date' => $p['expected_date'],
            'bill_no' => $p['bill_no'], 'notes' => $p['notes'], 'status' => $p['status'], 'total' => self::dec($p['total']), 'received_value' => self::dec($p['received_value'] ?? 0)];
    }
    public const PURCHASE_SELECT = 'SELECT po.*, s.name AS supplier_name, (SELECT COALESCE(SUM(received_value),0) FROM purchase_order_items WHERE po_id=po.id) AS received_value FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id';
    public static function supplierPayment(array $p): array
    {
        return ['id' => (int)$p['id'], 'voucher_no' => $p['voucher_no'], 'supplier_id' => (int)$p['supplier_id'], 'supplier_name' => $p['supplier_name'], 'payment_date' => $p['payment_date'], 'method' => $p['method'],
            'reference_no' => $p['reference_no'], 'amount' => self::dec($p['amount']), 'purchase_id' => $p['po_id'] !== null ? (int)$p['po_id'] : null, 'po_no' => $p['po_no'], 'note' => $p['note']];
    }
    public const SPAY_SELECT = 'SELECT sp.*, s.name AS supplier_name, po.po_no FROM supplier_payments sp JOIN suppliers s ON s.id=sp.supplier_id LEFT JOIN purchase_orders po ON po.id=sp.po_id';

    public static function enquiry(array $e): array
    {
        $att = !empty($e['attachment_path']) ? 'attachment.' . strtolower(pathinfo((string)$e['attachment_path'], PATHINFO_EXTENSION)) : null;
        return ['id' => (int)$e['id'], 'name' => $e['name'], 'company' => $e['company'], 'phone' => self::nz($e['phone']), 'email' => $e['email'], 'product_name' => $e['product_name'] ?? null, 'quantity' => $e['quantity'],
            'message' => $e['message'], 'wants_sample' => $e['wants_sample'], 'status' => $e['status'], 'created_at' => $e['created_at'], 'required_date' => $e['required_date'], 'internal_note' => $e['internal_note'],
            'attachment_name' => $att, 'converted_order_id' => $e['converted_order_id'] !== null ? (int)$e['converted_order_id'] : null];
    }
}
