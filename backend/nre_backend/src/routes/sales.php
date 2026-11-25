<?php
declare(strict_types=1);

function dateRange(Request $r, string $col, array &$w, array &$p): void
{
    foreach (['from' => '>=', 'to' => '<='] as $k => $op) {
        $v = (string)$r->q($k, '');
        if ($v !== '') { if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) throw new ApiException('VALIDATION', "Invalid $k date", 422, [$k => 'Use YYYY-MM-DD']); $w[] = "$col $op ?"; $p[] = $v; }
    }
}

// ---- orders
Router::add('GET', '/orders', 'S', function (Request $r) {
    [$page, $per, $off] = paging($r, 25, 100);
    $w = ['1=1']; $p = [];
    if (in_array($s = (string)$r->q('status', ''), ['quotation', 'confirmed', 'delivered', 'invoiced', 'cancelled'], true)) { $w[] = 'o.status=?'; $p[] = $s; }
    if ($c = (int)$r->q('customer_id', 0)) { $w[] = 'o.customer_id=?'; $p[] = $c; }
    if ($q = trim((string)$r->q('q', ''))) { $w[] = '(o.order_no LIKE ? OR c.name LIKE ? OR o.po_no LIKE ?)'; $p = array_merge($p, [like($q), like($q), like($q)]); }
    dateRange($r, 'o.order_date', $w, $p);
    $where = implode(' AND ', $w);
    $total = (int)Db::val("SELECT COUNT(*) FROM sales_orders o JOIN customers c ON c.id=o.customer_id WHERE $where", $p);
    $rows = Db::all(OrderService::SELECT . " WHERE $where ORDER BY o.id DESC LIMIT $per OFFSET $off", $p);
    listResponse(array_map(fn($o) => OrderService::row($o) + ['items' => []], $rows), $page, $per, $total);
});
Router::add('POST', '/orders', 'S', function (Request $r) { $id = OrderService::create($r->body); Response::ok(OrderService::get($id), null, 201); });
Router::add('GET', '/orders/{id}', 'S', fn(Request $r) => Response::ok(OrderService::get((int)$r->params['id'])));
Router::add('PUT', '/orders/{id}', 'S', function (Request $r) { $id = (int)$r->params['id']; OrderService::update($id, $r->body); Response::ok(OrderService::get($id)); });
Router::add('POST', '/orders/{id}/status', 'S', function (Request $r) {
    $v = new V($r->body); $to = $v->enum('status', ['quotation', 'confirmed', 'delivered', 'cancelled'], true); $v->done();
    $id = (int)$r->params['id']; OrderService::setStatus($id, (string)$to); Response::ok(OrderService::get($id));
});
Router::add('POST', '/orders/{id}/convert', 'S', function (Request $r) { $inv = OrderService::convert((int)$r->params['id']); Response::ok(['invoice_id' => $inv], null, 201); });

// ---- invoices
Router::add('GET', '/invoices', 'S', function (Request $r) {
    [$page, $per, $off] = paging($r, 25, 100);
    $w = ['1=1']; $p = [];
    if (in_array($s = (string)$r->q('status', ''), ['draft', 'due', 'partial', 'paid', 'cancelled'], true)) { $w[] = 'i.status=?'; $p[] = $s; }
    if ($c = (int)$r->q('customer_id', 0)) { $w[] = 'i.customer_id=?'; $p[] = $c; }
    if ($q = trim((string)$r->q('q', ''))) { $w[] = '(i.invoice_no LIKE ? OR c.name LIKE ? OR i.po_no LIKE ?)'; $p = array_merge($p, [like($q), like($q), like($q)]); }
    dateRange($r, 'i.invoice_date', $w, $p);
    $where = implode(' AND ', $w);
    $total = (int)Db::val("SELECT COUNT(*) FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE $where", $p);
    $rows = Db::all("SELECT i.*, c.name AS customer_name FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE $where ORDER BY i.id DESC LIMIT $per OFFSET $off", $p);
    listResponse(array_map([Shape::class, 'invoiceRow'], $rows), $page, $per, $total);
});
Router::add('POST', '/invoices', 'S', function (Request $r) { $id = InvoiceService::create($r->body); Response::ok(InvoiceService::get($id), null, 201); });
Router::add('GET', '/invoices/{id}', 'S', fn(Request $r) => Response::ok(InvoiceService::get((int)$r->params['id'])));
Router::add('PUT', '/invoices/{id}', 'S', function (Request $r) { $id = (int)$r->params['id']; InvoiceService::update($id, $r->body); Response::ok(InvoiceService::get($id)); });
Router::add('DELETE', '/invoices/{id}', 'M', function (Request $r) { InvoiceService::deleteDraft((int)$r->params['id']); Response::ok(['ok' => true]); });
Router::add('POST', '/invoices/{id}/confirm', 'S', function (Request $r) { $res = InvoiceService::confirm((int)$r->params['id']); Response::ok($res['invoice'] + ['warnings' => $res['warnings']]); });
Router::add('POST', '/invoices/{id}/cancel', 'M', function (Request $r) {
    $v = new V($r->body); $reason = $v->str('reason', true, 3, 300); $v->done();
    $id = (int)$r->params['id']; InvoiceService::cancel($id, (string)$reason); Response::ok(InvoiceService::get($id));
});
Router::add('POST', '/invoice-items/{id}/return', 'M', function (Request $r) {
    $v = new V($r->body); $q = $v->num('quantity', true, 0.001); $note = $v->str('note', false, 0, 300); $v->done();
    $res = InvoiceService::itemReturn((int)$r->params['id'], (string)$q, $note); Response::ok(['credit_note' => Shape::paymentById((int)$res['payment_id'])], null, 201);
});
Router::add('POST', '/invoices/{id}/payments', 'S', function (Request $r) {
    $id = (int)$r->params['id']; $pid = PaymentService::add($id, $r->body);
    Response::ok(Shape::paymentById($pid), null, 201);
});

