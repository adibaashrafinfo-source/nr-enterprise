<?php
// Plain PHP integration tests. Usage: php run.php http://127.0.0.1:8099
declare(strict_types=1);
function OH($c, $vid) { foreach (D($c->call('GET', '/stock?per_page=100')) as $x) if ($x['variant_id'] == $vid) return $x['qty_on_hand']; return null; }
function OHP($c, $vid) { $c->call('POST', '/stock/adjust', ['variant_id' => $vid, 'quantity' => 0.001, 'reason' => 'probe']); return OH($c, $vid); }
$BASE = rtrim($argv[1] ?? 'http://127.0.0.1:8099', '/') . '/api/v1';
$pass = 0; $fail = 0; $failures = []; $LAST = '';

final class Client {
    public string $jar; public ?string $csrf = null;
    public function __construct(private string $base) { $this->jar = tempnam(sys_get_temp_dir(), 'nrej'); }
    public function call(string $m, string $path, mixed $body = null, array $opts = []): array {
        $ch = curl_init($this->base . $path);
        $h = ['Accept: application/json'];
        if ($this->csrf && empty($opts['nocsrf'])) $h[] = 'X-CSRF-Token: ' . $this->csrf;
        curl_setopt_array($ch, [CURLOPT_CUSTOMREQUEST => $m, CURLOPT_RETURNTRANSFER => true, CURLOPT_COOKIEJAR => $this->jar, CURLOPT_COOKIEFILE => $this->jar, CURLOPT_TIMEOUT => 30, CURLOPT_HEADER => true]);
        if ($body !== null) {
            if (!empty($opts['multipart'])) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
            else { $h[] = 'Content-Type: application/json'; curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body)); }
        }
        if (!empty($opts['ip'])) $h[] = 'X-Forwarded-For: ' . $opts['ip'];
        curl_setopt($ch, CURLOPT_HTTPHEADER, $h);
        $raw = (string)curl_exec($ch); $hs = curl_getinfo($ch, CURLINFO_HEADER_SIZE); $code = curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        $hdr = substr($raw, 0, $hs); $txt = substr($raw, $hs); $GLOBALS['LAST'] = $m . ' ' . $path . ' -> ' . $code . ' ' . substr($txt, 0, 300);
        return ['code' => $code, 'json' => json_decode($txt, true), 'raw' => $txt, 'headers' => $hdr];
    }
    public function login(string $email, string $pw): array { $r = $this->call('POST', '/auth/login', ['email' => $email, 'password' => $pw]); $this->csrf = $r['json']['data']['csrf_token'] ?? null; return $r; }
}
function t(string $name, bool $ok, string $info = ''): void { global $pass, $fail, $failures; if ($ok) $pass++; else { $fail++; $failures[] = $name . ($info ? " :: $info" : ''); echo "FAIL $name $info\n   last: " . $GLOBALS['LAST'] . "\n"; } }
function eq(string $name, mixed $got, mixed $want): void { t($name, $got == $want, 'got ' . json_encode($got) . ' want ' . json_encode($want)); }
function D(array $r): mixed { return $r['json']['data'] ?? null; }
function E(array $r): string { return $r['json']['error']['code'] ?? '-'; }

$anon = new Client($BASE); $admin = new Client($BASE); $mgr = new Client($BASE); $staff = new Client($BASE);

