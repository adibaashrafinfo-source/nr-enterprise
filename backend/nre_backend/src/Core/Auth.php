<?php
declare(strict_types=1);

final class Auth
{
    private const LEVEL = ['staff' => 1, 'manager' => 2, 'admin' => 3];
    private static ?array $user = null;
    private static bool $loaded = false;
    private static bool $started = false;

    public static function start(): void
    {
        if (self::$started) return;
        self::$started = true;
        if (PHP_SAPI === 'cli' && Config::get('APP_ENV') === 'testing') { if (!isset($_SESSION)) $_SESSION = []; return; }
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
        session_name((string)Config::get('SESSION_NAME', 'nre_sid'));
        session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.gc_maxlifetime', (string)Config::get('SESSION_LIFETIME', 28800));
        session_start();
        $last = $_SESSION['last_seen'] ?? time();
        if (time() - $last > (int)Config::get('SESSION_LIFETIME', 28800)) { $_SESSION = []; }
        $_SESSION['last_seen'] = time();
    }

    public static function userOrNull(): ?array
    {
        if (self::$loaded) return self::$user;
        self::$loaded = true;
        if (!self::$started && !isset($_COOKIE[Config::get('SESSION_NAME', 'nre_sid')]) && PHP_SAPI !== 'cli') return null;
        self::start();
        $id = $_SESSION['uid'] ?? null;
        if (!$id) return null;
        $u = Db::one('SELECT id,email,full_name,phone,role,is_active,token_version FROM users WHERE id=?', [$id]);
        if (!$u || !(int)$u['is_active'] || (int)$u['token_version'] !== (int)($_SESSION['tv'] ?? -1)) { self::logoutSession(); return null; }
        return self::$user = $u;
    }

    public static function login(array $u): void
    {
        self::start();
        if (PHP_SAPI !== 'cli') session_regenerate_id(true);
        $_SESSION['uid'] = (int)$u['id'];
        $_SESSION['tv'] = (int)$u['token_version'];
        $_SESSION['csrf'] = bin2hex(random_bytes(24));
        self::$user = $u; self::$loaded = true;
    }
    public static function logoutSession(): void
    {
        $_SESSION = [];
        if (PHP_SAPI !== 'cli' && session_status() === PHP_SESSION_ACTIVE) session_destroy();
        self::$user = null; self::$loaded = true;
    }
    public static function csrf(): string
    {
        self::start();
        if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(24));
        return $_SESSION['csrf'];
    }
    public static function checkCsrf(): void
    {
        $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
        if ($sent === '' || !hash_equals((string)($_SESSION['csrf'] ?? ''), $sent)) throw new ApiException('CSRF', 'Invalid or missing CSRF token', 403);
    }
    public static function role(): ?string { return self::userOrNull()['role'] ?? null; }
    public static function id(): ?int { $u = self::userOrNull(); return $u ? (int)$u['id'] : null; }
    public static function has(string $min): bool
    {
        $r = self::role();
        return $r !== null && (self::LEVEL[$r] ?? 0) >= self::LEVEL[$min];
    }
    public static function isManager(): bool { return self::has('manager'); }

    /** $need: P public, S* logged in, S staff+, M manager+, A admin */
    public static function require(string $need): void
    {
        if ($need === 'P') return;
        $u = self::userOrNull();
        if (!$u) throw new ApiException('UNAUTHENTICATED', 'Please log in', 401);
        if ($need === 'S*') return;
        $min = ['S' => 'staff', 'M' => 'manager', 'A' => 'admin'][$need] ?? 'admin';
        if (!$u['role'] || self::LEVEL[$u['role']] < self::LEVEL[$min]) throw new ApiException('FORBIDDEN', 'You do not have permission for this action', 403);
    }
}

final class Router
{
    private static array $routes = [];
    public static function add(string $method, string $pattern, string $role, callable $h): void
    {
        $re = preg_replace_callback('/\{(\w+)\}/', fn($m) => in_array($m[1], ['slug'], true) ? '(?P<slug>[a-z0-9][a-z0-9\-]*)' : '(?P<' . $m[1] . '>\d+)', $pattern);
        self::$routes[] = [$method, '#^' . $re . '$#', $role, $h, $pattern];
    }
    public static function routes(): array { return array_map(fn($r) => [$r[0], $r[4], $r[2]], self::$routes); }
    public static function dispatch(Request $req): void
    {
        $pathMatched = false;
        foreach (self::$routes as [$m, $re, $role, $h]) {
            if (!preg_match($re, $req->path, $mm)) continue;
            $pathMatched = true;
            if ($m !== $req->method) continue;
            foreach ($mm as $k => $v) if (is_string($k)) $req->params[$k] = ctype_digit($v) ? (int)$v : $v;
            if ($role !== 'P' || str_starts_with($req->path, '/auth')) Auth::start();
            Auth::require($role);
            if ($req->method !== 'GET' && $role !== 'P') Auth::checkCsrf();
            $h($req);
            Response::error('NO_RESPONSE', 'Handler returned nothing', 500);
        }
        if ($pathMatched) Response::error('METHOD_NOT_ALLOWED', 'Method not allowed', 405);
        Response::error('NOT_FOUND', 'Endpoint not found', 404);
    }
}
