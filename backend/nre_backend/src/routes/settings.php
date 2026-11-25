<?php
declare(strict_types=1);

Router::add('GET', '/settings', 'M', fn(Request $r) => Response::ok(Shape::settings(Db::one('SELECT * FROM company_settings WHERE id=1') ?: [])));

Router::add('PUT', '/settings', 'A', function (Request $r) {
    $cur = Db::one('SELECT * FROM company_settings WHERE id=1') ?: [];
    $b = $r->body;
    foreach (['bin' => 'bin_number', 'tin' => 'tin_number', 'trade_licence' => 'trade_license_no'] as $from => $to) if (array_key_exists($from, $b)) { $b[$to] = $b[$from]; unset($b[$from]); }
    $v = new V($b + $cur);
    $row = ['company_name' => $v->str('company_name', true, 2, 200), 'tagline' => $v->str('tagline', false, 0, 250), 'address' => $v->str('address', false, 0, 500),
        'whatsapp' => $v->str('whatsapp', false, 0, 30), 'facebook_url' => $v->str('facebook_url', false, 0, 250), 'youtube_url' => $v->str('youtube_url', false, 0, 250), 'website_url' => $v->str('website_url', false, 0, 250),
        'bin_number' => $v->str('bin_number', false, 0, 40), 'tin_number' => $v->str('tin_number', false, 0, 40), 'trade_license_no' => $v->str('trade_license_no', false, 0, 60),
        'tax_enabled' => $v->bool('tax_enabled', false), 'tax_rate' => $v->num('tax_rate', false, 0, 100) ?? '0',
        'invoice_footer' => $v->str('invoice_footer', false, 0, 1000), 'bank_details' => $v->str('bank_details', false, 0, 1000), 'map_embed_url' => $v->str('map_embed_url', false, 0, 600)];
    $v->done();
    foreach (['phones', 'emails'] as $k) if (array_key_exists($k, $r->body)) {
        $a = $r->body[$k]; if (is_string($a)) $a = array_values(array_filter(array_map('trim', preg_split('/[,\n]/', $a))));
        if (!is_array($a)) throw new ApiException('VALIDATION', "$k must be a list", 422, [$k => 'Invalid']);
        if ($k === 'emails') foreach ($a as $m) if (!filter_var($m, FILTER_VALIDATE_EMAIL)) throw new ApiException('VALIDATION', 'Invalid email in list', 422, ['emails' => 'Invalid email']);
        $row[$k] = jsonCol(array_values($a));
    }
    foreach (['map_embed_url', 'facebook_url', 'youtube_url', 'website_url'] as $k) if (!empty($row[$k]) && !preg_match('#^https://#i', $row[$k])) throw new ApiException('VALIDATION', 'URL must start with https://', 422, [$k => 'Use https://']);
    Db::update('company_settings', 1, $row);
    Audit::log('company_settings', 'UPDATE', 1);
    Response::ok(Shape::settings(Db::one('SELECT * FROM company_settings WHERE id=1')));
});

function counters(): array { return array_map(fn($c) => ['type' => $c['doc_type'], 'prefix' => $c['prefix'], 'padding' => (int)$c['padding'], 'last_number' => (int)$c['last_number']], Db::all('SELECT doc_type, prefix, last_number, padding FROM doc_counters ORDER BY doc_type')); }
Router::add('GET', '/settings/numbering', 'A', fn(Request $r) => Response::ok(counters()));
Router::add('PUT', '/settings/numbering', 'A', function (Request $r) {
    $rows = $r->body['counters'] ?? $r->body;
    if (!is_array($rows)) throw new ApiException('VALIDATION', 'Send a list of counters', 422);
    Db::tx(function () use ($rows) {
        foreach ($rows as $c) {
            $v = new V(is_array($c) ? $c : []);
            $type = $v->str('type', false, 1, 30) ?? $v->str('doc_type', true, 1, 30); $prefix = $v->str('prefix', true, 1, 10); $pad = $v->int('padding', true, 1); $last = $v->int('last_number', false, 0);
            $v->done();
            if ($pad > 10) throw new ApiException('VALIDATION', 'Padding too large', 422, ['padding' => 'Max 10']);
            $cur = needRow(Db::one('SELECT last_number FROM doc_counters WHERE doc_type=? FOR UPDATE', [$type]), 'Counter');
            if ($last !== null && $last < (int)$cur['last_number']) throw new ApiException('VALIDATION', 'Number can only go up, never down', 422, ['last_number' => 'Cannot be lowered']);
            Db::exec('UPDATE doc_counters SET prefix=?, padding=?, last_number=GREATEST(last_number, ?) WHERE doc_type=?', [$prefix, $pad, $last ?? 0, $type]);
        }
        Audit::log('doc_counters', 'UPDATE', null);
    });
    Response::ok(counters());
});

Router::add('POST', '/settings/logo', 'A', function (Request $r) {
    $old = Db::val('SELECT logo_url FROM company_settings WHERE id=1');
    $url = Upload::image($r->files, 'file', 'brand', true);
    Db::update('company_settings', 1, ['logo_url' => $url]);
    if ($old && str_starts_with((string)$old, '/uploads/')) Upload::deletePublic((string)$old);
    Audit::log('company_settings', 'LOGO', 1);
    Response::ok(['logo_url' => $url]);
});

