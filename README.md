# NR Enterprise

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://nr-enterprise.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/be242f21-9375-47ae-9607-64e3ac63fdae).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Backend + cPanel deploy

- `backend/nre_backend/` PHP 8.1+ REST API (lives OUTSIDE public_html), `backend/public_html/` API front controller + .htaccess + uploads skeleton
- `database/` MySQL schema + seed
- `frontend-dist/` prebuilt static site (`npm run build:cpanel` rebuilds it; VITE_USE_MOCK=false)
- `.cpanel.yml` copies everything to `~/nre_backend` and `~/public_html` via cPanel Git Version Control
- `docs/DEPLOY_CPANEL.md` manual steps, `docs/NRE_CHROME_DEPLOY_PROMPT.md` Claude-in-Chrome deploy prompt, `docs/NRE_BACKEND_API.md` API contract
- Tests: `backend/nre_backend/tests/run_all.sh database/NRE_mysql_schema.sql database/NRE_mysql_seed.sql` (needs local MariaDB)
