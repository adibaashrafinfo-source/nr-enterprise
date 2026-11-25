#!/bin/sh
# Usage: run_all.sh <schema.sql> <seed.sql>   (needs local MariaDB on socket /tmp/my/s.sock)
D=$(cd "$(dirname "$0")" && pwd); ROOT=$(cd "$D/../.." && pwd)
pkill -f "php -S 127.0.0.1:8099" 2>/dev/null
rm -rf /tmp/nre_test; mkdir -p /tmp/nre_test/uploads/products /tmp/nre_test/uploads/clients /tmp/nre_test/uploads/brand /tmp/nre_test/storage/enquiries /tmp/nre_test/storage/logs
"$D/reset_db.sh" "$1" "$2" || exit 1
NRE_CONFIG="$D/config.test.php" PHP_CLI_SERVER_WORKERS=8 php -S 127.0.0.1:8099 -t "$ROOT/public_html" "$ROOT/public_html/router.php" >/tmp/php.log 2>&1 &
sleep 1
php "$D/run.php" http://127.0.0.1:8099
RC=$?
pkill -f "php -S 127.0.0.1:8099"
exit $RC
