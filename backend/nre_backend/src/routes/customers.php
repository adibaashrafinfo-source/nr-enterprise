<?php
declare(strict_types=1);

const CUSTOMER_TYPES = ['factory', 'buying_house', 'brand', 'retail', 'other'];

function customerFields(array $d, ?array $cur): array
{
    $d = $d + ($cur ?? []);
    $v = new V($d);
    $row = [
        'name' => $v->str('name', true, 2, 200), 'contact_person' => $v->str('contact_person', false, 0, 120), 'phone' => $v->str('phone', false, 0, 30),
        'whatsapp' => $v->str('whatsapp', false, 0, 30), 'email' => $v->email('email'), 'address' => $v->str('address', false, 0, 500),
        'delivery_address' => $v->str('delivery_address', false, 0, 500), 'bin_number' => $v->str('bin_number', false, 0, 40), 'area' => $v->str('area', false, 0, 80),
        'customer_type' => $v->enum('customer_type', CUSTOMER_TYPES, false, 'factory'), 'credit_days' => $v->int('credit_days', false, 0) ?? 0,
        'credit_limit' => $v->num('credit_limit', false, 0) ?? '0', 'opening_balance' => $v->num('opening_balance') ?? '0',
        'buyers_served' => $v->str('buyers_served', false, 0, 400), 'notes' => $v->str('notes', false, 0, 1000), 'is_active' => $v->bool('is_active', true),
    ];
    $v->done();
    return $row;
}

Router::add('GET', '/customers/dues', 'S', function (Request $r) {
    [$page, $per, $off] = paging($r, 100, 500);
    $total = (int)Db::val('SELECT COUNT(*) FROM v_invoice_aging');
    $rows = Db::all("SELECT invoice_id, invoice_no, customer_id, customer_name, invoice_date, COALESCE(due_date, invoice_date) AS due_date, balance, days_overdue FROM v_invoice_aging ORDER BY COALESCE(due_date, invoice_date), invoice_id LIMIT $per OFFSET $off");
    listResponse(array_map(fn($x) => ['invoice_id' => (int)$x['invoice_id'], 'invoice_no' => $x['invoice_no'], 'customer_id' => (int)$x['customer_id'], 'customer_name' => $x['customer_name'], 'invoice_date' => $x['invoice_date'],
        'due_date' => $x['due_date'], 'balance' => Shape::dec($x['balance']), 'days_overdue' => (int)$x['days_overdue']], $rows), $page, $per, $total);
});

Router::add('GET', '/customers', 'S', function (Request $r) {
    [$page, $per, $off] = paging($r, 25, 200);
    $w = ['1=1']; $p = [];
    if ($q = trim((string)$r->q('q', ''))) { $w[] = '(name LIKE ? OR phone LIKE ? OR code LIKE ?)'; $p = [like($q), like($q), like($q)]; }
    if (in_array($t = (string)$r->q('type', ''), CUSTOMER_TYPES, true)) { $w[] = 'customer_type=?'; $p[] = $t; }
    if ($r->q('has_due') === '1') $w[] = 'due_balance > 0';
    $where = implode(' AND ', $w);
    $total = (int)Db::val("SELECT COUNT(*) FROM v_customer_balance WHERE $where", $p);
    $where = str_replace(['customer_type', 'due_balance', 'name LIKE', 'phone LIKE', 'code LIKE'], ['c.customer_type', 'b.due_balance', 'c.name LIKE', 'c.phone LIKE', 'c.code LIKE'], $where);
    $rows = Db::all('SELECT ' . Shape::CUSTOMER_SELECT . " FROM customers c JOIN v_customer_balance b ON b.customer_id=c.id WHERE $where ORDER BY c.name LIMIT $per OFFSET $off", $p);
    listResponse(array_map([Shape::class, 'customer'], $rows), $page, $per, $total);
});

