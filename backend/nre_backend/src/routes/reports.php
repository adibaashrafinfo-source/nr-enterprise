<?php
declare(strict_types=1);

Router::add('GET', '/reports/stock', 'M', function (Request $r) {
    $rows = Db::all('SELECT b.variant_id, b.sku, b.variant_name, b.category_name, b.unit_code, b.qty_on_hand, COALESCE(c.purchase_price,0) AS purchase_price, b.qty_on_hand * COALESCE(c.purchase_price,0) AS value
        FROM v_stock_balance b LEFT JOIN variant_costs c ON c.variant_id=b.variant_id WHERE b.is_active=1 ORDER BY b.category_name, b.product_name, b.sku');
    Response::ok(array_map(fn($x) => ['variant_id' => (int)$x['variant_id'], 'sku' => $x['sku'], 'display_name' => $x['variant_name'], 'category_name' => $x['category_name'], 'unit_code' => $x['unit_code'],
        'qty_on_hand' => Shape::dec($x['qty_on_hand'], 3), 'purchase_price' => Shape::dec($x['purchase_price'], 2), 'value' => Shape::dec($x['value'])], $rows));
});
Router::add('GET', '/reports/low-stock', 'S', fn(Request $r) => Response::ok(array_map([Shape::class, 'stockRow'], Db::all("SELECT * FROM v_stock_balance WHERE is_active=1 AND stock_status IN ('low','out') ORDER BY stock_status DESC, product_name"))));

Router::add('GET', '/reports/movements', 'S', function (Request $r) {
    $w = ['1=1']; $p = [];
    if ($vid = (int)$r->q('variant_id', 0)) { $w[] = 'm.variant_id=?'; $p[] = $vid; }
    if ($t = (string)$r->q('type', '')) { $w[] = 'm.movement_type=?'; $p[] = $t; }
    dateRange($r, 'DATE(m.created_at)', $w, $p);
    $rows = Db::all('SELECT m.*, u.full_name AS user_name, v.sku, COALESCE(v.name,pr.name) AS display_name FROM stock_movements m JOIN product_variants v ON v.id=m.variant_id JOIN products pr ON pr.id=v.product_id LEFT JOIN users u ON u.id=m.created_by
        WHERE ' . implode(' AND ', $w) . ' ORDER BY m.id DESC LIMIT 1000', $p);
    Response::ok(array_map(fn($x) => Shape::ledgerRow($x) + ['date' => substr((string)$x['created_at'], 0, 10), 'display_name' => $x['display_name'], 'sku' => $x['sku']], $rows));
});

function groupRows(array $rows): array { return array_map(fn($x) => ['key' => (string)$x['k'], 'label' => (string)$x['label'], 'count' => (int)$x['cnt'], 'total' => Shape::dec($x['total'])], $rows); }

Router::add('GET', '/reports/sales', 'M', function (Request $r) {
    $group = (string)$r->q('group', 'day'); if (!in_array($group, ['day', 'customer', 'product'], true)) $group = 'day';
    $w = ["i.status IN ('due','partial','paid')"]; $p = []; dateRange($r, 'i.invoice_date', $w, $p); $where = implode(' AND ', $w);
    if ($group === 'day') $rows = Db::all("SELECT i.invoice_date AS k, i.invoice_date AS label, COUNT(*) AS cnt, SUM(i.total) AS total FROM invoices i WHERE $where GROUP BY i.invoice_date ORDER BY i.invoice_date", $p);
    elseif ($group === 'customer') $rows = Db::all("SELECT c.id AS k, c.name AS label, COUNT(*) AS cnt, SUM(i.total) AS total FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE $where GROUP BY c.id, c.name ORDER BY total DESC", $p);
    else $rows = Db::all("SELECT COALESCE(it.variant_id, it.description) AS k, MAX(it.description) AS label, COUNT(DISTINCT i.id) AS cnt, SUM(it.amount) AS total FROM invoice_items it JOIN invoices i ON i.id=it.invoice_id WHERE $where GROUP BY COALESCE(it.variant_id, it.description) ORDER BY total DESC", $p);
    Response::ok(groupRows($rows));
});

Router::add('GET', '/reports/purchases', 'M', function (Request $r) {
    $group = (string)$r->q('group', 'day'); if (!in_array($group, ['day', 'supplier', 'product'], true)) $group = 'day';
    $w = ["po.status<>'cancelled'"]; $p = []; dateRange($r, 'po.order_date', $w, $p); $where = implode(' AND ', $w);
    if ($group === 'day') $rows = Db::all("SELECT po.order_date AS k, po.order_date AS label, COUNT(DISTINCT po.id) AS cnt, SUM(i.received_value) AS total FROM purchase_orders po JOIN purchase_order_items i ON i.po_id=po.id WHERE $where GROUP BY po.order_date HAVING SUM(i.received_value) > 0 ORDER BY po.order_date", $p);
    elseif ($group === 'supplier') $rows = Db::all("SELECT s.id AS k, s.name AS label, COUNT(DISTINCT po.id) AS cnt, SUM(i.received_value) AS total FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id JOIN purchase_order_items i ON i.po_id=po.id WHERE $where GROUP BY s.id, s.name HAVING SUM(i.received_value) > 0 ORDER BY total DESC", $p);
    else $rows = Db::all("SELECT v.id AS k, COALESCE(v.name,pr.name) AS label, COUNT(DISTINCT po.id) AS cnt, SUM(i.received_value) AS total FROM purchase_orders po JOIN purchase_order_items i ON i.po_id=po.id JOIN product_variants v ON v.id=i.variant_id JOIN products pr ON pr.id=v.product_id WHERE $where GROUP BY v.id, v.name, pr.name HAVING SUM(i.received_value) > 0 ORDER BY total DESC", $p);
    Response::ok(groupRows($rows));
});

Router::add('GET', '/reports/dues', 'S', function (Request $r) {
    $by = [];
    foreach (Db::all('SELECT customer_id, customer_name, balance, days_overdue FROM v_invoice_aging') as $x) {
        $d = (int)$x['days_overdue']; $k = $d <= 30 ? '0-30' : ($d <= 60 ? '31-60' : ($d <= 90 ? '61-90' : '90+'));
        $c = (int)$x['customer_id'];
        $by[$c] ??= ['customer_id' => $c, 'customer_name' => $x['customer_name'], '0-30' => 0.0, '31-60' => 0.0, '61-90' => 0.0, '90+' => 0.0];
        $by[$c][$k] += (float)$x['balance'];
    }
    $out = [];
    foreach ($by as $c) { $t = $c['0-30'] + $c['31-60'] + $c['61-90'] + $c['90+']; $out[] = ['customer_id' => $c['customer_id'], 'customer_name' => $c['customer_name'], 'total' => Shape::dec($t), '0-30' => Shape::dec($c['0-30']), '31-60' => Shape::dec($c['31-60']), '61-90' => Shape::dec($c['61-90']), '90+' => Shape::dec($c['90+'])]; }
    usort($out, fn($a, $b) => (float)$b['total'] <=> (float)$a['total']);
    Response::ok($out);
});
Router::add('GET', '/reports/payables', 'M', fn(Request $r) => Response::ok(array_map(fn($x) => ['supplier_id' => (int)$x['supplier_id'], 'code' => $x['code'], 'name' => $x['name'], 'total_purchased' => Shape::dec($x['total_purchased']),
    'paid' => Shape::dec($x['total_paid']), 'payable_balance' => Shape::dec($x['payable_balance'])], Db::all('SELECT supplier_id, code, name, total_purchased, total_paid, payable_balance FROM v_supplier_balance WHERE payable_balance <> 0 ORDER BY payable_balance DESC'))));

Router::add('GET', '/reports/profit', 'M', function (Request $r) {
    $w = ["i.status IN ('due','partial','paid')"]; $p = []; dateRange($r, 'i.invoice_date', $w, $p); $where = implode(' AND ', $w);
    $sales = Db::val("SELECT COALESCE(SUM(GREATEST(i.subtotal - i.discount, 0)),0) FROM invoices i WHERE $where", $p);
    $cost = Db::val("SELECT COALESCE(SUM(it.quantity * COALESCE(vc.purchase_price,0)),0) FROM invoice_items it JOIN invoices i ON i.id=it.invoice_id LEFT JOIN variant_costs vc ON vc.variant_id=it.variant_id WHERE $where", $p);
    Response::ok(['sales' => Money::fmt($sales), 'cost' => Money::fmt($cost), 'profit' => Money::fmt((float)$sales - (float)$cost)]);
});
