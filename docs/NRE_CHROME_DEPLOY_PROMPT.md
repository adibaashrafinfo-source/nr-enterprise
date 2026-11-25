# NR Enterprise — Claude in Chrome: cPanel Deploy Master Instruction

Paste the block below into Claude in Chrome (the browser extension) after you have:
1. Logged in to the cPanel yourself in a Chrome tab (the agent must never type your password, OTP or captcha).
2. Filled the 6 values in the `INPUTS` section.
3. Put the deploy files somewhere the browser can reach (see "Getting files onto the server", section C below).

Tip: in the extension settings, allow the cPanel domain and the NR site domain in advance so it does not stop to ask for site permission on every click.

---

```
ROLE
You are the deployment operator for the NR Enterprise website. Use the browser to do the whole cPanel deployment yourself, step by step, without asking me for approval on routine in-scope steps. Work in the cPanel tab that is already logged in. Report at the end.

INPUTS (I fill these before pasting)
- CPANEL_URL: <https://yourdomain.com:2083 or the hosting panel URL>
- SITE_DOMAIN: <nrenterprise.example>      (the domain/subdomain where the site will live)
- DOC_ROOT: <public_html  or  public_html/subfolder  or  the addon domain's document root>
- DB_NAME_SUFFIX: nre      DB_USER_SUFFIX: nreapp   (cPanel adds the account prefix automatically)
- FILES: <where the deploy files are: GitHub repo URL, or download links, or "uploaded in File Manager at /home/<user>/deploy/">
- ADMIN_EMAIL: <email for the first admin account>

WHAT IS BEING DEPLOYED
A React single-page frontend (static dist/ files) + a PHP 8.1+ REST API in nre_backend/ (outside web root) and public_html/api/ + a MySQL/MariaDB database on this same cPanel. No Supabase or any external service. Reference files: NRE_BACKEND_API.md section 8 (deployment) is the authoritative checklist; deploy/DEPLOY_CPANEL.md if present.

AUTONOMY RULES
- Proceed through all steps below on your own. Do not ask "should I continue?" between steps.
- Stop and ask me ONLY for: my cPanel password/OTP/captcha/2FA, any payment or purchase (domain, SSL, paid add-on), any action on a domain/site/database/email account that is NOT part of this project, or a failure you cannot fix after two different attempts.
- Never type, store or repeat my cPanel/hosting password. Never put passwords in screenshots, URLs, page titles or chat. If a password field appears for my account, stop and ask me to enter it.
- Never delete, overwrite or rename anything that already exists in the target folder or account unless it is a file I told you to replace. If DOC_ROOT is not empty, first create a backup (File Manager -> Compress to ~/backups/pre_nre_<date>.zip) and tell me what was there before continuing.
- Do not change DNS, nameservers, other domains, email accounts, or other databases.
- Do not use any external website to host, convert or process my files or data.
- Prefer the least risky route; if two routes exist, use the first one that works.

STEPS

A. Preflight
1. Open cPanel. Record: cPanel username, PHP version, MySQL/MariaDB version (cPanel -> Server Information or phpMyAdmin footer), disk space, whether Terminal, Git Version Control, SSH Access, and Cron Jobs exist.
2. Check SITE_DOMAIN points to this hosting (Domains page). If it does not exist, create the addon/subdomain only if I named it in INPUTS; otherwise stop and ask.
3. Look inside DOC_ROOT and the home directory. Write down what exists (do not touch it).

B. PHP and SSL
4. MultiPHP Manager -> set SITE_DOMAIN to PHP 8.1 or newer (8.2/8.3 fine).
5. Select PHP Version / MultiPHP INI Editor -> enable extensions: pdo_mysql (mysqlnd), mbstring, gd, fileinfo, intl, json, openssl, curl. Set upload_max_filesize and post_max_size to 8M or higher, memory_limit 256M, display_errors Off.
6. SSL/TLS Status -> run AutoSSL for SITE_DOMAIN. Wait until it shows a valid certificate (retry later if pending; continue other steps meanwhile).

C. Getting files onto the server (use the first route that works)
Route 1 - Git Version Control: cPanel -> Git Version Control -> Clone the repository given in FILES into /home/<user>/nre_repo (use the HTTPS URL; if the repo is private, stop and ask me for a deploy key/token path, never ask me to paste a token in chat). Then use File Manager to copy: nre_backend/ -> /home/<user>/nre_backend/, public_html contents -> DOC_ROOT.
Route 2 - Terminal (if available): run the exact commands to download/unzip the provided release zips into the right folders.
Route 3 - File Manager upload: upload the zips named in FILES (nre_backend.zip -> /home/<user>/, public_html.zip -> DOC_ROOT (contains .htaccess, api/, uploads/, assets/); then upload the frontend build (dist/ contents) into DOC_ROOT without overwriting those), then Extract. If the file picker dialog cannot be driven from the browser, tell me exactly which files to select and wait for me to do the upload, then continue.
Final layout must be:
  /home/<user>/nre_backend/{config.php, src/, storage/}
  DOC_ROOT/{index.html, assets/, .htaccess, api/{index.php,.htaccess}, uploads/.htaccess}

D. Database
7. MySQL Database Wizard: create database <prefix>_DB_NAME_SUFFIX, create user <prefix>_DB_USER_SUFFIX with a strong generated password (24+ chars, letters+digits only to avoid escaping problems), grant ALL PRIVILEGES. Keep the password ONLY in the config file you write in step 10 and in the final private note to me (see REPORT). Do not type it anywhere else.
8. Import into that empty database, in this order: NRE_mysql_schema.sql, then NRE_mysql_seed.sql.
   - Best: Terminal -> mysql -u <dbuser> -p <dbname> < file.sql (enter the password in the terminal prompt only).
   - Else phpMyAdmin -> select the database -> Import -> choose file (if the file dialog is blocked, ask me to choose it, or open the SQL tab and paste the file contents in chunks of complete statements; never skip statements).
   - Both files must finish with no errors.
9. Verify in phpMyAdmin: 28 tables + 6 views exist; products = 19, product_variants = 19, categories = 3, clients = 20, certifications = 6; users = 0.

E. Backend configuration
10. In File Manager, copy nre_backend/config.sample.php to config.php and edit: DB_HOST=localhost, DB_NAME, DB_USER, DB_PASS (generated), APP_URL=https://SITE_DOMAIN, APP_ENV=production, APP_KEY=<random 64 hex chars>, ALLOW_REGISTRATION=true (temporarily), mail settings left default. Set permissions: config.php 640, nre_backend/storage and subfolders 750 (or 755 if the host requires it for PHP to write). Confirm storage/logs and storage/enquiries are writable by PHP (healthcheck in step 12 will confirm).
11. Confirm DOC_ROOT/uploads/products and uploads/clients exist and are writable (755) and that uploads/.htaccess is present.

F. Smoke tests (open each in a new tab; fix and retest until all pass)
12. https://SITE_DOMAIN/api/v1/public/settings returns JSON with company_name "NR Enterprise". Open https://SITE_DOMAIN/api/v1/health?key=<HEALTHCHECK_KEY from config> and confirm all_ok is true (db, storage writable, extensions present, tables 34). Without the key it must return 404.
13. https://SITE_DOMAIN/ shows the home page with the NR logo and product images (no broken images). Open /products and a product page directly in the address bar (not by clicking) - they must load (SPA fallback works).
14. https://SITE_DOMAIN/api/v1/stock (no login) returns 401 JSON, not data.
15. HTTP redirects to HTTPS.
16. Submit the website quote form once with test data (name "Deploy Test"); confirm it succeeds. Later, delete this test row from the enquiries table via phpMyAdmin once the admin exists.
17. Open /admin/login. Register the first user with ADMIN_EMAIL and a password I type myself (stop here and ask me to type the password; do not generate or see it). Confirm the first user lands in the admin dashboard as admin.
18. As admin: Settings -> Users -> create a "staff" test user is NOT needed now. Skip.

G. Lock down
19. Edit config.php: set ALLOW_REGISTRATION=false. Retest /admin/login still works and /auth/register is refused.
20. Cron Jobs: add a daily job at 02:30 running the backup script (deploy/backup.sh) or the mysqldump command from NRE_BACKEND_API.md section 8, with output to /home/<user>/backups/. Create ~/backups if missing. Run it once manually (Terminal) and confirm a .sql.gz file appears.
21. Check that these are NOT web-accessible (expect 403/404): /nre_backend/ paths cannot exist under DOC_ROOT; https://SITE_DOMAIN/api/../config.php; https://SITE_DOMAIN/uploads/test.php (create a harmless test.php in uploads, confirm it is not executed, then delete it); directory listing of /uploads/.
22. Error handling: confirm display_errors is Off (visit a bad API route and see clean JSON).

REPORT (final message, plain and short)
- Pass/fail table for steps 1-22 (fail = what was seen).
- URLs: site, admin login, API settings endpoint.
- Created items: database name, DB user name, folders created, cron job, PHP version set.
- PRIVATE NOTE FOR ME: the generated DB password and APP_KEY location (config file path). Tell me to save the password in my password manager and not share the chat.
- Anything skipped, anything I must do (e.g. upload a file, add Facebook/YouTube URLs later, replace low-resolution photos, confirm client logo permissions, fill company BIN/bank details in Settings).
- What the pre-deploy state of DOC_ROOT was and where the backup is.
```

---

## Notes

- **"No permission needed":** the prompt tells the agent to proceed on its own, but it cannot switch off the browser extension's own safety prompts. Pre-approve the cPanel domain and the site domain in the extension settings so it rarely stops. It will still stop for passwords/OTP/captcha, payments and anything outside this project, on purpose.
- **Never paste your cPanel password into the prompt.** Log in yourself first.
- **File upload is the weak spot** for any browser agent (native file dialogs). The most reliable setup is Route 1 (a private GitHub repo + cPanel Git Version Control) or Route 2 (cPanel Terminal).
- **Faster and safer alternative for the heavy parts:** if your hosting has SSH or lets you create a cPanel API token, Claude Code can do steps C to E from your computer (rsync/scp, mysql import, config) and use the browser only for AutoSSL and checks. Ask for that variant if you want it.
- Run this only after the backend phases are finished and tested locally (Claude Code Phase 10), and the frontend is built with `VITE_USE_MOCK=false`.
