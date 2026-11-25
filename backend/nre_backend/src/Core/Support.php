<?php
declare(strict_types=1);

final class ApiException extends Exception
{
    public function __construct(public string $errCode, string $message, public int $status = 400, public array $fields = [])
    {
        parent::__construct($message);
    }
}

final class Config
{
    private static array $c = [];
    public static function load(array $c): void { self::$c = $c; }
    public static function get(string $k, mixed $d = null): mixed { return self::$c[$k] ?? $d; }
    public static function isProd(): bool { return self::get('APP_ENV', 'production') === 'production'; }
}

final class Db
{
    private static ?PDO $pdo = null;
    private static int $depth = 0;

    public static function pdo(): PDO
    {
        if (self::$pdo === null) {
            $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', Config::get('DB_HOST', 'localhost'), (int)Config::get('DB_PORT', 3306), Config::get('DB_NAME'));
            self::$pdo = new PDO($dsn, (string)Config::get('DB_USER'), (string)Config::get('DB_PASS'), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_STRINGIFY_FETCHES => false,
            ]);
            self::$pdo->exec("SET time_zone = '+06:00'");
            self::$pdo->exec("SET NAMES utf8mb4");
        }
        return self::$pdo;
    }
    public static function reset(): void { self::$pdo = null; self::$depth = 0; }
    private static function run(string $sql, array $p): PDOStatement { $s = self::pdo()->prepare($sql); $s->execute(array_values($p)); return $s; }
    public static function all(string $sql, array $p = []): array { return self::run($sql, $p)->fetchAll(); }
    public static function one(string $sql, array $p = []): ?array { $r = self::run($sql, $p)->fetch(); return $r === false ? null : $r; }
    public static function val(string $sql, array $p = []): mixed { $r = self::run($sql, $p)->fetch(PDO::FETCH_NUM); return $r === false ? null : $r[0]; }
    public static function exec(string $sql, array $p = []): int { return self::run($sql, $p)->rowCount(); }
    public static function insert(string $table, array $row): int
    {
        $cols = array_keys($row);
        self::assertIdent($cols); self::assertIdent([$table]);
        $sql = 'INSERT INTO `' . $table . '` (`' . implode('`,`', $cols) . '`) VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')';
        self::run($sql, $row);
        return (int)self::pdo()->lastInsertId();
    }
    public static function update(string $table, int|string $id, array $row, string $pk = 'id'): void
    {
        if (!$row) return;
        $cols = array_keys($row); self::assertIdent($cols); self::assertIdent([$table, $pk]);
        $set = implode(',', array_map(fn($c) => "`$c`=?", $cols));
        self::run("UPDATE `$table` SET $set WHERE `$pk`=?", [...array_values($row), $id]);
    }
    private static function assertIdent(array $names): void
    {
        foreach ($names as $n) if (!preg_match('/^[a-z_][a-z0-9_]*$/i', (string)$n)) throw new LogicException('Bad identifier');
    }
    public static function tx(callable $fn): mixed
    {
        $pdo = self::pdo();
        if (self::$depth > 0) return $fn();
        $pdo->beginTransaction(); self::$depth = 1;
        try { $r = $fn(); $pdo->commit(); self::$depth = 0; return $r; }
        catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); self::$depth = 0; throw $e; }
    }
}