Router::add('POST', '/customers', 'S', function (Request $r) {
    $f = customerFields(Shape::customerIn($r->body), null);
    $id = Db::tx(function () use ($f) { $f['code'] = Numbering::next('customer'); $id = Db::insert('customers', $f); Audit::log('customers', 'INSERT', $id); return $id; });
    Response::ok(Shape::customerById($id), null, 201);
});

Router::add('GET', '/customers/{id}', 'S', function (Request $r) {
    $id = (int)$r->params['id'];
    $c = Shape::customerById($id);
    $c['invoices'] = array_map([Shape::class, 'invoiceRow'], Db::all('SELECT i.*, c.name AS customer_name FROM invoices i JOIN customers c ON c.id=i.customer_id WHERE i.customer_id=? ORDER BY i.id DESC LIMIT 200', [$id]));
    $c['payments'] = array_map(fn($p) => ['id' => (int)$p['id'], 'receipt_no' => $p['receipt_no'], 'payment_date' => $p['payment_date'], 'amount' => Shape::dec($p['amount'])],
        Db::all('SELECT id, receipt_no, payment_date, amount FROM payments WHERE customer_id=? ORDER BY payment_date DESC, id DESC LIMIT 200', [$id]));
    Response::ok($c);
});

Router::add('PUT', '/customers/{id}', 'S', function (Request $r) {
    $id = (int)$r->params['id']; $cur = needRow(Db::one('SELECT * FROM customers WHERE id=?', [$id]), 'Customer');
    $f = customerFields(Shape::customerIn($r->body), $cur);
    if (!Auth::isManager()) unset($f['opening_balance'], $f['credit_limit']); // staff cannot change money terms
    Db::update('customers', $id, $f);
    Audit::log('customers', 'UPDATE', $id);
    Response::ok(Shape::customerById($id));
});

Router::add('DELETE', '/customers/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id']; needRow(Db::one('SELECT id FROM customers WHERE id=?', [$id]), 'Customer');
    $docs = (int)Db::val('SELECT (SELECT COUNT(*) FROM invoices WHERE customer_id=?) + (SELECT COUNT(*) FROM sales_orders WHERE customer_id=?) + (SELECT COUNT(*) FROM payments WHERE customer_id=?)', [$id, $id, $id]);
    if ($docs > 0) { Db::update('customers', $id, ['is_active' => 0]); Audit::log('customers', 'ARCHIVE', $id); Response::ok(['ok' => true, 'archived' => true]); }
    Db::exec('DELETE FROM customers WHERE id=?', [$id]);
    Audit::log('customers', 'DELETE', $id);
    Response::ok(['ok' => true, 'archived' => false]);
});

Router::add('GET', '/customers/{id}/ledger', 'S', function (Request $r) {
    $f = (string)$r->q('from', '') ?: null; $t = (string)$r->q('to', '') ?: null;
    Response::ok(LedgerService::customer((int)$r->params['id'], $f, $t));
});

Router::add('POST', '/customers/import', 'S', function (Request $r) {
    $rows = $r->body['rows'] ?? null;
    if (!is_array($rows) || !$rows) throw new ApiException('VALIDATION', 'Send {rows: [...]}', 422);
    if (count($rows) > 1000) throw new ApiException('VALIDATION', 'At most 1000 rows per import', 422);
    $created = 0; $errors = [];
    foreach (array_values($rows) as $i => $row) {
        try {
            $f = customerFields(Shape::customerIn(is_array($row) ? $row : []), null);
            if (!Auth::isManager()) { $f['opening_balance'] = '0'; $f['credit_limit'] = '0'; }
            Db::tx(function () use ($f) { $f['code'] = Numbering::next('customer'); Db::insert('customers', $f); });
            $created++;
        } catch (ApiException $e) { $errors[] = ['row' => $i + 1, 'message' => $e->getMessage() . ($e->fields ? ': ' . implode(', ', array_map(fn($k, $v) => "$k $v", array_keys($e->fields), $e->fields)) : '')]; }
    }
    Audit::log('customers', 'IMPORT', null, ['created' => $created]);
    Response::ok(['created' => $created, 'errors' => $errors]);
});
