<?php
declare(strict_types=1);

function supplierFields(array $d, ?array $cur): array
{
    $d = $d + ($cur ?? []);
    $v = new V($d);
    $row = ['name' => $v->str('name', true, 2, 200), 'contact_person' => $v->str('contact_person', false, 0, 120), 'phone' => $v->str('phone', false, 0, 30), 'email' => $v->email('email'),
        'address' => $v->str('address', false, 0, 500), 'payment_terms' => $v->str('payment_terms', false, 0, 200), 'opening_balance' => $v->num('opening_balance') ?? '0',
        'notes' => $v->str('notes', false, 0, 1000), 'is_active' => $v->bool('is_active', true)];
    $v->done();
    return $row;
}

Router::add('GET', '/suppliers', 'M', function (Request $r) {
    [$page, $per, $off] = paging($r, 25, 200);
    $w = ['1=1']; $p = [];
    if ($q = trim((string)$r->q('q', ''))) { $w[] = '(s.name LIKE ? OR s.phone LIKE ? OR s.code LIKE ?)'; $p = [like($q), like($q), like($q)]; }
    $where = implode(' AND ', $w);
    $total = (int)Db::val("SELECT COUNT(*) FROM suppliers s WHERE $where", $p);
    $rows = Db::all("SELECT s.*, COALESCE(b.total_purchased,0) AS total_purchased, COALESCE(b.total_paid,0) AS paid, COALESCE(b.payable_balance,s.opening_balance) AS payable_balance FROM suppliers s LEFT JOIN v_supplier_balance b ON b.supplier_id=s.id WHERE $where ORDER BY s.name LIMIT $per OFFSET $off", $p);
    listResponse(array_map([Shape::class, 'supplier'], $rows), $page, $per, $total);
});

Router::add('POST', '/suppliers', 'M', function (Request $r) {
    $f = supplierFields($r->body, null);
    $id = Db::tx(function () use ($f, $r) { $f['code'] = Numbering::next('supplier'); $id = Db::insert('suppliers', $f); syncSupplierProducts($id, $r->body['product_ids'] ?? null); Audit::log('suppliers', 'INSERT', $id); return $id; });
    Response::ok(Shape::supplierById($id), null, 201);
});

function syncSupplierProducts(int $id, mixed $ids): void
{
    if (!is_array($ids)) return;
    Db::exec('DELETE FROM supplier_products WHERE supplier_id=?', [$id]);
    foreach (array_unique(array_map('intval', $ids)) as $pid)
        if ($pid > 0 && Db::one('SELECT id FROM products WHERE id=?', [$pid])) Db::exec('INSERT INTO supplier_products (supplier_id, product_id) VALUES (?,?)', [$id, $pid]);
}

Router::add('GET', '/suppliers/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id'];
    $s = Shape::supplierById($id);
    $s['purchases'] = array_map(fn($x) => ['id' => (int)$x['id'], 'po_no' => $x['po_no'], 'date' => $x['order_date'], 'received_value' => Shape::dec($x['received_value'])],
        Db::all("SELECT po.id, po.po_no, po.order_date, COALESCE(SUM(i.received_value),0) AS received_value FROM purchase_orders po LEFT JOIN purchase_order_items i ON i.po_id=po.id WHERE po.supplier_id=? AND po.status<>'cancelled' GROUP BY po.id, po.po_no, po.order_date ORDER BY po.id DESC LIMIT 200", [$id]));
    $s['payments'] = array_map([Shape::class, 'supplierPayment'], Db::all(Shape::SPAY_SELECT . ' WHERE sp.supplier_id=? ORDER BY sp.payment_date DESC, sp.id DESC LIMIT 200', [$id]));
    Response::ok($s);
});

Router::add('PUT', '/suppliers/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id']; $cur = needRow(Db::one('SELECT * FROM suppliers WHERE id=?', [$id]), 'Supplier');
    $f = supplierFields($r->body, $cur);
    Db::tx(function () use ($id, $f, $r) { Db::update('suppliers', $id, $f); syncSupplierProducts($id, $r->body['product_ids'] ?? null); Audit::log('suppliers', 'UPDATE', $id); });
    Response::ok(Shape::supplierById($id));
});

Router::add('DELETE', '/suppliers/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id']; needRow(Db::one('SELECT id FROM suppliers WHERE id=?', [$id]), 'Supplier');
    $docs = (int)Db::val('SELECT (SELECT COUNT(*) FROM purchase_orders WHERE supplier_id=?) + (SELECT COUNT(*) FROM supplier_payments WHERE supplier_id=?)', [$id, $id]);
    if ($docs > 0) { Db::update('suppliers', $id, ['is_active' => 0]); Audit::log('suppliers', 'ARCHIVE', $id); Response::ok(['ok' => true, 'archived' => true]); }
    Db::tx(function () use ($id) { Db::exec('DELETE FROM supplier_products WHERE supplier_id=?', [$id]); Db::exec('DELETE FROM suppliers WHERE id=?', [$id]); });
    Audit::log('suppliers', 'DELETE', $id);
    Response::ok(['ok' => true, 'archived' => false]);
});

Router::add('GET', '/suppliers/{id}/ledger', 'M', function (Request $r) {
    $f = (string)$r->q('from', '') ?: null; $t = (string)$r->q('to', '') ?: null;
    Response::ok(LedgerService::supplier((int)$r->params['id'], $f, $t));
});

Router::add('POST', '/suppliers/{id}/payments', 'M', function (Request $r) {
    $id = PurchaseService::supplierPayment((int)$r->params['id'], $r->body);
    Response::ok(Shape::supplierPayment(needRow(Db::one(Shape::SPAY_SELECT . ' WHERE sp.id=?', [$id]), 'Voucher')), null, 201);
});
Router::add('GET', '/supplier-payments/{id}', 'M', function (Request $r) {
    $p = Shape::supplierPayment(needRow(Db::one(Shape::SPAY_SELECT . ' WHERE sp.id=?', [(int)$r->params['id']]), 'Voucher'));
    $p['supplier'] = Shape::supplierById($p['supplier_id']); $p['company'] = Shape::company();
    Response::ok($p);
});