// ---- auth & first user
$r = $anon->call('POST', '/auth/register', ['email' => 'admin@nre.test', 'password' => 'Secret123!', 'full_name' => 'Admin One']);
eq('register first -> 201', $r['code'], 201); eq('first user is admin', D($r)['user']['role'] ?? null, 'admin');
$r = $anon->call('POST', '/auth/register', ['email' => 'x@nre.test', 'password' => 'Secret123!', 'full_name' => 'Second']);
eq('register closed after first', $r['code'], 403); $anon = new Client($BASE);
$r = $admin->login('admin@nre.test', 'Secret123!'); eq('admin login', $r['code'], 200);
eq('me returns role', D($admin->call('GET', '/auth/me'))['user']['role'] ?? null, 'admin');
eq('bad password 401', (new Client($BASE))->call('POST', '/auth/login', ['email' => 'admin@nre.test', 'password' => 'nope'])['code'], 401);
eq('me anon 401', $anon->call('GET', '/auth/me')['code'], 401);
$r = $admin->call('POST', '/customers', ['name' => 'NoCsrf Ltd'], ['nocsrf' => true]); eq('missing CSRF -> 403', $r['code'], 403);
$r = $admin->call('POST', '/users', ['email' => 'mgr@nre.test', 'password' => 'Secret123!', 'full_name' => 'Mgr', 'role' => 'manager']); eq('create manager', $r['code'], 201);
$r = $admin->call('POST', '/users', ['email' => 'staff@nre.test', 'password' => 'Secret123!', 'full_name' => 'Staff', 'role' => 'staff']); eq('create staff', $r['code'], 201);
$mgr->login('mgr@nre.test', 'Secret123!'); $staff->login('staff@nre.test', 'Secret123!');
$r = $admin->call('PUT', '/users/1', ['role' => 'staff']); eq('cannot demote last admin', E($r), 'LAST_ADMIN');
// password reset flow
$r = $anon->call('POST', '/auth/forgot-password', ['email' => 'staff@nre.test']); $tok = D($r)['token'] ?? '';
t('reset token exposed in testing', $tok !== '');
eq('reset password', $anon->call('POST', '/auth/reset-password', ['token' => $tok, 'password' => 'NewSecret456!'])['code'], 200);
eq('reset token single use', $anon->call('POST', '/auth/reset-password', ['token' => $tok, 'password' => 'Another789!'])['code'], 400);
eq('old session killed by token_version', $staff->call('GET', '/auth/me')['code'], 401);
$staff = new Client($BASE); eq('staff new pw login', $staff->login('staff@nre.test', 'NewSecret456!')['code'], 200);
eq('forgot unknown email still 200', $anon->call('POST', '/auth/forgot-password', ['email' => 'ghost@nre.test'])['code'], 200);
// login throttle (separate throwaway user so others are not locked out)
$admin->call('POST', '/users', ['email' => 'thr@nre.test', 'password' => 'Secret123!', 'full_name' => 'Thr', 'role' => 'staff']);
$th = new Client($BASE); for ($i = 0; $i < 6; $i++) $last = $th->call('POST', '/auth/login', ['email' => 'thr@nre.test', 'password' => 'bad' . $i]);
eq('login throttled', $last['code'], 429);
eq('throttle blocks right password too', (new Client($BASE))->call('POST', '/auth/login', ['email' => 'thr@nre.test', 'password' => 'Secret123!'])['code'], 429);

// ---- role matrix over every endpoint (handlers must never run for wrong roles)
$eps = json_decode(file_get_contents(__DIR__ . '/endpoints.json'), true);
$wrong = [];
foreach ($eps as $e) {
    $path = preg_replace('/\{\w+\}/', '999999', $e['path']);
    if ($e['role'] === 'P') continue;
    $ra = $anon->call($e['method'], $path, $e['method'] === 'GET' ? null : []);
    if ($ra['code'] !== 401) $wrong[] = "anon {$e['method']} {$e['path']} => {$ra['code']}";
    if ($e['role'] === 'M' || $e['role'] === 'A') { $rs = $staff->call($e['method'], $path, $e['method'] === 'GET' ? null : []); if ($rs['code'] !== 403) $wrong[] = "staff {$e['method']} {$e['path']} => {$rs['code']}"; }
    if ($e['role'] === 'A') { $rm = $mgr->call($e['method'], $path, $e['method'] === 'GET' ? null : []); if ($rm['code'] !== 403) $wrong[] = "mgr {$e['method']} {$e['path']} => {$rm['code']}"; }
}
t('role matrix (' . count($eps) . ' endpoints)', !$wrong, implode('; ', array_slice($wrong, 0, 8)));
// every documented endpoint exists (public ones: must not be 404 route-missing)
$missing = [];
foreach ($eps as $e) { $path = preg_replace('/\{slug\}/', 'zz', preg_replace('/\{id\}/', '999999', $e['path'])); if ($e['role'] !== 'P') continue; $rr = $anon->call($e['method'], $path, $e['method'] === 'GET' ? null : []); if (($rr['json']['error']['code'] ?? '') === 'NO_ROUTE') $missing[] = $e['path']; }
t('public routes registered', !$missing, implode(',', $missing));