final class Request
{
    public string $method; public string $path; public array $query; public array $body = []; public array $files = []; public array $params = [];
    public static function capture(): self
    {
        $r = new self();
        $r->method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $pos = strpos($uri, '/api/v1');
        $r->path = $pos === false ? $uri : substr($uri, $pos + 7);
        $r->path = '/' . trim($r->path, '/');
        $r->query = $_GET;
        $ct = $_SERVER['CONTENT_TYPE'] ?? '';
        if (str_contains($ct, 'application/json')) {
            $raw = file_get_contents('php://input');
            if ($raw !== '' && $raw !== false) {
                $j = json_decode($raw, true);
                if (!is_array($j)) throw new ApiException('BAD_JSON', 'Invalid JSON body', 400);
                $r->body = $j;
            }
        } else { $r->body = $_POST; $r->files = $_FILES; }
        return $r;
    }
    public function in(string $k, mixed $d = null): mixed { return $this->body[$k] ?? $d; }
    public function q(string $k, mixed $d = null): mixed { return $this->query[$k] ?? $d; }
    public function ip(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'), 0, 45); }
}

final class Response
{
    private const BOOLS = ['is_active','show_on_website','is_featured','is_primary','wants_sample','permission_confirmed','holder_confirmed','is_published','tax_enabled','succeeded'];
    private const JSONS = ['features','specs','phones','emails','attributes','details'];
    public static function normalize(mixed $v): mixed
    {
        if (!is_array($v)) return $v;
        $out = [];
        foreach ($v as $k => $x) {
            if (is_string($k) && in_array($k, self::BOOLS, true) && ($x === 0 || $x === 1 || $x === '0' || $x === '1')) { $out[$k] = (bool)(int)$x; continue; }
            if (is_string($k) && in_array($k, self::JSONS, true) && is_string($x)) { $j = json_decode($x, true); $out[$k] = (json_last_error() === JSON_ERROR_NONE) ? $j : $x; continue; }
            $out[$k] = self::normalize($x);
        }
        return $out;
    }
    public static function send(array $payload, int $status = 200, bool $public = false): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        header($public ? 'Cache-Control: public, max-age=300' : 'Cache-Control: no-store');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
        exit;
    }
    public static function ok(mixed $data, ?array $meta = null, int $status = 200, bool $public = false): never
    {
        $p = ['data' => self::normalize($data)];
        if ($meta !== null) $p['meta'] = $meta;
        self::send($p, $status, $public);
    }
    public static function error(string $code, string $message, int $status, array $fields = []): never
    {
        $e = ['code' => $code, 'message' => $message];
        if ($fields) $e['fields'] = $fields;
        self::send(['error' => $e], $status);
    }
}

final class Money
{
    public static function fmt(string|int|float|null $v, int $scale = 2): string { return number_format((float)($v ?? 0), $scale, '.', ''); }
    /** compare two decimal strings at 3 decimals using integers */
    public static function cmp3(string|int|float $a, string|int|float $b): int { return (int)round((float)$a * 1000) <=> (int)round((float)$b * 1000); }
}

final class V
{
    private array $errors = [];
    public function __construct(private array $d) {}
    public function fail(string $f, string $m): void { $this->errors[$f] = $m; }
    public function str(string $f, bool $req = false, int $min = 0, int $max = 255): ?string
    {
        $v = $this->d[$f] ?? null;
        if ($v === null || $v === '') { if ($req) $this->fail($f, 'Required'); return null; }
        if (!is_scalar($v)) { $this->fail($f, 'Invalid'); return null; }
        $v = trim((string)$v);
        $len = mb_strlen($v);
        if ($len < $min || $len > $max) { $this->fail($f, "Must be $min-$max characters"); return null; }
        return $v;
    }
    public function email(string $f, bool $req = false): ?string
    {
        $v = $this->str($f, $req, 0, 190);
        if ($v !== null && !filter_var($v, FILTER_VALIDATE_EMAIL)) { $this->fail($f, 'Invalid email'); return null; }
        return $v;
    }
    public function num(string $f, bool $req = false, ?float $min = null, ?float $max = null): ?string
    {
        $v = $this->d[$f] ?? null;
        if ($v === null || $v === '') { if ($req) $this->fail($f, 'Required'); return null; }
        if (!is_numeric($v)) { $this->fail($f, 'Must be a number'); return null; }
        $n = (float)$v;
        if (($min !== null && $n < $min) || ($max !== null && $n > $max)) { $this->fail($f, 'Out of range'); return null; }
        return (string)$v;
    }
    public function int(string $f, bool $req = false, ?int $min = null): ?int
    {
        $v = $this->d[$f] ?? null;
        if ($v === null || $v === '') { if ($req) $this->fail($f, 'Required'); return null; }
        if (!is_numeric($v) || (string)(int)$v !== (string)(int)(float)$v) { $this->fail($f, 'Must be an integer'); return null; }
        if ($min !== null && (int)$v < $min) { $this->fail($f, "Must be at least $min"); return null; }
        return (int)$v;
    }
    public function date(string $f, bool $req = false): ?string
    {
        $v = $this->d[$f] ?? null;
        if ($v === null || $v === '') { if ($req) $this->fail($f, 'Required'); return null; }
        $d = DateTime::createFromFormat('Y-m-d', (string)$v);
        if (!$d || $d->format('Y-m-d') !== (string)$v) { $this->fail($f, 'Use YYYY-MM-DD'); return null; }
        return (string)$v;
    }
    public function enum(string $f, array $allowed, bool $req = false, ?string $default = null): ?string
    {
        $v = $this->d[$f] ?? null;
        if ($v === null || $v === '') { if ($req) $this->fail($f, 'Required'); return $default; }
        if (!in_array($v, $allowed, true)) { $this->fail($f, 'Must be one of: ' . implode(', ', $allowed)); return $default; }
        return (string)$v;
    }
    public function bool(string $f, bool $default = false): int
    {
        if (!array_key_exists($f, $this->d)) return $default ? 1 : 0;
        $v = $this->d[$f];
        return ($v === true || $v === 1 || $v === '1' || $v === 'true' || $v === 'on') ? 1 : 0;
    }
    public function has(string $f): bool { return array_key_exists($f, $this->d); }
    public function done(): void
    {
        if ($this->errors) throw new ApiException('VALIDATION', 'Please correct the highlighted fields', 422, $this->errors);
    }
}

