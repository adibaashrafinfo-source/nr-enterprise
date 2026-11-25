<?php
declare(strict_types=1);

function userPayload(array $u): array
{
    return ['id' => (int)$u['id'], 'email' => $u['email'], 'full_name' => $u['full_name'], 'phone' => $u['phone'] ?? null, 'role' => $u['role'], 'is_active' => (bool)$u['is_active']];
}
function checkPassword(V $v, string $field = 'password'): ?string
{
    $p = $v->str($field, true, 8, 200);
    return $p;
}

Router::add('POST', '/auth/register', 'P', function (Request $r) {
    $count = (int)Db::val('SELECT COUNT(*) FROM users');
    if ($count > 0 && !Config::get('ALLOW_REGISTRATION', false)) throw new ApiException('REGISTRATION_CLOSED', 'Registration is closed. Ask the administrator to create your account.', 403);
    if (RateLimit::tooMany('register', $r->ip(), 10, 3600)) throw new ApiException('RATE_LIMIT', 'Too many attempts. Try again later.', 429);
    $v = new V($r->body);
    $email = $v->email('email', true); $name = $v->str('full_name', true, 2, 160); $pass = checkPassword($v); $phone = $v->str('phone', false, 0, 30);
    $v->done();
    RateLimit::hit('register', $r->ip(), true);
    $u = Db::tx(function () use ($email, $name, $pass, $phone) {
        if (Db::val('SELECT COUNT(*) FROM users WHERE email=?', [$email]) > 0) throw new ApiException('VALIDATION', 'An account with this email already exists', 422, ['email' => 'Already registered']);
        $first = (int)Db::val('SELECT COUNT(*) FROM users FOR UPDATE') === 0;
        $id = Db::insert('users', ['email' => $email, 'password_hash' => password_hash($pass, PASSWORD_DEFAULT), 'full_name' => $name, 'phone' => $phone, 'role' => $first ? 'admin' : null]);
        return Db::one('SELECT id,email,full_name,phone,role,is_active,token_version FROM users WHERE id=?', [$id]);
    });
    Auth::login($u);
    Audit::log('users', 'REGISTER', $u['id'], ['role' => $u['role']]);
    Response::ok(['user' => userPayload($u), 'csrf_token' => Auth::csrf()], null, 201);
});

Router::add('POST', '/auth/login', 'P', function (Request $r) {
    $v = new V($r->body);
    $email = $v->str('email', true, 3, 190); $pass = $v->str('password', true, 1, 200);
    $v->done();
    $bucket = 'login:' . strtolower((string)$email);
    $fails = (int)Db::val("SELECT COUNT(*) FROM login_attempts WHERE email=? AND succeeded=0 AND created_at > (NOW() - INTERVAL 15 MINUTE)", [$bucket]);
    $ipFails = (int)Db::val("SELECT COUNT(*) FROM login_attempts WHERE email LIKE 'login:%' AND ip_address=? AND succeeded=0 AND created_at > (NOW() - INTERVAL 15 MINUTE)", [$r->ip()]);
    if ($fails >= 5 || $ipFails >= 20) throw new ApiException('RATE_LIMIT', 'Too many failed attempts. Try again in 15 minutes.', 429);
    $u = Db::one('SELECT id,email,password_hash,full_name,phone,role,is_active,token_version FROM users WHERE email=?', [$email]);
    if (!$u || !password_verify((string)$pass, $u['password_hash']) || !(int)$u['is_active']) {
        RateLimit::hit($bucket, $r->ip(), false);
        throw new ApiException('BAD_CREDENTIALS', 'Invalid email or password', 401);
    }
    RateLimit::hit($bucket, $r->ip(), true);
    Db::update('users', (int)$u['id'], ['last_login_at' => date('Y-m-d H:i:s')]);
    Auth::login($u);
    Response::ok(['user' => userPayload($u), 'csrf_token' => Auth::csrf()]);
});

Router::add('POST', '/auth/logout', 'S*', function (Request $r) { Auth::logoutSession(); Response::ok(['ok' => true]); });

Router::add('GET', '/auth/me', 'S*', function (Request $r) {
    Response::ok(['user' => userPayload(Auth::userOrNull()), 'csrf_token' => Auth::csrf()]);
});

Router::add('POST', '/auth/forgot-password', 'P', function (Request $r) {
    $v = new V($r->body); $email = $v->email('email', true); $v->done();
    if (RateLimit::tooMany('forgot', $r->ip(), 5, 3600)) throw new ApiException('RATE_LIMIT', 'Too many attempts. Try again later.', 429);
    RateLimit::hit('forgot', $r->ip(), true);
    $u = Db::one('SELECT id, full_name FROM users WHERE email=? AND is_active=1', [$email]);
    $out = ['ok' => true];
    if ($u) {
        $token = bin2hex(random_bytes(32));
        Db::insert('password_resets', ['user_id' => $u['id'], 'token_hash' => hash('sha256', $token), 'expires_at' => date('Y-m-d H:i:s', time() + 3600)]);
        $link = rtrim((string)Config::get('APP_URL'), '/') . '/admin/reset-password?token=' . $token;
        Mailer::send((string)$email, 'Reset your NR Enterprise password', "Hello {$u['full_name']},\n\nUse this link within 1 hour to set a new password:\n$link\n\nIf you did not ask for this, ignore this email.");
        if (Config::get('APP_ENV') === 'testing') $out['token'] = $token;
    }
    Response::ok($out);
});

Router::add('POST', '/auth/reset-password', 'P', function (Request $r) {
    $v = new V($r->body); $token = $v->str('token', true, 20, 200); $pass = checkPassword($v, 'password'); $v->done();
    $row = Db::one('SELECT * FROM password_resets WHERE token_hash=? AND used_at IS NULL AND expires_at > NOW()', [hash('sha256', (string)$token)]);
    if (!$row) throw new ApiException('BAD_TOKEN', 'This reset link is invalid or has expired', 400);
    Db::tx(function () use ($row, $pass) {
        Db::exec('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?', [password_hash((string)$pass, PASSWORD_DEFAULT), $row['user_id']]);
        Db::update('password_resets', (int)$row['id'], ['used_at' => date('Y-m-d H:i:s')]);
    });
    Response::ok(['ok' => true]);
});

Router::add('POST', '/auth/change-password', 'S*', function (Request $r) {
    $u = Auth::userOrNull();
    $v = new V($r->body); $cur = $v->str('current_password', true, 1, 200); $new = checkPassword($v, 'new_password'); $v->done();
    $hash = Db::val('SELECT password_hash FROM users WHERE id=?', [$u['id']]);
    if (!password_verify((string)$cur, (string)$hash)) throw new ApiException('VALIDATION', 'Current password is incorrect', 422, ['current_password' => 'Incorrect']);
    Db::exec('UPDATE users SET password_hash=?, token_version=token_version+1 WHERE id=?', [password_hash((string)$new, PASSWORD_DEFAULT), $u['id']]);
    $_SESSION['tv'] = (int)$u['token_version'] + 1;
    Audit::log('users', 'CHANGE_PASSWORD', $u['id']);
    Response::ok(['ok' => true]);
});