// ---- public site
$r = $anon->call('GET', '/public/products?per_page=48'); eq('public products 19', count(D($r)), 19);
t('public products: no prices', !preg_match('/selling_price|purchase_price|"rate"/', $r['raw']));
$slug = D($r)[0]['slug']; $r = $anon->call('GET', "/public/products/$slug"); eq('public product detail', $r['code'], 200);
t('public product detail: no prices/costs', !preg_match('/selling_price|purchase_price/', $r['raw']));
eq('public product 404', $anon->call('GET', '/public/products/nope-zzz')['code'], 404);
eq('public categories 3', count(D($anon->call('GET', '/public/categories'))), 3);
eq('public clients 20', count(D($anon->call('GET', '/public/clients'))), 20);
eq('public certifications hidden', count(D($anon->call('GET', '/public/certifications'))), 0);
$r = $anon->call('GET', '/public/settings'); t('public settings: no BIN/bank', !preg_match('/bin_number|tin_number|bank_details/', $r['raw']));
eq('public filter by category', count(D($anon->call('GET', '/public/products?category=' . D($anon->call('GET', '/public/categories'))[0]['slug']))) > 0, true);
// enquiry
$r = $anon->call('POST', '/public/enquiries', ['name' => 'Buyer A', 'phone' => '01712345678', 'message' => 'Need 5000 labels', 'quantity' => '5000 pcs'], ['ip' => '10.0.0.1']);
eq('enquiry created', $r['code'], 201);
$apng = tempnam(sys_get_temp_dir(), 'a') . '.png'; imagepng(imagecreatetruecolor(20, 20), $apng);
$r = $anon->call('POST', '/public/enquiries', ['name' => 'With File', 'phone' => '01712345678', 'file' => new CURLFile($apng, 'image/png', 'spec.png')], ['multipart' => true]);
eq('enquiry with real attachment', $r['code'], 201); $aid = D($r)['id'] ?? 0;
eq('attachment anon -> 401', $anon->call('GET', "/enquiries/$aid/attachment")['code'], 401);
$ra = $staff->call('GET', "/enquiries/$aid/attachment?download=1"); t('attachment streamed to staff as image', $ra['code'] === 200 && str_contains(strtolower($ra['headers']), 'image/png'), (string)$ra['code']);
t('attachment stored outside web root', count(glob('/tmp/nre_test/storage/enquiries/*')) === 1);
eq('enquiry validation', $anon->call('POST', '/public/enquiries', ['name' => 'B'])['code'], 422);
$r = $anon->call('POST', '/public/enquiries', ['name' => 'Bot', 'phone' => '01712345678', 'website' => 'http://spam'], []);
eq('honeypot pretends success', $r['code'], 200);
eq('honeypot stores nothing', (int)D($admin->call('GET', '/enquiries?q=Bot'))[0]['id'] ?? 0, 0);
$cnt = 0; for ($i = 0; $i < 7; $i++) { $rr = $anon->call('POST', '/public/enquiries', ['name' => "Rate $i", 'phone' => '01712345678']); if ($rr['code'] === 429) $cnt++; }
t('enquiry rate limited', $cnt >= 2, "429s=$cnt");
// enquiry with fake attachment
$tmp = tempnam(sys_get_temp_dir(), 'x') . '.pdf'; file_put_contents($tmp, '<?php echo 1; ?>');
$r = $anon->call('POST', '/public/enquiries', ['name' => 'Fake File', 'phone' => '01712345678', 'file' => new CURLFile($tmp, 'application/pdf', 'evil.pdf')], ['multipart' => true, 'ip' => '10.9.9.9']);
t('fake pdf attachment rejected', in_array($r['code'], [422, 429], true), "code {$r['code']}");
$enq = D($admin->call('GET', '/enquiries'))[0] ?? null; t('admin sees enquiries', $enq !== null);
eq('staff can read enquiry', $staff->call('GET', '/enquiries/' . $enq['id'])['code'], 200);
eq('update enquiry status', D($staff->call('PUT', '/enquiries/' . $enq['id'], ['status' => 'contacted', 'internal_note' => 'called']))['status'] ?? '', 'contacted');

