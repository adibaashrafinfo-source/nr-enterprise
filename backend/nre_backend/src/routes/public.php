<?php
declare(strict_types=1);

Router::add('GET', '/public/settings', 'P', function (Request $r) {
    $s = Db::one('SELECT * FROM company_settings WHERE id=1') ?: [];
    $o = $s ? Shape::settings($s) : [];
    unset($o['bin'], $o['tin'], $o['trade_licence'], $o['bank_details'], $o['invoice_footer'], $o['tax_enabled'], $o['tax_rate']);
    Response::ok($o, null, 200, true);
});

Router::add('GET', '/public/categories', 'P', function (Request $r) {
    $rows = Db::all('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id AND p.is_active=1 AND p.show_on_website=1) AS product_count
        FROM categories c WHERE c.is_active=1 ORDER BY c.sort_order, c.id');
    Response::ok(array_map(fn($c) => Shape::category(array_diff_key($c, ['is_active' => 1])), $rows), null, 200, true);
});

Router::add('GET', '/public/products', 'P', function (Request $r) {
    [$page, $per, $off] = paging($r, 12, 48);
    $w = ['p.is_active=1', 'p.show_on_website=1', 'c.is_active=1']; $p = [];
    if ($cat = (string)$r->q('category', '')) { $w[] = 'c.slug=?'; $p[] = $cat; }
    if ($q = trim((string)$r->q('q', ''))) { $w[] = '(p.name LIKE ? OR p.code LIKE ?)'; $p[] = like($q); $p[] = like($q); }
    if ($r->q('featured') === '1') $w[] = 'p.is_featured=1';
    $where = implode(' AND ', $w);
    $total = (int)Db::val("SELECT COUNT(*) FROM products p JOIN categories c ON c.id=p.category_id WHERE $where", $p);
    $rows = Db::all('SELECT ' . Shape::PRODUCT_SELECT . " FROM products p JOIN categories c ON c.id=p.category_id WHERE $where ORDER BY p.sort_order, p.id LIMIT $per OFFSET $off", $p);
    Response::ok(array_map([Shape::class, 'productSummary'], $rows), ['page' => $page, 'per_page' => $per, 'total' => $total], 200, true);
});

Router::add('GET', '/public/products/{slug}', 'P', function (Request $r) {
    $p = Db::one('SELECT ' . Shape::PRODUCT_SELECT . ', p.description, p.features, p.specs FROM products p JOIN categories c ON c.id=p.category_id WHERE p.slug=? AND p.is_active=1 AND p.show_on_website=1 AND c.is_active=1', [$r->params['slug']]);
    if (!$p) throw new ApiException('NOT_FOUND', 'Product not found', 404);
    $o = Shape::productSummary($p);
    $o['description'] = Shape::nz($p['description']); $o['features'] = Shape::list($p['features']); $o['specs'] = Shape::obj($p['specs']);
    $o['images'] = Shape::images((int)$p['id']);
    $o['variants'] = array_map(fn($v) => ['id' => (int)$v['id'], 'name' => $v['name'], 'color' => $v['color'], 'size' => $v['size'], 'material' => $v['material'], 'pack_size' => $v['pack_size']],
        Db::all('SELECT v.id, COALESCE(v.name,p.name) AS name, v.color, v.size, v.material, v.pack_size FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.product_id=? AND v.is_active=1 ORDER BY v.id', [$p['id']]));
    $o['related'] = array_map([Shape::class, 'productSummary'], Db::all('SELECT ' . Shape::PRODUCT_SELECT . ' FROM products p JOIN categories c ON c.id=p.category_id
        WHERE p.category_id=? AND p.id<>? AND p.is_active=1 AND p.show_on_website=1 ORDER BY p.sort_order LIMIT 4', [$p['cat_id'], $p['id']]));
    Response::ok($o, null, 200, true);
});

Router::add('GET', '/public/clients', 'P', fn(Request $r) => Response::ok(array_map(fn($c) => ['id' => (int)$c['id'], 'name' => $c['name'], 'logo_url' => Shape::nz($c['logo_url'])],
    Db::all('SELECT id, name, logo_url FROM clients WHERE is_active=1 ORDER BY sort_order, id')), null, 200, true));
Router::add('GET', '/public/certifications', 'P', fn(Request $r) => Response::ok(array_map(fn($c) => ['id' => (int)$c['id'], 'name' => $c['name'], 'image_url' => $c['logo_url']],
    Db::all('SELECT id, name, logo_url FROM certifications WHERE is_published=1 ORDER BY sort_order, id')), null, 200, true));

Router::add('POST', '/public/enquiries', 'P', function (Request $r) {
    $ip = $r->ip();
    if (trim((string)$r->in('website', '')) !== '') Response::ok(['ok' => true]); // honeypot: pretend success, store nothing
    if (RateLimit::tooMany('enquiry', $ip, 5, 3600)) throw new ApiException('RATE_LIMIT', 'Too many requests. Please try again later or call us.', 429);
    $v = new V($r->body);
    $name = $v->str('name', true, 2, 120); $company = $v->str('company', false, 0, 160); $phone = $v->str('phone', true, 6, 30);
    $email = $v->email('email'); $cat = $v->int('category_id', false, 1); $prod = $v->int('product_id', false, 1);
    $qty = $v->str('quantity', false, 0, 80); $req = $v->date('required_date'); $msg = $v->str('message', false, 0, 2000);
    $sample = $v->bool('wants_sample');
    if ($phone !== null && !preg_match('/^[0-9+\-\s()]{6,30}$/', $phone)) $v->fail('phone', 'Enter a valid phone number');
    if ($req !== null && $req < date('Y-m-d')) $v->fail('required_date', 'Date cannot be in the past');
    $v->done();
    if ($cat && !Db::one('SELECT id FROM categories WHERE id=? AND is_active=1', [$cat])) throw new ApiException('VALIDATION', 'Invalid category', 422, ['category_id' => 'Invalid']);
    if ($prod && !Db::one('SELECT id FROM products WHERE id=? AND is_active=1', [$prod])) throw new ApiException('VALIDATION', 'Invalid product', 422, ['product_id' => 'Invalid']);
    $file = Upload::privateFile($r->files, 'file', 'enquiries');
    RateLimit::hit('enquiry', $ip, true);
    $id = Db::insert('enquiries', ['name' => $name, 'company' => $company, 'phone' => $phone, 'email' => $email, 'category_id' => $cat, 'product_id' => $prod,
        'quantity' => $qty, 'required_date' => $req, 'message' => $msg, 'attachment_path' => $file, 'wants_sample' => $sample, 'ip_address' => $ip]);
    if ($to = (string)Config::get('ENQUIRY_NOTIFY_TO', '')) Mailer::send($to, 'New enquiry from ' . $name, "Name: $name\nCompany: $company\nPhone: $phone\nEmail: $email\nQuantity: $qty\nMessage: $msg\n");
    Response::ok(['id' => $id, 'ok' => true], null, 201);
});

// Deploy check. Needs ?key=HEALTHCHECK_KEY. Not part of the 117 documented endpoints.
Router::add('GET', '/health', 'P', function (Request $r) {
    $key = (string)Config::get('HEALTHCHECK_KEY', '');
    if ($key === '' || !hash_equals($key, (string)$r->q('key', ''))) throw new ApiException('NOT_FOUND', 'Endpoint not found', 404);
    $w = fn(string $d) => is_dir($d) && is_writable($d);
    $db = true; try { Db::val('SELECT 1'); } catch (Throwable) { $db = false; }
    $checks = [
        'php_version' => PHP_VERSION, 'php_ok' => PHP_VERSION_ID >= 80100, 'pdo_mysql' => extension_loaded('pdo_mysql'), 'gd' => extension_loaded('gd'),
        'fileinfo' => extension_loaded('fileinfo'), 'mbstring' => extension_loaded('mbstring'), 'db' => $db,
        'uploads_writable' => $w(Upload::uploadsDir()), 'storage_writable' => $w(Upload::storageDir()), 'logs_writable' => $w(Upload::storageDir() . '/logs'),
        'https' => (($_SERVER['HTTPS'] ?? '') === 'on') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'),
        'app_env' => Config::get('APP_ENV'), 'registration_open' => (bool)Config::get('ALLOW_REGISTRATION', false),
        'tables' => $db ? (int)Db::val('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()') : 0,
        'users' => $db ? (int)Db::val('SELECT COUNT(*) FROM users') : 0,
    ];
    $checks['all_ok'] = $checks['php_ok'] && $checks['pdo_mysql'] && $checks['gd'] && $checks['fileinfo'] && $checks['db'] && $checks['uploads_writable'] && $checks['storage_writable'];
    Response::ok($checks);
});
