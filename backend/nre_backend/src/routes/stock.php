<?php
declare(strict_types=1);

Router::add('GET', '/stock', 'S', function (Request $r) {
    [$page, $per, $off] = paging($r, 25, 200);
    $w = ['is_active=1']; $p = [];
    if ($q = trim((string)$r->q('q', ''))) { $w[] = '(sku LIKE ? OR variant_name LIKE ? OR product_name LIKE ?)'; $p = [like($q), like($q), like($q)]; }
    if ($c = (int)$r->q('category_id', 0)) { $w[] = 'category_id=?'; $p[] = $c; }
    if (in_array($s = (string)$r->q('status', ''), ['ok', 'low', 'out'], true)) { $w[] = 'stock_status=?'; $p[] = $s; }
    $where = implode(' AND ', $w);
    $total = (int)Db::val("SELECT COUNT(*) FROM v_stock_balance WHERE $where", $p);
    $rows = Db::all("SELECT * FROM v_stock_balance WHERE $where ORDER BY product_name, sku LIMIT $per OFFSET $off", $p);
    listResponse(array_map([Shape::class, 'stockRow'], $rows), $page, $per, $total);
});

Router::add('GET', '/stock/value', 'M', function (Request $r) {
    $cats = Db::all('SELECT b.category_id, b.category_name, COALESCE(SUM(b.qty_on_hand * COALESCE(c.purchase_price,0)),0) AS value
        FROM v_stock_balance b LEFT JOIN variant_costs c ON c.variant_id=b.variant_id WHERE b.qty_on_hand > 0 GROUP BY b.category_id, b.category_name ORDER BY value DESC');
    $total = 0.0; foreach ($cats as $c) $total += (float)$c['value'];
    Response::ok(['total' => Money::fmt($total), 'by_category' => array_map(fn($c) => ['category_id' => $c['category_id'], 'category_name' => $c['category_name'], 'value' => Money::fmt($c['value'])], $cats)]);
});

Router::add('POST', '/stock/opening', 'M', function (Request $r) {
    $v = new V($r->body); $vid = $v->int('variant_id', true, 1); $q = $v->num('quantity', true, 0.001); $cost = $v->num('cost', false, 0); $note = $v->str('note', false, 0, 300); $v->done();
    $res = StockService::opening($vid, $q, $cost, $note); Response::ok(Shape::ledgerById($res['movement_id']), null, 201);
});
Router::add('POST', '/stock/adjust', 'M', function (Request $r) {
    $v = new V($r->body); $vid = $v->int('variant_id', true, 1); $q = $v->num('quantity', true); $reason = $v->str('reason', true, 3, 300); $v->done();
    if (Money::cmp3($q, 0) === 0) throw new ApiException('VALIDATION', 'Quantity cannot be zero', 422, ['quantity' => 'Cannot be zero']);
    $res = StockService::adjust($vid, $q, $reason); Response::ok(Shape::ledgerById($res['movement_id']), null, 201);
});

Router::add('GET', '/stock/{id}/movements', 'S', function (Request $r) {
    $id = (int)$r->params['id']; needRow(Db::one('SELECT id FROM product_variants WHERE id=?', [$id]), 'Variant');
    [$page, $per, $off] = paging($r, 25, 200);
    $w = ['m.variant_id=?']; $p = [$id];
    if ($t = (string)$r->q('type', '')) { $w[] = 'm.movement_type=?'; $p[] = $t; }
    if ($f = (string)$r->q('from', '')) { $w[] = 'DATE(m.created_at)>=?'; $p[] = $f; }
    if ($to = (string)$r->q('to', '')) { $w[] = 'DATE(m.created_at)<=?'; $p[] = $to; }
    $where = implode(' AND ', $w);
    $total = (int)Db::val("SELECT COUNT(*) FROM stock_movements m WHERE $where", $p);
    $rows = Db::all("SELECT m.*, u.full_name AS user_name FROM stock_movements m LEFT JOIN users u ON u.id=m.created_by WHERE $where ORDER BY m.id DESC LIMIT $per OFFSET $off", $p);
    Response::send(['data' => Response::normalize(array_map([Shape::class, 'ledgerRow'], $rows)), 'meta' => ['page' => $page, 'per_page' => $per, 'total' => $total], 'variant' => Shape::stockRowById($id)]);
});