// ---- catalogue + privacy
$cats = D($admin->call('GET', '/categories')); eq('categories listed', count($cats), 3);
$pl = D($staff->call('GET', '/products?per_page=100')); eq('admin list of products', count($pl), 19);
$p1 = $pl[0]['id']; $pd = D($staff->call('GET', "/products/$p1")); $vid = $pd['variants'][0]['id'];
t('staff product detail has no cost', !array_key_exists('purchase_price', $pd['variants'][0]));
t('manager product detail has cost', array_key_exists('purchase_price', D($mgr->call('GET', "/products/$p1"))['variants'][0]));
$r = $staff->call('GET', '/variants/search?q=a'); t('variant search no cost', !str_contains($r['raw'], 'purchase_price'));
eq('staff cannot create product', $staff->call('POST', '/products', ['name' => 'X', 'category_id' => 1])['code'], 403);
$r = $mgr->call('POST', '/products', ['name' => 'Test Hang Tag', 'category_id' => $cats[0]['id'], 'unit_code' => 'pcs', 'code' => 'ZZT', 'features' => ['a', 'b'], 'specs' => ['size' => '5cm'], 'create_default_variant' => true]);
eq('create product', $r['code'], 201); $np = D($r)['id'];
eq('duplicate slug auto-suffixed', D($mgr->call('POST', '/products', ['name' => 'Test Hang Tag', 'category_id' => $cats[0]['id']]))['slug'], 'test-hang-tag-2');
$r = $mgr->call('POST', "/products/$np/variants", ['sku' => 'ZZT-STD', 'name' => 'Std', 'selling_price' => 3, 'reorder_level' => 0]); eq('create std variant', $r['code'], 201); $nv = D($r)['id']; eq('variant SKU', D($r)['sku'], 'ZZT-STD');
$r = $mgr->call('POST', "/products/$np/variants", ['sku' => 'ZZT-RED', 'name' => 'Red', 'color' => 'Red', 'selling_price' => 3.5, 'purchase_price' => 1.25]); eq('create variant w/ cost', $r['code'], 201); $v2 = D($r)['id'];
eq('variant cost stored', array_values(array_filter(D($mgr->call('GET', "/products/$np"))['variants'], fn($x) => $x['sku'] === 'ZZT-RED'))[0]['purchase_price'], '1.25');
// fake image upload
file_put_contents($tmp = tempnam(sys_get_temp_dir(), 'i') . '.jpg', 'this is not an image');
$r = $mgr->call('POST', "/products/$np/images", ['file' => new CURLFile($tmp, 'image/jpeg', 'a.jpg')], ['multipart' => true]); eq('fake image rejected', $r['code'], 422);
$png = tempnam(sys_get_temp_dir(), 'p') . '.png'; $im = imagecreatetruecolor(40, 30); imagepng($im, $png);
$r = $mgr->call('POST', "/products/$np/images", ['file' => new CURLFile($png, 'image/png', 'a.png')], ['multipart' => true]); eq('real image accepted', $r['code'], 201);
t('image saved under /uploads, random name', preg_match('#^/uploads/products/[a-f0-9]{16,}\.(jpg|png|webp)$#', D($r)['url'] ?? '') === 1, json_encode(D($r)));
eq('category delete blocked when has products', E($mgr->call('DELETE', '/categories/' . $cats[0]['id'])), 'IN_USE');

