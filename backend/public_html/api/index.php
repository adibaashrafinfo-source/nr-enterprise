<?php
declare(strict_types=1);
// Front controller. Backend lives OUTSIDE public_html: /home/<user>/nre_backend
$backend = getenv('NRE_BACKEND') ?: dirname(__DIR__, 2) . '/nre_backend';
if (!is_dir($backend)) { http_response_code(500); header('Content-Type: application/json'); echo '{"error":{"code":"CONFIG","message":"Backend folder not found"}}'; exit; }
define('NRE_ROOT', $backend);
require $backend . '/src/bootstrap.php';
nre_boot();
nre_handle();