// ---- payments
Router::add('GET', '/payments', 'S', function (Request $r) {
    [$page, $per, $off] = paging($r, 25, 100);
    $w = ['1=1']; $p = [];
    if ($c = (int)$r->q('customer_id', 0)) { $w[] = 'p.customer_id=?'; $p[] = $c; }
    if ($m = (string)$r->q('method', '')) { $w[] = 'p.method=?'; $p[] = $m; }
    dateRange($r, 'p.payment_date', $w, $p);
    $where = implode(' AND ', $w);
    $total = (int)Db::val("SELECT COUNT(*) FROM payments p WHERE $where", $p);
    $rows = Db::all(Shape::PAYMENT_SELECT . " WHERE $where ORDER BY p.id DESC LIMIT $per OFFSET $off", $p);
    listResponse(array_map([Shape::class, 'payment'], $rows), $page, $per, $total);
});
Router::add('GET', '/payments/{id}', 'S', function (Request $r) {
    $p = needRow(Db::one(Shape::PAYMENT_SELECT . ' WHERE p.id=?', [(int)$r->params['id']]), 'Payment');
    $o = Shape::payment($p);
    $o['invoice'] = $p['invoice_id'] ? InvoiceService::get((int)$p['invoice_id']) : null; $o['company'] = Shape::company();
    Response::ok($o);
});
Router::add('PUT', '/payments/{id}', 'M', function (Request $r) { $id = (int)$r->params['id']; PaymentService::update($id, $r->body); Response::ok(Shape::paymentById($id)); });
Router::add('DELETE', '/payments/{id}', 'M', function (Request $r) { PaymentService::delete((int)$r->params['id']); Response::ok(['ok' => true]); });

// ---- challans
Router::add('POST', '/invoices/{id}/challans', 'S', function (Request $r) {
    $id = (int)$r->params['id']; $inv = needRow(Db::one('SELECT id, status FROM invoices WHERE id=?', [$id]), 'Invoice');
    if (!in_array($inv['status'], ['due', 'partial', 'paid'], true)) throw new ApiException('NOT_CONFIRMED', 'Challan can only be made for a confirmed invoice', 409);
    $v = new V($r->body); $date = $v->date('challan_date') ?? date('Y-m-d'); $veh = $v->str('vehicle_no', false, 0, 40); $drv = $v->str('driver_name', false, 0, 100); $rec = $v->str('received_by', false, 0, 100); $note = $v->str('note', false, 0, 400); $v->done();
    $cid = Db::tx(fn() => Db::insert('delivery_challans', ['challan_no' => Numbering::next('challan'), 'invoice_id' => $id, 'challan_date' => $date, 'vehicle_no' => $veh, 'driver_name' => $drv, 'received_by' => $rec, 'note' => $note, 'created_by' => Auth::id()]));
    Audit::log('delivery_challans', 'INSERT', $cid);
    Response::ok(Shape::challan(Db::one('SELECT * FROM delivery_challans WHERE id=?', [$cid])), null, 201);
});
Router::add('GET', '/challans/{id}', 'S', function (Request $r) {
    $c = needRow(Db::one('SELECT ch.*, i.invoice_no, i.invoice_date, i.buyer_ref, i.po_no, i.style_no, i.customer_id FROM delivery_challans ch JOIN invoices i ON i.id=ch.invoice_id WHERE ch.id=?', [(int)$r->params['id']]), 'Challan');
    $o = Shape::challan($c) + ['invoice_no' => $c['invoice_no'], 'invoice_date' => $c['invoice_date'], 'buyer_ref' => $c['buyer_ref'], 'po_no' => $c['po_no'], 'style_no' => $c['style_no']];
    $o['customer'] = Shape::customerById((int)$c['customer_id']);
    $o['company'] = Shape::company();
    $o['items'] = array_map(fn($x) => ['description' => $x['description'], 'unit_code' => Shape::nz($x['unit_code']), 'quantity' => Shape::dec($x['quantity'], 3)],
        Db::all('SELECT description, unit_code, quantity FROM invoice_items WHERE invoice_id=? ORDER BY sort_order, id', [$c['invoice_id']]));
    Response::ok($o);
});
