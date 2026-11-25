<?php
declare(strict_types=1);

function clientRow(array $c): array { return ['id' => (int)$c['id'], 'name' => $c['name'], 'logo_url' => Shape::nz($c['logo_url']), 'sort_order' => (int)$c['sort_order'], 'is_active' => $c['is_active'], 'permission_confirmed' => $c['permission_confirmed']]; }
function clientFields(Request $r, ?array $cur): array
{
    $v = new V($r->body + ($cur ?? []));
    $name = $v->str('name', true, 2, 160); $url = $v->str('logo_url', false, 0, 400); $sort = $v->int('sort_order') ?? 0;
    $v->done();
    if ($url && !preg_match('#^(https?://|/uploads/|/assets/)#i', $url)) throw new ApiException('VALIDATION', 'Invalid logo URL', 422, ['logo_url' => 'Invalid']);
    if (!empty($r->files['logo'])) { $url = Upload::image($r->files, 'logo', 'clients', true); if ($cur && !empty($cur['logo_url']) && str_starts_with((string)$cur['logo_url'], '/uploads/')) Upload::deletePublic((string)$cur['logo_url']); }
    return ['name' => $name, 'logo_url' => $url, 'sort_order' => $sort, 'is_active' => $v->bool('is_active', true), 'permission_confirmed' => $v->bool('permission_confirmed', false)];
}
Router::add('GET', '/clients', 'M', fn(Request $r) => Response::ok(array_map('clientRow', Db::all('SELECT * FROM clients ORDER BY sort_order, id'))));
Router::add('POST', '/clients', 'M', function (Request $r) {
    $id = Db::insert('clients', clientFields($r, null)); Audit::log('clients', 'INSERT', $id);
    Response::ok(clientRow(Db::one('SELECT * FROM clients WHERE id=?', [$id])), null, 201);
});
Router::add('PUT', '/clients/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id']; $cur = needRow(Db::one('SELECT * FROM clients WHERE id=?', [$id]), 'Client');
    Db::update('clients', $id, clientFields($r, $cur)); Audit::log('clients', 'UPDATE', $id);
    Response::ok(clientRow(Db::one('SELECT * FROM clients WHERE id=?', [$id])));
});
Router::add('DELETE', '/clients/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id']; $c = needRow(Db::one('SELECT * FROM clients WHERE id=?', [$id]), 'Client');
    Db::exec('DELETE FROM clients WHERE id=?', [$id]); if ($c['logo_url'] && str_starts_with((string)$c['logo_url'], '/uploads/')) Upload::deletePublic((string)$c['logo_url']);
    Audit::log('clients', 'DELETE', $id); Response::ok(['ok' => true]);
});

function certRow(array $c): array { return ['id' => (int)$c['id'], 'name' => $c['name'], 'image_url' => $c['logo_url'], 'description' => $c['description'], 'certificate_number' => $c['certificate_no'], 'is_published' => $c['is_published'], 'holder_confirmed' => $c['holder_confirmed']]; }
function certFields(array $body, ?array $cur): array
{
    foreach (['image_url' => 'logo_url', 'certificate_number' => 'certificate_no'] as $from => $to) if (array_key_exists($from, $body)) { $body[$to] = $body[$from]; unset($body[$from]); }
    $v = new V($body + ($cur ?? []));
    $row = ['name' => $v->str('name', true, 2, 200), 'description' => $v->str('description', false, 0, 800), 'logo_url' => $v->str('logo_url', false, 0, 400),
        'certificate_no' => $v->str('certificate_no', false, 0, 80), 'sort_order' => $v->int('sort_order') ?? 0, 'is_published' => $v->bool('is_published', false), 'holder_confirmed' => $v->bool('holder_confirmed', false)];
    $v->done();
    if ($row['is_published'] && !$row['holder_confirmed']) throw new ApiException('VALIDATION', 'Confirm the holder before publishing a certification', 422, ['is_published' => 'Confirm holder first']);
    return $row;
}
Router::add('GET', '/certifications', 'M', fn(Request $r) => Response::ok(array_map('certRow', Db::all('SELECT * FROM certifications ORDER BY sort_order, id'))));
Router::add('POST', '/certifications', 'M', function (Request $r) {
    $id = Db::insert('certifications', certFields($r->body, null)); Audit::log('certifications', 'INSERT', $id);
    Response::ok(certRow(Db::one('SELECT * FROM certifications WHERE id=?', [$id])), null, 201);
});
Router::add('PUT', '/certifications/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id']; $cur = needRow(Db::one('SELECT * FROM certifications WHERE id=?', [$id]), 'Certification');
    Db::update('certifications', $id, certFields($r->body, $cur)); Audit::log('certifications', 'UPDATE', $id);
    Response::ok(certRow(Db::one('SELECT * FROM certifications WHERE id=?', [$id])));
});
Router::add('DELETE', '/certifications/{id}', 'M', function (Request $r) {
    $id = (int)$r->params['id']; needRow(Db::one('SELECT id FROM certifications WHERE id=?', [$id]), 'Certification');
    Db::exec('DELETE FROM certifications WHERE id=?', [$id]); Audit::log('certifications', 'DELETE', $id); Response::ok(['ok' => true]);
});
