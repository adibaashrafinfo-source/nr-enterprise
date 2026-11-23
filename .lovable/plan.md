# Phase 4 — Catalogue management

## Goal
Complete the admin catalogue workflow for products, variants, images, categories, units, and spreadsheet imports.

## Work
1. Add typed admin catalogue API methods and account-scoped query options; mirror product, image, variant, category, unit, and import operations in the mock adapter with the PHP API’s response shapes and validation errors.
2. Turn `/admin/products` into the catalogue layout and keep its URL as the product-list page. Add product create/edit views with Basic, Images, Specs, Variants, and Website/SEO tabs.
3. Build the searchable, category/status-filtered product table with stock, visibility, featured, status, and safe archive actions.
4. Add image upload, primary-image selection, ordering, and deletion; add variant create/edit/archive with automatic SKU generation and manager/admin-only purchase cost.
5. Add category and unit management screens with create, edit, and guarded delete behavior.
6. Add CSV/Excel import using the installed spreadsheet library, including column mapping, row preview, validation errors, and API submission.
7. Add tests for role privacy, catalogue mock operations, SKU errors, image rules, category/unit validation, and import results; verify create-to-public display, staff read-only access, and mobile usability.

## Technical details
- Keep the existing architecture: call the owner’s PHP API through `src/lib/api.ts`; use the mock adapter when enabled. Do not add Lovable Cloud or another backend.
- Preserve `/admin/products` by rendering an `Outlet` in its layout and moving the list into its index route; place editor and catalogue-management views beneath it.
- Keep money and quantities as decimal strings. Staff must never receive or render purchase-price data; only managers and admins can edit cost fields.
- Reuse the existing `xlsx` dependency and invalidate account-scoped catalogue queries after mutations.

## Acceptance checks
- A product can be created with three variants and two images, then appears on the public catalogue when enabled for the website.
- Staff can view products but cannot edit/import or see purchase-price fields; API mocks enforce the same boundary.
- SKU conflicts, archive conflicts, upload validation, category/unit rules, and import row errors appear clearly.
- Catalogue list, editor, image controls, and management screens work at mobile and desktop sizes.