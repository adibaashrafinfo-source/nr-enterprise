<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## NR Enterprise rules
- Specs live in docs/ (PRD, API contract, spec JSON); src/data/spec.json is a copy used for mock seed data — why: one source of truth for copy and catalogue.
- No Lovable Cloud/Supabase: the browser talks only to the owner's PHP REST API at /api/v1 through src/lib/api.ts; src/mocks/ mirrors the same shapes when VITE_USE_MOCK is not "false" — why: backend is a separate cPanel PHP+MySQL app.
- Public data loads via src/lib/queries.ts queryOptions; loaders prefetch only when canPrefetch() and router.tsx dehydrates them with router-ssr-query — why: SSR/hydration must match and real API is unreachable from the server.
- Money/quantities stay decimal strings; use src/lib/money.ts, never float sums — why: server owns totals.
- Public pages sit under the pathless _site layout; admin pages under admin.tsx (guard + AdminLayout); login/reset pages use admin_ prefix to skip the guard — why: separate shells.