final class Audit
{
    public static function log(string $table, string $action, int|string|null $id = null, array $details = []): void
    {
        try {
            $u = Auth::userOrNull();
            Db::insert('activity_log', [
                'user_id' => $u['id'] ?? null, 'table_name' => $table, 'action' => $action,
                'record_id' => $id === null ? null : (string)$id,
                'details' => $details ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
                'ip_address' => substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45),
            ]);
        } catch (Throwable $e) { Log::error('audit failed: ' . $e->getMessage()); }
    }
}

final class Log
{
    public static function error(string $m): void
    {
        $dir = Config::get('STORAGE_DIR') ?: NRE_ROOT . '/storage';
        @file_put_contents($dir . '/logs/app.log', '[' . date('c') . '] ' . $m . "\n", FILE_APPEND);
    }
}

final class Numbering
{
    public static function next(string $type): string
    {
        $n = Db::exec('UPDATE doc_counters SET last_number = LAST_INSERT_ID(last_number + 1) WHERE doc_type = ?', [$type]);
        if ($n === 0 && Db::val('SELECT COUNT(*) FROM doc_counters WHERE doc_type=?', [$type]) == 0) throw new RuntimeException("Unknown doc type $type");
        return (string)Db::val("SELECT CONCAT(prefix, LPAD(LAST_INSERT_ID(), padding, '0')) FROM doc_counters WHERE doc_type = ?", [$type]);
    }
}

final class RateLimit
{
    /** uses login_attempts: email column holds the bucket name */
    public static function tooMany(string $bucket, string $ip, int $max, int $seconds, bool $byIp = true): bool
    {
        $sql = 'SELECT COUNT(*) FROM login_attempts WHERE email=? AND created_at > (NOW() - INTERVAL ' . (int)$seconds . ' SECOND)' . ($byIp ? ' AND ip_address=?' : '');
        $p = $byIp ? [$bucket, $ip] : [$bucket];
        return (int)Db::val($sql, $p) >= $max;
    }
    public static function hit(string $bucket, string $ip, bool $ok = false): void
    {
        Db::insert('login_attempts', ['email' => substr($bucket, 0, 190), 'ip_address' => $ip, 'succeeded' => $ok ? 1 : 0]);
    }
}

final class Mailer
{
    public static function send(string $to, string $subject, string $body): void
    {
        if (Config::get('APP_ENV') === 'testing') { @file_put_contents((Config::get('STORAGE_DIR') ?: NRE_ROOT . '/storage') . '/logs/mail.log', "TO:$to\nSUBJECT:$subject\n$body\n---\n", FILE_APPEND); return; }
        $from = (string)Config::get('MAIL_FROM', 'no-reply@localhost');
        @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body, "From: $from\r\nContent-Type: text/plain; charset=UTF-8");
    }
}

final class Upload
{
    private const IMG = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
    public static function uploadsDir(): string { return rtrim((string)(Config::get('UPLOAD_DIR') ?: dirname(NRE_ROOT) . '/public_html/uploads'), '/'); }
    public static function storageDir(): string { return rtrim((string)(Config::get('STORAGE_DIR') ?: NRE_ROOT . '/storage'), '/'); }