// ---- users
Router::add('GET', '/users', 'A', fn(Request $r) => Response::ok(Db::all('SELECT id, email, full_name, role, is_active, created_at FROM users ORDER BY id')));
Router::add('POST', '/users', 'A', function (Request $r) {
    $v = new V($r->body);
    $email = $v->email('email', true); $name = $v->str('full_name', true, 2, 160); $pass = $v->str('password', true, 8, 200);
    $role = $v->enum('role', ['admin', 'manager', 'staff'], false, null); $phone = $v->str('phone', false, 0, 30);
    $v->done();
    if (Db::val('SELECT COUNT(*) FROM users WHERE email=?', [$email]) > 0) throw new ApiException('VALIDATION', 'An account with this email already exists', 422, ['email' => 'Already registered']);
    $id = Db::insert('users', ['email' => $email, 'password_hash' => password_hash((string)$pass, PASSWORD_DEFAULT), 'full_name' => $name, 'phone' => $phone, 'role' => $role]);
    Audit::log('users', 'INSERT', $id, ['role' => $role]);
    Response::ok(Db::one('SELECT id, email, full_name, role, is_active, created_at FROM users WHERE id=?', [$id]), null, 201);
});
Router::add('PUT', '/users/{id}', 'A', function (Request $r) {
    $id = (int)$r->params['id']; $cur = needRow(Db::one('SELECT * FROM users WHERE id=?', [$id]), 'User');
    $role = $cur['role']; $active = (int)$cur['is_active']; $name = $cur['full_name'];
    if (array_key_exists('role', $r->body)) {
        $role = $r->body['role'] === null || $r->body['role'] === '' ? null : $r->body['role'];
        if ($role !== null && !in_array($role, ['admin', 'manager', 'staff'], true)) throw new ApiException('VALIDATION', 'Invalid role', 422, ['role' => 'Invalid']);
    }
    if (array_key_exists('is_active', $r->body)) $active = (int)(new V($r->body))->bool('is_active', true);
    if (!empty($r->body['full_name'])) $name = mb_substr(trim((string)$r->body['full_name']), 0, 160);
    $losesAdmin = $cur['role'] === 'admin' && ($role !== 'admin' || !$active);
    if ($losesAdmin && (int)Db::val("SELECT COUNT(*) FROM users WHERE role='admin' AND is_active=1 AND id<>?", [$id]) === 0)
        throw new ApiException('LAST_ADMIN', 'Cannot remove or deactivate the last admin', 409);
    $row = ['role' => $role, 'is_active' => $active, 'full_name' => $name];
    if (!$active || $role !== $cur['role']) $row['token_version'] = (int)$cur['token_version'] + 1;
    Db::update('users', $id, $row);
    Audit::log('users', 'UPDATE', $id, ['role' => $role, 'is_active' => $active]);
    Response::ok(Db::one('SELECT id, email, full_name, role, is_active, created_at FROM users WHERE id=?', [$id]));
});
Router::add('POST', '/users/{id}/reset-password', 'A', function (Request $r) {
    $id = (int)$r->params['id']; needRow(Db::one('SELECT id FROM users WHERE id=?', [$id]), 'User');
    $temp = substr(strtr(base64_encode(random_bytes(12)), '+/=', 'abc'), 0, 12) . random_int(10, 99);
    Db::exec('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?', [password_hash($temp, PASSWORD_DEFAULT), $id]);
    Audit::log('users', 'RESET_PASSWORD', $id);
    Response::ok(['temporary_password' => $temp]);
});

Router::add('GET', '/activity-log', 'A', function (Request $r) {
    [$page, $per, $off] = paging($r, 50, 200);
    $w = ['1=1']; $p = [];
    if ($t = (string)$r->q('table', '')) { $w[] = 'a.table_name=?'; $p[] = $t; }
    if ($u = (int)$r->q('user_id', 0)) { $w[] = 'a.user_id=?'; $p[] = $u; }
    $act = (string)$r->q('action', '');
    if ($act === 'create') $w[] = "a.action IN ('INSERT','REGISTER','IMPORT','FROM_ORDER','OPENING')";
    elseif ($act === 'delete') $w[] = "a.action IN ('DELETE','ARCHIVE')";
    elseif ($act === 'update') $w[] = "a.action NOT IN ('INSERT','REGISTER','IMPORT','FROM_ORDER','OPENING','DELETE','ARCHIVE')";
    dateRange($r, 'DATE(a.created_at)', $w, $p);
    $where = implode(' AND ', $w);
    $total = (int)Db::val("SELECT COUNT(*) FROM activity_log a WHERE $where", $p);
    $rows = Db::all("SELECT a.*, u.full_name AS user_name FROM activity_log a LEFT JOIN users u ON u.id=a.user_id WHERE $where ORDER BY a.id DESC LIMIT $per OFFSET $off", $p);
    listResponse(array_map(function ($x) {
        $a = (string)$x['action'];
        $kind = in_array($a, ['INSERT', 'REGISTER', 'IMPORT', 'FROM_ORDER', 'OPENING'], true) ? 'create' : (in_array($a, ['DELETE', 'ARCHIVE'], true) ? 'delete' : 'update');
        $d = $x['details'] ? json_decode((string)$x['details'], true) : null;
        $sum = ucfirst(strtolower(str_replace('_', ' ', $a))) . ' ' . str_replace('_', ' ', (string)$x['table_name']) . ($d ? ' (' . implode(', ', array_map(fn($k, $v) => $k . ': ' . (is_scalar($v) ? $v : json_encode($v)), array_keys($d), $d)) . ')' : '');
        return ['id' => (int)$x['id'], 'created_at' => $x['created_at'], 'user_id' => $x['user_id'] !== null ? (int)$x['user_id'] : null, 'user_name' => $x['user_name'] ?? 'System', 'action' => $kind,
            'table_name' => $x['table_name'], 'record' => $x['record_id'] !== null ? '#' . $x['record_id'] : '', 'summary' => $sum];
    }, $rows), $page, $per, $total);
});
