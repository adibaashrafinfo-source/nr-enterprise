<?php
declare(strict_types=1);

Router::add('GET', '/dashboard/summary', 'S', function (Request $r) {
    $sold = "status IN ('due','partial','paid')";
    $d = [
        'sales_today' => Money::fmt(Db::val("SELECT COALESCE(SUM(total),0) FROM invoices WHERE invoice_date=CURDATE() AND $sold")),
        'sales_yesterday' => Money::fmt(Db::val("SELECT COALESCE(SUM(total),0) FROM invoices WHERE invoice_date=(CURDATE() - INTERVAL 1 DAY) AND $sold")),
        'customer_dues' => Money::fmt(Db::val("SELECT COALESCE(SUM(balance),0) FROM invoices WHERE status IN ('due','partial')")),
        'unpaid_invoices' => (int)Db::val("SELECT COUNT(*) FROM invoices WHERE status IN ('due','partial')"),
        'low_stock_count' => (int)Db::val("SELECT COUNT(*) FROM v_stock_balance WHERE is_active=1 AND stock_status IN ('low','out')"),
        'new_enquiries' => (int)Db::val("SELECT COUNT(*) FROM enquiries WHERE status='new'"),
        'variant_count' => (int)Db::val('SELECT COUNT(*) FROM product_variants WHERE is_active=1'),
        'stock_value' => null,
    ];
    if (Auth::isManager())
        $d['stock_value'] = Money::fmt(Db::val('SELECT COALESCE(SUM(b.qty_on_hand * COALESCE(c.purchase_price,0)),0) FROM v_stock_balance b LEFT JOIN variant_costs c ON c.variant_id=b.variant_id WHERE b.qty_on_hand > 0'));
    Response::ok($d);
});

Router::add('GET', '/dashboard/sales-by-day', 'S', function (Request $r) {
    $days = (int)$r->q('days', 7); if (!in_array($days, [7, 30], true)) $days = 7;
    $map = [];
    foreach (Db::all("SELECT invoice_date AS d, SUM(total) AS t FROM invoices WHERE status IN ('due','partial','paid') AND invoice_date >= (CURDATE() - INTERVAL " . ($days - 1) . " DAY) GROUP BY invoice_date") as $x) $map[$x['d']] = $x['t'];
    $out = [];
    for ($i = $days - 1; $i >= 0; $i--) { $d = date('Y-m-d', strtotime("-$i day")); $out[] = ['day' => $d, 'total' => Money::fmt($map[$d] ?? 0)]; }
    Response::ok($out);
});

Router::add('GET', '/search', 'S', function (Request $r) {
    $q = trim((string)$r->q('q', ''));
    if (mb_strlen($q) < 2) Response::ok(['products' => [], 'variants' => [], 'customers' => [], 'invoices' => []]);
    $l = like($q);
    Response::ok([
        'products' => array_map(fn($x) => ['id' => (int)$x['id'], 'name' => $x['name'], 'code' => Shape::nz($x['code']), 'category_slug' => $x['category_slug']],
            Db::all('SELECT p.id, p.name, p.code, c.slug AS category_slug FROM products p JOIN categories c ON c.id=p.category_id WHERE p.name LIKE ? OR p.code LIKE ? ORDER BY p.name LIMIT 5', [$l, $l])),
        'variants' => array_map(fn($x) => ['id' => (int)$x['id'], 'sku' => $x['sku'], 'display_name' => $x['display_name'], 'product_id' => (int)$x['product_id']],
            Db::all('SELECT v.id, v.sku, COALESCE(v.name,p.name) AS display_name, p.id AS product_id FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.sku LIKE ? OR v.name LIKE ? ORDER BY p.name LIMIT 5', [$l, $l])),
        'customers' => array_map(fn($x) => ['id' => (int)$x['id'], 'name' => $x['name'], 'phone' => $x['phone']], Db::all('SELECT id, name, phone FROM customers WHERE name LIKE ? OR phone LIKE ? OR code LIKE ? ORDER BY name LIMIT 5', [$l, $l, $l])),
        'invoices' => array_map(fn($x) => ['id' => (int)$x['id'], 'invoice_no' => $x['invoice_no'], 'customer_name' => $x['customer_name'], 'total' => Shape::dec($x['total']), 'status' => $x['status']],
            Db::all('SELECT i.id, i.invoice_no, i.total, i.status, c.name AS customer_name FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE i.invoice_no LIKE ? ORDER BY i.id DESC LIMIT 5', [$l])),
    ]);
});
