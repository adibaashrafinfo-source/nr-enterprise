<?php
// Dev router: php -S 127.0.0.1:8000 -t public_html public_html/router.php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if (str_starts_with($path, '/api/')) { require __DIR__ . '/api/index.php'; return true; }
$file = __DIR__ . $path;
if ($path !== '/' && is_file($file)) return false;
if (is_file(__DIR__ . '/index.html')) { readfile(__DIR__ . '/index.html'); return true; }
http_response_code(404); echo 'Frontend not built yet';
