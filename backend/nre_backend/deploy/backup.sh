#!/bin/bash
# Daily MySQL backup for cPanel cron. Reads DB credentials from ../config.php. Keeps 14 days.
# Cron (cPanel > Cron Jobs, once a day):  /bin/bash /home/CPANELUSER/nre_backend/deploy/backup.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${BACKUP_DIR:-$HOME/backups/nre}"
mkdir -p "$OUT"; chmod 700 "$OUT"
read -r H P N U <<<"$(php -r '$c=require $argv[1]; echo ($c["DB_HOST"] ?? "localhost")," ",($c["DB_PORT"] ?? 3306)," ",$c["DB_NAME"]," ",$c["DB_USER"];' "$DIR/config.php")"
PW="$(php -r '$c=require $argv[1]; echo $c["DB_PASS"];' "$DIR/config.php")"
F="$OUT/nre_$(date +%Y%m%d_%H%M).sql.gz"
MYSQL_PWD="$PW" mysqldump -h "$H" -P "$P" -u "$U" --single-transaction --routines=0 --triggers=0 --no-tablespaces "$N" | gzip -9 > "$F"
[ -s "$F" ] || { echo "backup empty" >&2; rm -f "$F"; exit 1; }
find "$OUT" -name 'nre_*.sql.gz' -mtime +14 -delete
# Uploaded product images + private enquiry files (small): weekly tar on Sundays
if [ "$(date +%u)" = "7" ]; then
  tar -czf "$OUT/files_$(date +%Y%m%d).tar.gz" -C "$(dirname "$DIR")" public_html/uploads nre_backend/storage/enquiries 2>/dev/null || true
  find "$OUT" -name 'files_*.tar.gz' -mtime +28 -delete
fi
echo "ok $F"
