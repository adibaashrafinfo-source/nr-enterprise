<?php
declare(strict_types=1);
if (!defined('NRE_ROOT')) define('NRE_ROOT', dirname(__DIR__));

require_once __DIR__ . '/Core/Support.php';
require_once __DIR__ . '/Core/Auth.php';
require_once __DIR__ . '/Core/Shape.php';
foreach (['Stock', 'Invoice', 'Payment', 'Purchase', 'Order', 'Ledger', 'Catalogue'] as $s) require_once __DIR__ . "/Services/{$s}Service.php";

function nre_boot(?array $config = null): void
{
    if ($config === null) {
        $f = getenv('NRE_CONFIG') ?: NRE_ROOT . '/config.php';
        if (!is_file($f)) { http_response_code(500); header('Content-Type: application/json'); echo '{"error":{"code":"CONFIG","message":"Server is not configured"}}'; exit; }
        $config = require $f;
    }
    Config::load($config);
    date_default_timezone_set((string)Config::get('TIMEZONE', 'Asia/Dhaka'));
    ini_set('display_errors', Config::isProd() ? '0' : '1');
    error_reporting(E_ALL);
    set_error_handler(function (int $no, string $str, string $file, int $line) {
        if (!(error_reporting() & $no)) return false;
        throw new ErrorException($str, 0, $no, $file, $line);
    });
}

function nre_register_routes(): void
{
    foreach (['auth', 'public', 'dashboard', 'catalogue', 'stock', 'customers', 'suppliers', 'sales', 'purchases', 'reports', 'enquiries', 'content', 'settings'] as $r) require_once __DIR__ . "/routes/$r.php";
}

function nre_handle(?Request $req = null): void
{
    try {
        $req ??= Request::capture();
        nre_register_routes();
        Router::dispatch($req);
    } catch (ApiException $e) {
        Response::error($e->errCode, $e->getMessage(), $e->status, $e->fields);
    } catch (PDOException $e) {
        $c = (int)($e->errorInfo[1] ?? 0);
        if ($c === 1062) Response::error('DUPLICATE', 'A record with the same unique value already exists', 422);
        if ($c === 1451) Response::error('IN_USE', 'This record is used by other records and cannot be deleted', 409);
        if ($c === 1452) Response::error('BAD_REFERENCE', 'A referenced record does not exist', 422);
        if ($c === 4025 || $c === 3819) Response::error('VALIDATION', 'A value is out of the allowed range', 422);
        Log::error('DB: ' . $e->getMessage());
        Response::error('SERVER_ERROR', 'Something went wrong on the server', 500);
    } catch (Throwable $e) {
        Log::error(get_class($e) . ': ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        Response::error('SERVER_ERROR', 'Something went wrong on the server', 500);
    }
}

/** shared helpers */
function paging(Request $r, int $default = 25, int $max = 100): array
{
    $page = max(1, (int)$r->q('page', 1));
    $per = min($max, max(1, (int)$r->q('per_page', $default)));
    return [$page, $per, ($page - 1) * $per];
}
function like(string $s): string { return '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $s) . '%'; }
function sortBy(Request $r, array $whitelist, string $default): string
{
    $f = (string)$r->q('sort', '');
    $d = strtolower((string)$r->q('dir', 'desc')) === 'asc' ? 'ASC' : 'DESC';
    return isset($whitelist[$f]) ? $whitelist[$f] . ' ' . $d : $default;
}
function slugify(string $s): string
{
    $s = strtolower(trim($s));
    $s = preg_replace('/[^a-z0-9]+/', '-', $s) ?? '';
    $s = trim($s, '-');
    return $s !== '' ? $s : 'item-' . bin2hex(random_bytes(3));
}
function uniqueSlug(string $table, string $base, ?int $exceptId = null): string
{
    $slug = slugify($base); $i = 1; $try = $slug;
    while ((int)Db::val("SELECT COUNT(*) FROM `$table` WHERE slug=?" . ($exceptId ? ' AND id<>' . (int)$exceptId : ''), [$try]) > 0) { $i++; $try = $slug . '-' . $i; }
    return $try;
}
function jsonCol(mixed $v): ?string { return $v === null ? null : json_encode($v, JSON_UNESCAPED_UNICODE); }
function listResponse(array $rows, int $page, int $per, int $total): never
{
    Response::ok($rows, ['page' => $page, 'per_page' => $per, 'total' => $total]);
}
function needRow(?array $row, string $what = 'Record'): array
{
    if (!$row) throw new ApiException('NOT_FOUND', "$what not found", 404);
    return $row;
}
