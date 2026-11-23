# Phase 3: Admin dashboard and workspace

Implement the next documented NR Enterprise phase using the existing PHP API client and mock mode. `seed15.txt` was not uploaded, so the project Phase 3 specifications are the source of truth.

## Work
- Recheck the reported render-state crash during fresh loads, auth changes, and route transitions; fix and regression-test any source-level cause found.
- Complete the role-aware admin shell: responsive sidebar, grouped global search, breadcrumbs, user menu and password change; preserve the no-role approval screen and staff restrictions.
- Add typed dashboard/search API calls and equivalent deterministic mock responses; render KPI cards, the 7/30-day sales chart, low-stock items, recent invoices, new enquiries, and quick actions.
- Make forgot/reset-password routes functional through the existing API client and demo mocks.
- Finish the shared data table features required by Phase 3 while retaining the existing form and confirmation dialogs.
- Add focused tests for role visibility, staff stock-value privacy, and dashboard mock data; verify admin, manager, staff, pending-user, and mobile flows.

## Technical details
- Keep all requests in the browser through `src/lib/api.ts`; do not add Lovable Cloud or server-side protected fetches.
- Use decimal-string money helpers and existing design-system tokens/components.
- Do not show stock value to staff; only authenticated users with an assigned role receive dashboard content.
