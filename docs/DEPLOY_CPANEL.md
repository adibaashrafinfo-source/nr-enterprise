# NR Enterprise — cPanel deploy (PHP + MySQL, no third-party service)

Files you get:

| File | Goes to | What it is |
|---|---|---|
| `nre_backend.zip` | `/home/<cpuser>/` (extract → `nre_backend/`) | PHP API code, config sample, storage, backup script |
| `public_html.zip` | your domain's document root | `.htaccess`, `api/`, `uploads/` skeleton, `assets/` (brand, product, client images) |
| `NRE_mysql_schema.sql` then `NRE_mysql_seed.sql` | phpMyAdmin → Import | 28 tables, 6 views, then products/clients/settings |
| `dist/` (from Lovable build) | document root, on top of public_html.zip | the React site |

Requirements: PHP 8.1+ (8.2/8.3 fine) with `pdo_mysql`, `gd`, `fileinfo`, `mbstring`; MySQL 5.7+ or MariaDB 10.3+; Apache with `mod_rewrite` (default on cPanel); AutoSSL/HTTPS on.

## 1. PHP version
cPanel → **MultiPHP Manager** → pick the domain → PHP 8.2 → Apply. cPanel → **MultiPHP INI Editor** → `upload_max_filesize = 8M`, `post_max_size = 10M`.
Check extensions in **Select PHP Version → Extensions**: `pdo_mysql`, `gd`, `fileinfo`, `mbstring` ticked.

## 2. Database
1. cPanel → **MySQL® Database Wizard** → create DB (e.g. `cpuser_nre`), create user (e.g. `cpuser_nreapp`) with a long password (letters + digits only), tick **ALL PRIVILEGES**.
2. **phpMyAdmin** → select the DB → **Import** → `NRE_mysql_schema.sql` → Go. Then import `NRE_mysql_seed.sql`.
3. Check: Structure tab shows 34 objects (28 tables + 6 views).

## 3. Upload files
1. **File Manager** → home folder (`/home/<cpuser>/`) → Upload `nre_backend.zip` → Extract. You must now have `/home/<cpuser>/nre_backend/` (NOT inside `public_html`).
2. Go to the document root (`public_html` for the main domain; the add-on domain folder otherwise) → Upload `public_html.zip` → Extract here.
3. Build the frontend (Lovable → Publish/Export, or `npm run build` with `VITE_USE_MOCK=false` and `VITE_API_BASE=/api/v1`) and upload the **contents** of `dist/` into the same document root. Do not overwrite `.htaccess`, `api/`, `uploads/`.

If the document root is not `/home/<cpuser>/public_html`, the API still finds the backend at `<docroot>/../nre_backend`. If you put the backend somewhere else, set an environment variable `NRE_BACKEND` (cPanel → Setup Python App is not needed; add `SetEnv NRE_BACKEND /full/path/nre_backend` to `api/.htaccess`).

## 4. Config
File Manager → `nre_backend/config.sample.php` → **Copy** to `config.php` → **Edit**:

```
APP_ENV   production
APP_URL   https://yourdomain.com
APP_KEY   (any 64 random hex characters)
DB_HOST   localhost
DB_NAME / DB_USER / DB_PASS   from step 2
ALLOW_REGISTRATION  false   (the very first account is always allowed and becomes admin)
ENQUIRY_NOTIFY_TO   your email for new website enquiries (optional)
HEALTHCHECK_KEY     a random word, for the check below
```
Permissions: `config.php` 640; `nre_backend/storage` and subfolders 755 (750 if PHP runs as your user); `public_html/uploads` and subfolders 755.

## 5. Check
Open `https://yourdomain.com/api/v1/health?key=<HEALTHCHECK_KEY>` → expect `"all_ok": true`, `tables` 34, `users` 0.
Open `https://yourdomain.com/api/v1/public/settings` → JSON with `NR Enterprise`.
Any `false` in the health JSON tells you what to fix (extension, writable folder, DB login).

## 6. First admin
Open `https://yourdomain.com/admin/register` (frontend) and register. This first account becomes **admin**. Registration is closed for everyone else after that. Add staff from **Settings → Users** (admin only) with role `manager` or `staff`.
Then in **Settings** fill: BIN, TIN, trade licence, bank details, invoice footer, phones, emails, WhatsApp, social links, map URL.

## 7. Backup (cron)
cPanel → **Cron Jobs** → once per day (02:30): `/bin/bash /home/<cpuser>/nre_backend/deploy/backup.sh`
Dumps go to `/home/<cpuser>/backups/nre/` (14 days kept; image/enquiry-file tar every Sunday). Run it once from **Terminal** to confirm: `bash ~/nre_backend/deploy/backup.sh` → prints `ok …`.
Also download a backup copy to another place now and then; cPanel's own **Backup** is a second layer.

## 8. Security check (all must be blocked)
- `https://yourdomain.com/nre_backend/config.php` → 404/403 (it must not be under the document root)
- `https://yourdomain.com/uploads/` → no listing; a `.php` file placed in `uploads/` must not run
- HTTP → redirects to HTTPS
- `/api/v1/auth/register` → 403 `REGISTRATION_CLOSED` after the first admin exists
- Health URL without the key → 404

## 9. Before you publish to customers
Content that must be confirmed by the owner (hidden by default): certifications (all unpublished), client logos need written permission (`permission_confirmed`), company capacity/statistics numbers, BIN/TIN/bank/social links, replace low-resolution product photos. The site never shows prices.

## 10. Updating later
Replace `nre_backend/src/` and `public_html/api/` with the new version (keep `config.php`, `storage/`, `uploads/`). Database changes arrive as separate `.sql` files to import in phpMyAdmin.

## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| 500 `Server is not configured` | `config.php` missing in `nre_backend/` |
| 500 `SERVER_ERROR` | see `nre_backend/storage/logs/app.log` (DB password, missing extension) |
| Login works then logs out | site not on HTTPS (session cookie is `Secure`); enable AutoSSL |
| `403 CSRF` on every save | frontend must send header `X-CSRF-Token` (value from `/auth/me`); stale cache — hard refresh |
| Image upload fails | `uploads/` not writable, or file > 5 MB, or not jpg/png/webp |
| Blank page on `/admin/...` after refresh | `.htaccess` from `public_html.zip` missing in the document root |


## GitHub route (recommended)
Repo: https://github.com/adibaashrafinfo-source/nr-enterprise (main). Contains backend/, database/, frontend-dist/ (prebuilt) and .cpanel.yml.
cPanel -> Git Version Control -> Clone -> then "Deploy HEAD Commit" copies everything to ~/nre_backend and ~/public_html. Create ~/nre_backend/config.php from config.sample.php once (DB creds, APP_URL, first admin). Import database/NRE_mysql_schema.sql then NRE_mysql_seed.sql in phpMyAdmin. Updates: Pull -> Deploy HEAD Commit.
Rebuild site locally: `npm run build:cpanel` (updates frontend-dist/), commit, push.
