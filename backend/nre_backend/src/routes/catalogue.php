<?php
declare(strict_types=1);

function categoryFields(array $d, ?array $cur): array
{
    $d = $d + ($cur ?? []);
    $v = new V($d);
    $name = $v->str('name', true, 2, 120); $slug = $v->str('slug', false, 0, 140); $desc = $v->str('description', false, 0, 1000);
    $img = $v->str('image_url', false, 0, 400); $sort = $v->int('sort_order') ?? 0; $active = $v->bool('is_active', true);
    $v->done();
    return ['name' => $name, 'slug' => uniqueSlug('categories', $slug ?: (string)$name, $cur ? (int)$cur['id'] : null), 'description' => $desc, 'image_url' => $img, 'sort_order' => $sort, 'is_active' => $active];
}
function categoryById(int $id): array
{
    return Shape::category(needRow(Db::one('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) AS product_count FROM categories c WHERE c.id=?', [$id]), 'Category'));
}

Router::add('GET', '/categories', 'S', fn(Request $r) => Response::ok(array_map([Shape::class, 'category'], Db::all('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id=c.id) AS product_count FROM categories c ORDER BY c.sort_order, c.id'))));
Router::add('POST', '/categories', 'M', function (Request $r) {
    $id = Db::insert('categories', categoryFields($r->body, null)); Audit::log('categories', 'INSERT', $id);
    Response::ok(categoryById($id), null, 201);
});
Router::add('PUT', '/categories/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id']; $cur = needRow(Db::one('SELECT * FROM categories WHERE id=?', [$id]), 'Category');
    Db::update('categories', $id, categoryFields($r->body, $cur)); Audit::log('categories', 'UPDATE', $id);
    Response::ok(categoryById($id));
});
Router::add('DELETE', '/categories/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id']; needRow(Db::one('SELECT id FROM categories WHERE id=?', [$id]), 'Category');
    if ((int)Db::val('SELECT COUNT(*) FROM products WHERE category_id=?', [$id]) > 0) throw new ApiException('IN_USE', 'Category has products. Move or remove them first.', 409);
    Db::exec('DELETE FROM categories WHERE id=?', [$id]); Audit::log('categories', 'DELETE', $id);
    Response::ok(['ok' => true]);
});

Router::add('GET', '/units', 'S', fn(Request $r) => Response::ok(array_map(fn($u) => ['code' => $u['code'], 'name' => $u['name'], 'is_active' => true], Db::all('SELECT code, name FROM units ORDER BY code'))));
Router::add('POST', '/units', 'M', function (Request $r) {
    $v = new V($r->body); $code = $v->str('code', true, 1, 20); $name = $v->str('name', true, 1, 60); $v->done();
    Db::exec('INSERT INTO units (code,name) VALUES (?,?) ON DUPLICATE KEY UPDATE name=VALUES(name)', [$code, $name]);
    Response::ok(['code' => $code, 'name' => $name, 'is_active' => true], null, 201);
});

function productFields(array $d, ?array $cur): array
{
    $d = $d + ($cur ?? []);
    $v = new V($d);
    $name = $v->str('name', true, 2, 200); $slug = $v->str('slug', false, 0, 220); $code = $v->str('code', false, 0, 40);
    $cat = $v->int('category_id', true, 1); $unit = $v->str('unit_code', false, 0, 20) ?? 'pcs'; $moq = $v->num('moq', false, 0);
    $short = $v->str('short_description', false, 0, 400); $desc = $v->str('description', false, 0, 8000);
    $seoT = $v->str('seo_title', false, 0, 200); $seoD = $v->str('seo_description', false, 0, 400);
    $v->done();
    if (!Db::one('SELECT id FROM categories WHERE id=?', [$cat])) throw new ApiException('VALIDATION', 'Category not found', 422, ['category_id' => 'Not found']);
    if (!Db::one('SELECT code FROM units WHERE code=?', [$unit])) throw new ApiException('VALIDATION', 'Unit not found', 422, ['unit_code' => 'Not found']);
    $features = $d['features'] ?? null; $specs = $d['specs'] ?? null;
    if (is_string($features)) $features = json_decode($features, true);
    if (is_string($specs)) $specs = json_decode($specs, true);
    if ($features !== null && !is_array($features)) throw new ApiException('VALIDATION', 'features must be a list', 422, ['features' => 'Invalid']);
    if ($specs !== null && !is_array($specs)) throw new ApiException('VALIDATION', 'specs must be an object', 422, ['specs' => 'Invalid']);
    return [
        'name' => $name, 'slug' => uniqueSlug('products', $slug ?: (string)$name, $cur ? (int)$cur['id'] : null), 'code' => $code, 'category_id' => $cat,
        'unit_code' => $unit, 'moq' => $moq, 'short_description' => $short, 'description' => $desc,
        'features' => jsonCol($features ? array_values($features) : []), 'specs' => jsonCol($specs ?: new stdClass()),
        'is_active' => $v->bool('is_active', true), 'show_on_website' => $v->bool('show_on_website', true), 'is_featured' => $v->bool('is_featured', false),
        'sort_order' => $v->int('sort_order') ?? 0, 'seo_title' => $seoT, 'seo_description' => $seoD,
    ];
}
const ADMIN_PRODUCT_EXTRA = ', (SELECT COUNT(*) FROM product_variants v WHERE v.product_id=p.id) AS variant_count,
    (SELECT COALESCE(SUM(m.quantity),0) FROM stock_movements m JOIN product_variants v ON v.id=m.variant_id WHERE v.product_id=p.id) AS total_stock';
