<?php
declare(strict_types=1);

Router::add('GET', '/enquiries', 'S', function (Request $r) {
    [$page, $per, $off] = paging($r, 25, 100);
    $w = ['1=1']; $p = [];
    if (in_array($s = (string)$r->q('status', ''), ['new', 'contacted', 'quoted', 'won', 'lost'], true)) { $w[] = 'e.status=?'; $p[] = $s; }
    if ($q = trim((string)$r->q('q', ''))) { $w[] = '(e.name LIKE ? OR e.company LIKE ? OR e.phone LIKE ? OR e.email LIKE ?)'; $p = array_merge($p, [like($q), like($q), like($q), like($q)]); }
    $where = implode(' AND ', $w);
    $total = (int)Db::val("SELECT COUNT(*) FROM enquiries e WHERE $where", $p);
    $rows = Db::all("SELECT e.*, pr.name AS product_name FROM enquiries e LEFT JOIN products pr ON pr.id=e.product_id WHERE $where ORDER BY e.id DESC LIMIT $per OFFSET $off", $p);
    listResponse(array_map([Shape::class, 'enquiry'], $rows), $page, $per, $total);
});

function enquiryDetail(int $id): array
{
    return Shape::enquiry(needRow(Db::one('SELECT e.*, pr.name AS product_name FROM enquiries e LEFT JOIN products pr ON pr.id=e.product_id WHERE e.id=?', [$id]), 'Enquiry'));
}
Router::add('GET', '/enquiries/{id}', 'S', fn(Request $r) => Response::ok(enquiryDetail((int)$r->params['id'])));

Router::add('PUT', '/enquiries/{id}', 'S', function (Request $r) {
    $id = (int)$r->params['id']; needRow(Db::one('SELECT id FROM enquiries WHERE id=?', [$id]), 'Enquiry');
    $v = new V($r->body); $st = $v->enum('status', ['new', 'contacted', 'quoted', 'won', 'lost']); $note = $v->str('internal_note', false, 0, 2000); $v->done();
    $row = []; if ($st) $row['status'] = $st; if ($v->has('internal_note')) $row['internal_note'] = $note;
    if ($row) Db::update('enquiries', $id, $row);
    Audit::log('enquiries', 'UPDATE', $id, $row);
    Response::ok(enquiryDetail($id));
});

Router::add('GET', '/enquiries/{id}/attachment', 'S', function (Request $r) {
    $id = (int)$r->params['id'];
    $e = needRow(Db::one('SELECT attachment_path FROM enquiries WHERE id=?', [$id]), 'Enquiry');
    if (empty($e['attachment_path'])) throw new ApiException('NOT_FOUND', 'No attachment', 404);
    if ($r->q('download') !== '1') Response::ok(['name' => 'attachment.' . strtolower(pathinfo((string)$e['attachment_path'], PATHINFO_EXTENSION)), 'url' => rtrim((string)Config::get('API_PREFIX', '/api/v1'), '/') . "/enquiries/$id/attachment?download=1"]);
    $rel = basename((string)$e['attachment_path']);
    $file = Upload::storageDir() . '/enquiries/' . $rel;
    if (!is_file($file)) throw new ApiException('NOT_FOUND', 'File missing', 404);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file) ?: 'application/octet-stream';
    if (!in_array($mime, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], true)) $mime = 'application/octet-stream';
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($file));
    header('Content-Disposition: attachment; filename="' . $rel . '"');
    header('X-Content-Type-Options: nosniff');
    header('Cache-Control: private, no-store');
    readfile($file);
    exit;
});

Router::add('POST', '/enquiries/{id}/convert', 'S', function (Request $r) {
    $id = (int)$r->params['id']; $e = needRow(Db::one('SELECT * FROM enquiries WHERE id=?', [$id]), 'Enquiry');
    if ($e['converted_order_id']) throw new ApiException('ALREADY_CONVERTED', 'This enquiry is already converted', 409);
    $order = Db::tx(function () use ($id, $e, $r) {
        $cid = (int)($r->body['customer_id'] ?? 0);
        if ($cid) needRow(Db::one('SELECT id FROM customers WHERE id=?', [$cid]), 'Customer');
        else {
            $c = is_array($r->body['customer'] ?? null) ? $r->body['customer'] : [];
            $c += ['name' => $e['company'] ?: $e['name'], 'contact_person' => $e['name'], 'phone' => $e['phone'], 'email' => $e['email']];
            $f = customerFields(Shape::customerIn($c), null); $f['code'] = Numbering::next('customer'); $cid = Db::insert('customers', $f);
        }
        $items = is_array($r->body['items'] ?? null) ? $r->body['items'] : null;
        if (!$items) {
            $var = $e['product_id'] ? Db::one('SELECT v.id, COALESCE(v.name,p.name) AS n, COALESCE(v.selling_price,p.selling_price) AS price FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.id=? AND v.is_active=1 ORDER BY v.id LIMIT 1', [$e['product_id']]) : null;
            $qty = preg_match('/\d+(\.\d+)?/', (string)$e['quantity'], $m) ? max((float)$m[0], 1) : 1;
            $items = [$var ? ['variant_id' => (int)$var['id'], 'quantity' => $qty, 'rate' => $var['price'] ?? 0]
                           : ['description' => 'Enquiry #' . $id . ': ' . mb_substr((string)($e['message'] ?: 'Items to be confirmed'), 0, 120), 'quantity' => $qty, 'rate' => 0]];
        }
        $oid = OrderService::create(['customer_id' => $cid, 'enquiry_id' => $id, 'notes' => 'From website enquiry #' . $id, 'items' => $items]);
        Db::update('enquiries', $id, ['converted_order_id' => $oid, 'status' => 'quoted']);
        Audit::log('enquiries', 'CONVERT', $id, ['order' => $oid]);
        return $oid;
    });
    Response::ok(['order_id' => $order], null, 201);
});