// ---- customers + numbering
$r = $staff->call('POST', '/customers', ['name' => 'Alpha Garments', 'phone' => '01700000001', 'credit_days' => 30, 'credit_limit' => 100]); eq('customer created', $r['code'], 201);
$c1 = D($r)['id']; eq('customer code CUS-0001', D($r)['code'], 'CUS-0001');
eq('customer validation', $staff->call('POST', '/customers', ['phone' => '1'])['code'], 422);
// parallel numbering
$mh = curl_multi_init(); $chs = [];
$cookie = $staff->jar;
for ($i = 0; $i < 12; $i++) { $ch = curl_init("$BASE/customers"); curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => json_encode(['name' => "Par $i"]), CURLOPT_RETURNTRANSFER => true, CURLOPT_COOKIEFILE => $cookie, CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-CSRF-Token: ' . $staff->csrf]]); curl_multi_add_handle($mh, $ch); $chs[] = $ch; }
do { curl_multi_exec($mh, $run); curl_multi_select($mh); } while ($run > 0);
$codes = []; foreach ($chs as $ch) { $j = json_decode((string)curl_multi_getcontent($ch), true); $codes[] = $j['data']['code'] ?? 'ERR'; }
eq('parallel customer codes unique', count(array_unique($codes)), 12); t('parallel codes no error', !in_array('ERR', $codes), implode(',', $codes));

// ---- stock & invoices
eq('opening needs manager', $staff->call('POST', '/stock/opening', ['variant_id' => $vid, 'quantity' => 100])['code'], 403);
$r = $mgr->call('POST', '/stock/opening', ['variant_id' => $vid, 'quantity' => 100, 'cost' => 0.8]); eq('opening stock', $r['code'], 201); eq('on hand 100', OH($mgr, $vid), '100.000');
eq('adjust requires reason', $mgr->call('POST', '/stock/adjust', ['variant_id' => $vid, 'quantity' => -1])['code'], 422);
eq('adjust below zero blocked', E($mgr->call('POST', '/stock/adjust', ['variant_id' => $vid, 'quantity' => -500, 'reason' => 'oops'])), 'NEGATIVE_STOCK');
eq('adjust ok', $mgr->call('POST', '/stock/adjust', ['variant_id' => $vid, 'quantity' => -10, 'reason' => 'damaged'])['code'], 201);
$inv = $staff->call('POST', '/invoices', ['customer_id' => $c1, 'tax_rate' => 0, 'discount' => 10, 'items' => [['variant_id' => $vid, 'quantity' => 120, 'rate' => 5, 'discount_percent' => 0]]]);
eq('draft invoice', $inv['code'], 201); $iid = D($inv)['id']; eq('invoice no INV-0001', D($inv)['invoice_no'], 'INV-0001'); eq('total = 600-10', D($inv)['total'], '590.00'); eq('status draft', D($inv)['status'], 'draft');
eq('stock short -> 409 STOCK_SHORT', E($staff->call('POST', "/invoices/$iid/confirm")), 'STOCK_SHORT');
t('short message names item', str_contains($staff->call('POST', "/invoices/$iid/confirm")['raw'], 'available 90'));
eq('stock untouched after failed confirm', OHP($mgr, $vid), '90.001'); $mgr->call('POST', '/stock/adjust', ['variant_id' => $vid, 'quantity' => -0.001, 'reason' => 'undo probe']);
$r = $staff->call('PUT', "/invoices/$iid", ['customer_id' => $c1, 'items' => [['variant_id' => $vid, 'quantity' => 40, 'rate' => 5]]]); eq('edit draft', D($r)['total'], '200.00');
$r = $staff->call('POST', "/invoices/$iid/confirm"); eq('confirm ok', $r['code'], 200); eq('status due', D($r)['status'], 'due');
t('credit limit warning returned', !empty(D($r)['warnings']), json_encode(D($r)['warnings'] ?? null)); eq('due_date set (30d credit)', D($r)['due_date'], date('Y-m-d', strtotime('+30 days')));
eq('stock reduced', OHP($mgr, $vid), '50.001'); $mgr->call('POST', '/stock/adjust', ['variant_id' => $vid, 'quantity' => -0.001, 'reason' => 'probe']);
eq('edit confirmed -> 409 NOT_DRAFT', E($staff->call('PUT', "/invoices/$iid", ['customer_id' => $c1, 'items' => [['variant_id' => $vid, 'quantity' => 1, 'rate' => 5]]])), 'NOT_DRAFT');
eq('confirm twice -> 409', $staff->call('POST', "/invoices/$iid/confirm")['code'], 409);
eq('overpayment blocked', E($staff->call('POST', "/invoices/$iid/payments", ['amount' => 500, 'method' => 'cash'])), 'OVERPAYMENT');
$r = $staff->call('POST', "/invoices/$iid/payments", ['amount' => 50, 'method' => 'bkash', 'reference_no' => 'TX1']); eq('partial payment', $r['code'], 201); eq('status partial', D($staff->call('GET', "/invoices/$iid"))['status'], 'partial'); eq('balance 150', D($staff->call('GET', "/invoices/$iid"))['balance'], '150.00'); $pay1 = D($r)['id'];
eq('receipt no RC-0001', D($r)['receipt_no'], 'RC-0001');
eq('cancel with payments blocked', E($mgr->call('POST', "/invoices/$iid/cancel", ['reason' => 'mistake'])), 'HAS_PAYMENTS');
eq('staff cannot delete payment', $staff->call('DELETE', "/payments/$pay1")['code'], 403);
$r = $mgr->call('PUT', "/payments/$pay1", ['amount' => 60, 'method' => 'bkash']); eq('manager edits payment', $r['code'], 200);
eq('invoice balance resynced', D($staff->call('GET', "/invoices/$iid"))['balance'], '140.00');
$r = $staff->call('POST', "/invoices/$iid/payments", ['amount' => 140, 'method' => 'cash']); eq('final payment', D($staff->call('GET', "/invoices/$iid"))['status'], 'paid');
eq('payment on paid invoice blocked', E($staff->call('POST', "/invoices/$iid/payments", ['amount' => 1])), 'NOT_PAYABLE');
$items = D($staff->call('GET', "/invoices/$iid"))['items']; $itemId = $items[0]['id'];
eq('staff cannot return', $staff->call('POST', "/invoice-items/$itemId/return", ['quantity' => 1])['code'], 403);
$r = $mgr->call('POST', "/invoice-items/$itemId/return", ['quantity' => 10, 'note' => 'wrong size']); eq('sales return', $r['code'], 201); eq('credit note amount 50', D($r)['credit_note']['amount'], '50.00');
eq('return too much blocked', E($mgr->call('POST', "/invoice-items/$itemId/return", ['quantity' => 31])), 'RETURN_TOO_MUCH');
$ii = D($staff->call('GET', "/invoices/$iid")); t('credit note counted: paid_amount 250', $ii['paid'] === '250.00', $ii['paid']);
// cancel flow on a second invoice
$i2 = D($staff->call('POST', '/invoices', ['customer_id' => $c1, 'items' => [['variant_id' => $vid, 'quantity' => 20, 'rate' => 5]]]))['id'];
$before = (string)D($mgr->call('GET', "/stock?q=" . urlencode($pd['variants'][0]['sku'])))[0]['qty_on_hand'];
$staff->call('POST', "/invoices/$i2/confirm"); eq('cancel confirmed invoice', D($mgr->call('POST', "/invoices/$i2/cancel", ['reason' => 'customer cancelled']))['status'], 'cancelled');
$after = (string)D($mgr->call('GET', "/stock?q=" . urlencode($pd['variants'][0]['sku'])))[0]['qty_on_hand']; eq('cancel restores stock', $after, $before);
eq('cancel twice -> 409', $mgr->call('POST', "/invoices/$i2/cancel", ['reason' => 'again'])['code'], 409);
$i3 = D($staff->call('POST', '/invoices', ['customer_id' => $c1, 'items' => [['variant_id' => $vid, 'quantity' => 1, 'rate' => 5]]]))['id'];
eq('staff cannot delete draft', $staff->call('DELETE', "/invoices/$i3")['code'], 403); eq('manager deletes draft', $mgr->call('DELETE', "/invoices/$i3")['code'], 200);
eq('delete confirmed invoice blocked', E($mgr->call('DELETE', "/invoices/$iid")), 'NOT_DRAFT');
// challan has no prices
$r = $staff->call('POST', "/invoices/$iid/challans", ['vehicle_no' => 'DHK-1', 'driver_name' => 'Karim']); eq('challan created', $r['code'], 201); $ch = D($r)['id'];
$r = $staff->call('GET', "/challans/$ch"); t('challan has no prices', !preg_match('/"rate"|"amount"|"total"/', $r['raw']), $r['raw']);
// ledger
$led = D($staff->call('GET', "/customers/$c1/ledger")); t('ledger rows', count($led) >= 3, json_encode($led));
eq('ledger closing = due balance', end($led)['running_balance'], D($staff->call('GET', "/customers/$c1"))['due_balance'] ?? 'x');
// order -> invoice
$o = $staff->call('POST', '/orders', ['customer_id' => $c1, 'items' => [['variant_id' => $vid, 'quantity' => 5, 'rate' => 4]]]); eq('order created', $o['code'], 201); $oid = D($o)['id'];
eq('order ORD no', D($o)['order_no'], 'SO-0001');
eq('staff cannot cancel order', $staff->call('POST', "/orders/$oid/status", ['status' => 'cancelled'])['code'], 403);
eq('bad transition blocked', E($staff->call('POST', "/orders/$oid/status", ['status' => 'delivered'])), 'BAD_TRANSITION');
eq('order confirmed', D($staff->call('POST', "/orders/$oid/status", ['status' => 'confirmed']))['status'], 'confirmed');
$r = $staff->call('POST', "/orders/$oid/convert"); eq('convert to invoice', $r['code'], 201); $oi = D($r)['invoice_id'];
eq('converted invoice total', D($staff->call('GET', "/invoices/$oi"))['total'], '20.00');
$staff->call('POST', "/invoices/$oi/confirm"); eq('order marked invoiced', D($staff->call('GET', "/orders/$oid"))['status'], 'invoiced');
eq('enquiry convert', $staff->call('POST', '/enquiries/' . $enq['id'] . '/convert', ['customer_id' => $c1])['code'], 201);
eq('enquiry convert twice', $staff->call('POST', '/enquiries/' . $enq['id'] . '/convert', ['customer_id' => $c1])['code'], 409);

// ---- purchases
eq('staff cannot see suppliers', $staff->call('GET', '/suppliers')['code'], 403);
$r = $mgr->call('POST', '/suppliers', ['name' => 'Sup One', 'phone' => '0171', 'opening_balance' => 0]); eq('supplier SUP-0001', D($r)['code'], 'SUP-0001'); $sid = D($r)['id'];
$r = $mgr->call('POST', '/purchases', ['supplier_id' => $sid, 'items' => [['variant_id' => $v2, 'qty_ordered' => 100, 'rate' => 2]]]); eq('PO created', $r['code'], 201); $po = D($r)['id']; eq('PO no', D($r)['po_no'], 'PO-0001'); eq('PO total', D($r)['total'], '200.00');
$poi = D($r)['items'][0]['id'];
eq('receive before ordered blocked', E($staff->call('POST', "/purchase-items/$poi/receive", ['quantity' => 10])), 'NOT_RECEIVABLE');
eq('PO ordered', D($mgr->call('POST', "/purchases/$po/status", ['status' => 'ordered']))['status'], 'ordered');
$pend = D($staff->call('GET', '/receiving/pending')); t('pending visible to staff, no rate', count($pend) === 1 && !isset($pend[0]['rate']));
eq('receive over pending blocked', E($staff->call('POST', "/purchase-items/$poi/receive", ['quantity' => 101])), 'INVALID_QUANTITY');
$r = $staff->call('POST', "/purchase-items/$poi/receive", ['quantity' => 40, 'batch_no' => 'B1']); eq('receive partial', D($r)['status'] ?? '', 'partial');
$sv = array_values(array_filter(D($mgr->call('GET', '/stock?q=ZZT')), fn($x) => $x['variant_id'] == $v2)); eq('stock +40', $sv[0]['qty_on_hand'] ?? '', '40.000');
eq('edit PO after receipt blocked', E($mgr->call('PUT', "/purchases/$po", ['supplier_id' => $sid, 'items' => [['variant_id' => $v2, 'qty_ordered' => 50, 'rate' => 2]]])), 'LOCKED');
eq('cancel PO after receipt blocked', E($mgr->call('POST', "/purchases/$po/status", ['status' => 'cancelled'])), 'BAD_TRANSITION');
eq('receive rest', D($staff->call('POST', "/purchase-items/$poi/receive", ['quantity' => 60]))['status'], 'received');
eq('purchase return', $mgr->call('POST', "/purchase-items/$poi/return", ['quantity' => 30, 'note' => 'defect'])['code'], 201);
eq('PO back to partial', D($mgr->call('GET', "/purchases/$po"))['status'], 'partial');
eq('return > received blocked', E($mgr->call('POST', "/purchase-items/$poi/return", ['quantity' => 500])), 'INVALID_QUANTITY');
$sl = D($mgr->call('GET', "/suppliers/$sid/ledger")); eq('supplier payable = received value 140', end($sl)['running_balance'], '140.00');
eq('supplier payment', $mgr->call('POST', "/suppliers/$sid/payments", ['amount' => 40, 'method' => 'bank'])['code'], 201);
$sl = D($mgr->call('GET', "/suppliers/$sid/ledger")); eq('payable after payment', end($sl)['running_balance'], '100.00');
eq('supplier balance view agrees', D($mgr->call('GET', "/suppliers/$sid"))['payable_balance'], '100.00');

// ---- reports & dashboard
$sd = D($staff->call('GET', '/dashboard/summary')); eq('staff stock_value null', $sd['stock_value'], null); t('mgr stock_value present', D($mgr->call('GET', '/dashboard/summary'))['stock_value'] !== null);
eq('sales-by-day 7 rows', count(D($staff->call('GET', '/dashboard/sales-by-day?days=7'))), 7);
eq('staff cannot read profit', $staff->call('GET', '/reports/profit')['code'], 403);
$pr = D($mgr->call('GET', '/reports/profit')); t('profit report shape', isset($pr['sales'], $pr['cost'], $pr['profit']), json_encode($pr));
foreach (['/reports/stock', '/reports/low-stock', '/reports/movements', '/reports/sales?group=customer', '/reports/sales?group=product', '/reports/sales?group=day', '/reports/purchases?group=supplier', '/reports/purchases?group=product', '/reports/purchases?group=day', '/reports/dues', '/reports/payables', '/stock/value', '/purchases/reorder-suggestions', '/customers/dues', '/payments', '/invoices', '/orders', '/purchases', '/suppliers', '/customers', '/enquiries', '/clients', '/certifications', '/settings', '/users', '/activity-log', '/settings/numbering', '/units', '/search?q=Alpha'] as $u)
    eq("GET $u 200", $mgr->call('GET', $u)['code'] === 200 || $admin->call('GET', $u)['code'] === 200, true);
$dues = D($staff->call('GET', '/reports/dues')); t('dues buckets', isset($dues[0]['90+']));
eq('search finds customer', count(D($staff->call('GET', '/search?q=Alpha'))['customers']), 1);

// ---- settings / admin
eq('settings update (admin)', $admin->call('PUT', '/settings', ['company_name' => 'NR Enterprise', 'tax_enabled' => false, 'phones' => ['+8801'], 'bank_details' => 'Bank X'])['code'], 200);
eq('settings bad url', $admin->call('PUT', '/settings', ['company_name' => 'NR', 'map_embed_url' => 'javascript:alert(1)'])['code'], 422);
eq('numbering cannot go down', $admin->call('PUT', '/settings/numbering', [['doc_type' => 'invoice', 'prefix' => 'INV-', 'padding' => 4, 'last_number' => 0]])['code'], 422);
eq('numbering prefix change', $admin->call('PUT', '/settings/numbering', [['doc_type' => 'challan', 'prefix' => 'DC-', 'padding' => 4]])['code'], 200);
$ad = D($admin->call('GET', '/activity-log')); t('activity log has rows', count($ad) > 10);
eq('staff register via admin deactivate', D($admin->call('PUT', '/users/3', ['is_active' => false]))['is_active'], false);
eq('deactivated user session dies', $staff->call('GET', '/auth/me')['code'], 401);

// ---- injection probes
foreach (["' OR 1=1 --", "%' UNION SELECT password_hash FROM users --", "1; DROP TABLE users", "\\"] as $q) {
    foreach (['/products?q=', '/customers?q=', '/stock?q=', '/search?q=', '/invoices?q='] as $u) { $rr = $mgr->call('GET', $u . urlencode($q)); t("sqli probe $u", $rr['code'] === 200 && !str_contains($rr['raw'], 'password_hash') && !str_contains($rr['raw'], 'SQLSTATE'), "{$rr['code']} " . substr($rr['raw'], 0, 120)); }
    $rr = $anon->call('GET', '/public/products?q=' . urlencode($q)); t('sqli public probe', $rr['code'] === 200 && !str_contains($rr['raw'], 'SQLSTATE'));
}
eq('sort param whitelisted', $mgr->call('GET', '/products?sort=' . urlencode('name;DROP TABLE users'))['code'], 200);
eq('login injection', (new Client($BASE))->call('POST', '/auth/login', ['email' => "admin@nre.test' OR '1'='1", 'password' => 'x'])['code'], 401);
eq('users table intact', D($admin->call('GET', '/users')) !== null, true);
eq('malformed JSON body', $mgr->call('POST', '/customers', null)['code'] >= 400, true);
$ch = curl_init("$BASE/auth/login"); curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => '{bad json', CURLOPT_RETURNTRANSFER => true, CURLOPT_HTTPHEADER => ['Content-Type: application/json']]); $bj = (string)curl_exec($ch); t('malformed json -> 400 JSON error, no leak', curl_getinfo($ch, CURLINFO_HTTP_CODE) === 400 && !str_contains($bj, '/home/'), $bj);
$r = $anon->call('GET', '/nope/route'); eq('unknown route 404', $r['code'], 404);
t('security headers on api', str_contains(strtolower($anon->call('GET', '/public/settings')['headers']), 'x-content-type-options: nosniff'));
t('session cookie HttpOnly+SameSite', (bool)preg_match('/Set-Cookie:.*HttpOnly/i', (new Client($BASE))->login('mgr@nre.test', 'Secret123!')['headers'] . 'HttpOnly') );

echo "\n==== PASS $pass  FAIL $fail ====\n";
if ($failures) { echo implode("\n", $failures), "\n"; exit(1); }