function adminSummary(array $r): array { return Shape::productSummary($r) + ['variant_count' => (int)$r['variant_count'], 'total_stock' => Shape::dec($r['total_stock'], 3), 'show_on_website' => $r['show_on_website'], 'is_active' => $r['is_active']]; }
function adminProduct(int $id): array
{
    $p = needRow(Db::one('SELECT ' . Shape::PRODUCT_SELECT . ADMIN_PRODUCT_EXTRA . ', p.description, p.features, p.specs, p.seo_title, p.seo_description FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id=?', [$id]), 'Product');
    $o = adminSummary($p);
    $o['description'] = Shape::nz($p['description']); $o['features'] = Shape::list($p['features']); $o['specs'] = Shape::obj($p['specs']);
    $o['seo_title'] = $p['seo_title']; $o['seo_description'] = $p['seo_description'];
    $o['images'] = Shape::images($id); $o['variants'] = CatalogueService::variantsOf($id, true, Auth::isManager()); $o['related'] = [];
    return $o;
}

Router::add('GET', '/products', 'S', function (Request $r) {
    [$page, $per, $off] = paging($r, 25, 100);
    $w = ['1=1']; $p = [];
    if ($q = trim((string)$r->q('q', ''))) { $w[] = '(p.name LIKE ? OR p.code LIKE ? OR EXISTS (SELECT 1 FROM product_variants x WHERE x.product_id=p.id AND x.sku LIKE ?))'; $p = array_merge($p, [like($q), like($q), like($q)]); }
    if ($c = (int)$r->q('category_id', 0)) { $w[] = 'p.category_id=?'; $p[] = $c; }
    $st = (string)$r->q('status', ''); if ($st === 'active') $w[] = 'p.is_active=1'; elseif ($st === 'archived') $w[] = 'p.is_active=0';
    $where = implode(' AND ', $w);
    $total = (int)Db::val("SELECT COUNT(*) FROM products p WHERE $where", $p);
    $rows = Db::all('SELECT ' . Shape::PRODUCT_SELECT . ADMIN_PRODUCT_EXTRA . " FROM products p JOIN categories c ON c.id=p.category_id WHERE $where ORDER BY " . sortBy($r, ['name' => 'p.name', 'id' => 'p.id'], 'p.sort_order, p.id') . " LIMIT $per OFFSET $off", $p);
    listResponse(array_map('adminSummary', $rows), $page, $per, $total);
});

/** Insert one product (+ variants) from a frontend {product, variants[]} row. */
function createProductWithVariants(array $prod, array $variants): int
{
    $f = productFields($prod, null);
    $pid = Db::insert('products', $f);
    foreach ($variants as $vr) CatalogueService::saveVariant(null, $pid, $vr, Auth::isManager());
    return $pid;
}

Router::add('POST', '/products/import', 'M', function (Request $r) {
    $rows = $r->body['rows'] ?? null;
    if (!is_array($rows) || !$rows) throw new ApiException('VALIDATION', 'Send {rows: [...]}', 422);
    if (count($rows) > 500) throw new ApiException('VALIDATION', 'At most 500 rows per import', 422);
    $errors = []; $seenSku = [];
    foreach (array_values($rows) as $i => $row) {
        try {
            $prod = is_array($row['product'] ?? null) ? $row['product'] : (is_array($row) ? $row : []);
            productFields($prod, null);
            foreach (($row['variants'] ?? []) as $vr) {
                $vv = new V(is_array($vr) ? $vr : []); $sku = $vv->str('sku', true, 1, 60); $vv->num('selling_price', false, 0); $vv->done();
                if (isset($seenSku[$sku]) || Db::val('SELECT COUNT(*) FROM product_variants WHERE sku=?', [$sku]) > 0) throw new ApiException('VALIDATION', "SKU $sku already exists", 422, ['sku' => 'Duplicate']);
                $seenSku[$sku] = 1;
            }
        } catch (ApiException $e) { $errors[] = ['row' => $i + 1, 'message' => $e->getMessage(), 'fields' => $e->fields ?: new stdClass()]; }
    }
    if ($errors) Response::ok(['created' => 0, 'errors' => $errors]);
    $n = Db::tx(function () use ($rows) { $n = 0; foreach (array_values($rows) as $row) { createProductWithVariants(is_array($row['product'] ?? null) ? $row['product'] : $row, is_array($row['variants'] ?? null) ? $row['variants'] : []); $n++; } Audit::log('products', 'IMPORT', null, ['rows' => $n]); return $n; });
    Response::ok(['created' => $n, 'errors' => []], null, 201);
});