    /** returns the temp file array or null if none provided; throws on invalid */
    private static function file(array $files, string $field, bool $required): ?array
    {
        $f = $files[$field] ?? null;
        if (!$f || ($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            if ($required) throw new ApiException('VALIDATION', 'File is required', 422, [$field => 'Required']);
            return null;
        }
        if (is_array($f['name'])) throw new ApiException('VALIDATION', 'Upload one file only', 422, [$field => 'One file only']);
        if ($f['error'] !== UPLOAD_ERR_OK) throw new ApiException('VALIDATION', 'Upload failed', 422, [$field => 'Upload failed']);
        if ($f['size'] > 5 * 1024 * 1024) throw new ApiException('VALIDATION', 'File too large (max 5 MB)', 422, [$field => 'Max 5 MB']);
        if (!is_uploaded_file($f['tmp_name']) && Config::get('APP_ENV') !== 'testing') throw new ApiException('VALIDATION', 'Invalid upload', 422, [$field => 'Invalid upload']);
        return $f;
    }
    private static function mime(string $path): string
    {
        $fi = new finfo(FILEINFO_MIME_TYPE);
        return (string)$fi->file($path);
    }
    /** Re-encode an image into uploads/<sub>/ and return the public URL (/uploads/<sub>/<name>) */
    public static function image(array $files, string $field, string $sub, bool $required = true): ?string
    {
        $f = self::file($files, $field, $required);
        if ($f === null) return null;
        $mime = self::mime($f['tmp_name']);
        if (!isset(self::IMG[$mime])) throw new ApiException('VALIDATION', 'Only JPG, PNG or WebP images are allowed', 422, [$field => 'Invalid image type']);
        $raw = file_get_contents($f['tmp_name']);
        $im = @imagecreatefromstring($raw);
        if (!$im) throw new ApiException('VALIDATION', 'Image could not be read', 422, [$field => 'Corrupt image']);
        $w = imagesx($im); $h = imagesy($im); $max = 1600;
        if (max($w, $h) > $max) {
            $r = $max / max($w, $h);
            $n = imagecreatetruecolor((int)round($w * $r), (int)round($h * $r));
            imagealphablending($n, false); imagesavealpha($n, true);
            imagecopyresampled($n, $im, 0, 0, 0, 0, imagesx($n), imagesy($n), $w, $h);
            imagedestroy($im); $im = $n;
        }
        $ext = self::IMG[$mime];
        $dir = self::uploadsDir() . '/' . $sub;
        if (!is_dir($dir) && !@mkdir($dir, 0755, true)) throw new RuntimeException('Cannot create upload dir');
        $name = bin2hex(random_bytes(12)) . '.' . $ext;
        $dest = $dir . '/' . $name;
        $ok = match ($ext) { 'jpg' => imagejpeg($im, $dest, 86), 'png' => imagepng($im, $dest, 6), 'webp' => imagewebp($im, $dest, 84) };
        imagedestroy($im);
        if (!$ok) throw new RuntimeException('Cannot save image');
        @chmod($dest, 0644);
        return '/uploads/' . $sub . '/' . $name;
    }
    /** enquiry attachment (jpg/png/webp/pdf) stored OUTSIDE web root; returns relative path */
    public static function privateFile(array $files, string $field, string $sub): ?string
    {
        $f = self::file($files, $field, false);
        if ($f === null) return null;
        $mime = self::mime($f['tmp_name']);
        $ext = self::IMG[$mime] ?? ($mime === 'application/pdf' ? 'pdf' : null);
        if ($ext === null) throw new ApiException('VALIDATION', 'Allowed files: JPG, PNG, WebP, PDF', 422, [$field => 'Invalid file type']);
        if ($ext === 'pdf') { $head = (string)file_get_contents($f['tmp_name'], false, null, 0, 5); if ($head !== '%PDF-') throw new ApiException('VALIDATION', 'Invalid PDF', 422, [$field => 'Invalid PDF']); }
        $dir = self::storageDir() . '/' . $sub;
        if (!is_dir($dir) && !@mkdir($dir, 0750, true)) throw new RuntimeException('Cannot create storage dir');
        $name = bin2hex(random_bytes(16)) . '.' . $ext;
        $dest = $dir . '/' . $name;
        if (!@move_uploaded_file($f['tmp_name'], $dest) && !(Config::get('APP_ENV') === 'testing' && @copy($f['tmp_name'], $dest))) throw new RuntimeException('Cannot store file');
        @chmod($dest, 0640);
        return $sub . '/' . $name;
    }
    public static function deletePublic(string $url): void
    {
        if (!str_starts_with($url, '/uploads/') || str_contains($url, '..')) return;
        $p = dirname(self::uploadsDir()) . $url;
        if (is_file($p)) @unlink($p);
    }
}
