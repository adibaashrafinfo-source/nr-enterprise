<?php
declare(strict_types=1);

Router::add('GET', '/receiving/pending', 'S', fn(Request $r) => Response::ok(array_map(fn($x) => ['item_id' => (int)$x['po_item_id'], 'purchase_id' => (int)$x['po_id'], 'po_no' => $x['po_no'], 'supplier_name' => $x['supplier_name'],
    'expected_date' => $x['expected_date'], 'variant_id' => (int)$x['variant_id'], 'display_name' => $x['variant_name'], 'sku' => $x['sku'], 'unit_code' => $x['unit_code'],
    'qty_ordered' => Shape::dec($x['qty_ordered'], 3), 'qty_received' => Shape::dec($x['qty_received'], 3), 'qty_pending' => Shape::dec($x['qty_pending'], 3)],
    Db::all('SELECT * FROM v_pending_receipts ORDER BY expected_date IS NULL, expected_date, po_id'))));

Router::add('GET', '/purchases/reorder-suggestions', 'M', function (Request $r) {
    $rows = Db::all("SELECT b.variant_id, b.sku, b.variant_name, b.unit_code, b.qty_on_hand, b.reorder_level, l.rate AS last_rate, l.supplier_id
        FROM v_stock_balance b LEFT JOIN v_last_purchase_rate l ON l.variant_id=b.variant_id WHERE b.is_active=1 AND b.stock_status IN ('low','out') ORDER BY b.stock_status DESC, b.product_name");
    Response::ok(array_map(fn($x) => ['variant_id' => (int)$x['variant_id'], 'display_name' => $x['variant_name'], 'sku' => $x['sku'], 'unit_code' => $x['unit_code'], 'qty_on_hand' => Shape::dec($x['qty_on_hand'], 3),
        'reorder_level' => Shape::dec($x['reorder_level'], 3), 'suggested_qty' => Shape::dec(max((float)$x['reorder_level'] * 2 - (float)$x['qty_on_hand'], (float)$x['reorder_level'], 1), 3),
        'last_rate' => $x['last_rate'] !== null ? Shape::dec($x['last_rate']) : null, 'supplier_id' => $x['supplier_id'] !== null ? (int)$x['supplier_id'] : null], $rows));
});

Router::add('GET', '/purchases', 'M', function (Request $r) {
    [$page, $per, $off] = paging($r, 25, 100);
    $w = ['1=1']; $p = [];
    if (in_array($s = (string)$r->q('status', ''), ['draft', 'ordered', 'partial', 'received', 'cancelled'], true)) { $w[] = 'po.status=?'; $p[] = $s; }
    if ($c = (int)$r->q('supplier_id', 0)) { $w[] = 'po.supplier_id=?'; $p[] = $c; }
    dateRange($r, 'po.order_date', $w, $p);
    $where = implode(' AND ', $w);
    if ($q = trim((string)$r->q('q', ''))) { $w[] = '(po.po_no LIKE ? OR s.name LIKE ? OR po.bill_no LIKE ?)'; $p = array_merge($p, [like($q), like($q), like($q)]); $where = implode(' AND ', $w); }
    $total = (int)Db::val("SELECT COUNT(*) FROM purchase_orders po JOIN suppliers s ON s.id=po.supplier_id WHERE $where", $p);
    $rows = Db::all(Shape::PURCHASE_SELECT . " WHERE $where ORDER BY po.id DESC LIMIT $per OFFSET $off", $p);
    listResponse(array_map([Shape::class, 'purchaseRow'], $rows), $page, $per, $total);
});
Router::add('POST', '/purchases', 'M', function (Request $r) { $id = PurchaseService::create($r->body); Response::ok(PurchaseService::get($id), null, 201); });
Router::add('GET', '/purchases/{id}', 'M', fn(Request $r) => Response::ok(PurchaseService::get((int)$r->params['id'])));
Router::add('PUT', '/purchases/{id}', 'M', function (Request $r) { $id = (int)$r->params['id']; PurchaseService::update($id, $r->body); Response::ok(PurchaseService::get($id)); });
Router::add('POST', '/purchases/{id}/status', 'M', function (Request $r) {
    $v = new V($r->body); $to = $v->enum('status', ['ordered', 'cancelled'], true); $v->done();
    $id = (int)$r->params['id']; PurchaseService::setStatus($id, (string)$to); Response::ok(PurchaseService::get($id));
});
Router::add('POST', '/purchase-items/{id}/receive', 'S', function (Request $r) {
    $v = new V($r->body); $q = $v->num('quantity', true, 0.001); $batch = $v->str('batch_no', false, 0, 80); $note = $v->str('note', false, 0, 300); $v->done();
    Response::ok(PurchaseService::receive((int)$r->params['id'], (string)$q, $batch, $note), null, 201);
});
Router::add('POST', '/purchase-items/{id}/return', 'M', function (Request $r) {
    $v = new V($r->body); $q = $v->num('quantity', true, 0.001); $note = $v->str('note', false, 0, 300); $v->done();
    Response::ok(PurchaseService::returnItem((int)$r->params['id'], (string)$q, $note), null, 201);
});