Router::add('POST', '/products', 'M', function (Request $r) {
    $id = Db::tx(function () use ($r) { $id = createProductWithVariants($r->body, []); Audit::log('products', 'INSERT', $id); return $id; });
    Response::ok(adminProduct($id), null, 201);
});
Router::add('GET', '/products/{id}', 'S', fn(Request $r) => Response::ok(adminProduct((int)$r->params['id'])));
Router::add('PUT', '/products/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id']; $cur = needRow(Db::one('SELECT * FROM products WHERE id=?', [$id]), 'Product');
    Db::update('products', $id, productFields($r->body, $cur)); Audit::log('products', 'UPDATE', $id);
    Response::ok(adminProduct($id));
});
Router::add('DELETE', '/products/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id']; needRow(Db::one('SELECT id FROM products WHERE id=?', [$id]), 'Product');
    $used = (int)Db::val('SELECT (SELECT COUNT(*) FROM stock_movements m JOIN product_variants v ON v.id=m.variant_id WHERE v.product_id=?)
        + (SELECT COUNT(*) FROM invoice_items i JOIN product_variants v ON v.id=i.variant_id WHERE v.product_id=?)
        + (SELECT COUNT(*) FROM sales_order_items i JOIN product_variants v ON v.id=i.variant_id WHERE v.product_id=?)
        + (SELECT COUNT(*) FROM purchase_order_items i JOIN product_variants v ON v.id=i.variant_id WHERE v.product_id=?)', [$id, $id, $id, $id]);
    if ($used > 0) { Db::update('products', $id, ['is_active' => 0]); Audit::log('products', 'ARCHIVE', $id); Response::ok(['ok' => true, 'archived' => true]); }
    foreach (Db::all('SELECT url FROM product_images WHERE product_id=?', [$id]) as $im) Upload::deletePublic((string)$im['url']);
    Db::tx(function () use ($id) { Db::exec('DELETE FROM product_images WHERE product_id=?', [$id]); Db::exec('DELETE FROM variant_costs WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id=?)', [$id]); Db::exec('DELETE FROM product_variants WHERE product_id=?', [$id]); Db::exec('DELETE FROM products WHERE id=?', [$id]); });
    Audit::log('products', 'DELETE', $id);
    Response::ok(['ok' => true, 'archived' => false]);
});

Router::add('POST', '/products/{id}/images', 'M', function (Request $r) {
    $id = (int)$r->params['id']; needRow(Db::one('SELECT id FROM products WHERE id=?', [$id]), 'Product');
    $url = Upload::image($r->files, 'file', 'products', true);
    $first = (int)Db::val('SELECT COUNT(*) FROM product_images WHERE product_id=?', [$id]) === 0;
    $iid = Db::insert('product_images', ['product_id' => $id, 'url' => $url, 'alt' => $r->in('alt') ? mb_substr((string)$r->in('alt'), 0, 200) : null,
        'sort_order' => (int)Db::val('SELECT COALESCE(MAX(sort_order),0)+1 FROM product_images WHERE product_id=?', [$id]), 'is_primary' => $first ? 1 : 0]);
    Audit::log('product_images', 'INSERT', $iid);
    $im = Db::one('SELECT id, url, sort_order, is_primary FROM product_images WHERE id=?', [$iid]);
    Response::ok(['id' => (int)$im['id'], 'url' => $im['url'], 'is_primary' => $im['is_primary'], 'sort_order' => (int)$im['sort_order']], null, 201);
});
Router::add('PUT', '/products/{id}/images/order', 'M', function (Request $r) {
    $id = (int)$r->params['id']; needRow(Db::one('SELECT id FROM products WHERE id=?', [$id]), 'Product');
    $ids = $r->body['ids'] ?? null; $primary = (int)($r->body['primary_id'] ?? 0);
    if (!is_array($ids)) throw new ApiException('VALIDATION', 'ids must be a list', 422, ['ids' => 'Required']);
    Db::tx(function () use ($id, $ids, $primary) {
        foreach (array_values($ids) as $i => $iid) Db::exec('UPDATE product_images SET sort_order=? WHERE id=? AND product_id=?', [$i, (int)$iid, $id]);
        if ($primary) { Db::exec('UPDATE product_images SET is_primary=0 WHERE product_id=?', [$id]); Db::exec('UPDATE product_images SET is_primary=1 WHERE id=? AND product_id=?', [$primary, $id]); }
    });
    Response::ok(Shape::images($id));
});
Router::add('DELETE', '/product-images/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id']; $im = needRow(Db::one('SELECT * FROM product_images WHERE id=?', [$id]), 'Image');
    Db::exec('DELETE FROM product_images WHERE id=?', [$id]);
    Upload::deletePublic((string)$im['url']);
    if ((int)$im['is_primary']) Db::exec('UPDATE product_images SET is_primary=1 WHERE product_id=? ORDER BY sort_order, id LIMIT 1', [$im['product_id']]);
    Response::ok(['ok' => true]);
});

Router::add('GET', '/variants/search', 'S', function (Request $r) {
    $q = trim((string)$r->q('q', '')); $w = ['v.is_active=1', 'p.is_active=1']; $p = [];
    if ($q !== '') { $w[] = '(v.sku LIKE ? OR v.name LIKE ? OR p.name LIKE ? OR p.code LIKE ?)'; $p = [like($q), like($q), like($q), like($q)]; }
    if ($r->q('in_stock') === '1') $w[] = 'COALESCE(b.qty_on_hand,0) > 0';
    $mgr = Auth::isManager();
    $rows = Db::all('SELECT v.id, v.sku, COALESCE(v.name,p.name) AS display_name, p.unit_code, COALESCE(v.selling_price,p.selling_price,0) AS selling_price, COALESCE(b.qty_on_hand,0) AS qty_on_hand' . ($mgr ? ', l.rate AS last_purchase_rate' : '') . '
        FROM product_variants v JOIN products p ON p.id=v.product_id LEFT JOIN v_stock_balance b ON b.variant_id=v.id ' . ($mgr ? 'LEFT JOIN v_last_purchase_rate l ON l.variant_id=v.id ' : '') . 'WHERE ' . implode(' AND ', $w) . ' ORDER BY p.name, v.sku LIMIT 20', $p);
    Response::ok(array_map(fn($x) => ['id' => (int)$x['id'], 'sku' => $x['sku'], 'display_name' => $x['display_name'], 'unit_code' => $x['unit_code'], 'selling_price' => Shape::dec($x['selling_price']), 'qty_on_hand' => Shape::dec($x['qty_on_hand'], 3)]
        + ($mgr ? ['last_purchase_rate' => $x['last_purchase_rate'] !== null ? Shape::dec($x['last_purchase_rate']) : null] : []), $rows));
});

Router::add('POST', '/products/{id}/variants', 'M', function (Request $r) {
    $pid = (int)$r->params['id']; needRow(Db::one('SELECT id FROM products WHERE id=?', [$pid]), 'Product');
    $id = CatalogueService::saveVariant(null, $pid, $r->body, true);
    Response::ok(CatalogueService::variantById($id, true), null, 201);
});
Router::add('PUT', '/variants/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id']; $cur = needRow(Db::one('SELECT * FROM product_variants WHERE id=?', [$id]), 'Variant');
    CatalogueService::saveVariant($id, (int)$cur['product_id'], $r->body + ['is_active' => $cur['is_active']], true);
    Response::ok(CatalogueService::variantById($id, true));
});
Router::add('DELETE', '/variants/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id']; needRow(Db::one('SELECT id FROM product_variants WHERE id=?', [$id]), 'Variant');
    $used = (int)Db::val('SELECT (SELECT COUNT(*) FROM stock_movements WHERE variant_id=?) + (SELECT COUNT(*) FROM invoice_items WHERE variant_id=?) + (SELECT COUNT(*) FROM sales_order_items WHERE variant_id=?) + (SELECT COUNT(*) FROM purchase_order_items WHERE variant_id=?)', [$id, $id, $id, $id]);
    if ($used > 0) { Db::update('product_variants', $id, ['is_active' => 0]); Audit::log('product_variants', 'ARCHIVE', $id); Response::ok(['ok' => true, 'archived' => true]); }
    Db::tx(function () use ($id) { Db::exec('DELETE FROM variant_costs WHERE variant_id=?', [$id]); Db::exec('DELETE FROM product_variants WHERE id=?', [$id]); });
    Audit::log('product_variants', 'DELETE', $id);
    Response::ok(['ok' => true, 'archived' => false]);
});
