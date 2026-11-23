import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Archive, ImageOff, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/nre/DataTable";
import { PageHeader } from "@/components/nre/PageHeader";
import { apiFieldErrors, useCatalogueAccess } from "@/components/catalogue/shared";
import { adminApi } from "@/lib/api";
import { formatQty } from "@/lib/money";
import { adminCategoriesQuery, adminProductsQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";
import type { AdminProductSummary } from "@/lib/types";

export const Route = createFileRoute("/admin/products/")({
  head: () => noIndexPageHead("Products — NR Enterprise Admin", "Manage the NR Enterprise product catalogue, variants and website visibility."),
  component: ProductList,
});

const PER_PAGE = 20;

function ProductList() {
  const { userId, role, ready, canEdit, invalidate } = useCatalogueAccess();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [categoryId, setCategoryId] = useState(0);
  const [status, setStatus] = useState<"" | "active" | "archived">("active");
  const query = { page, per_page: PER_PAGE, ...(q ? { q } : {}), ...(categoryId ? { category_id: categoryId } : {}), ...(status ? { status } : {}) };
  const products = useQuery({ ...adminProductsQuery(userId, role, query), enabled: ready });
  const categories = useQuery({ ...adminCategoriesQuery(userId, role), enabled: ready });

  const archive = async (p: AdminProductSummary) => {
    if (!window.confirm(`Archive “${p.name}”? It will be hidden from the website.`)) return;
    try { await adminApi.archiveProduct(p.id); toast.success("Product archived."); await invalidate(); } catch (e) { apiFieldErrors(e); }
  };

  const columns: Column<AdminProductSummary>[] = [
    { key: "image", header: "Image", exportValue: (p) => p.primary_image ?? "", cell: (p) => p.primary_image
      ? <img src={p.primary_image} alt="" className="size-11 rounded-lg border object-cover" loading="lazy" />
      : <span className="grid size-11 place-items-center rounded-lg border bg-muted"><ImageOff className="size-4 text-muted-foreground" /></span> },
    { key: "name", header: "Name", exportValue: (p) => p.name, cell: (p) => <Link to="/admin/products/$productId" params={{ productId: String(p.id) }} className="font-semibold hover:underline">{p.name}</Link> },
    { key: "code", header: "Code", exportValue: (p) => p.code, cell: (p) => <span className="font-mono text-xs">{p.code}</span> },
    { key: "category", header: "Category", exportValue: (p) => p.category.name, cell: (p) => p.category.name },
    { key: "variants", header: "Variants", align: "right", exportValue: (p) => p.variant_count, cell: (p) => p.variant_count },
    { key: "stock", header: "Total stock", align: "right", exportValue: (p) => p.total_stock, cell: (p) => formatQty(p.total_stock, p.unit_code) },
    { key: "web", header: "Website", exportValue: (p) => p.show_on_website, cell: (p) => <Badge variant={p.show_on_website ? "secondary" : "outline"}>{p.show_on_website ? "Visible" : "Hidden"}</Badge> },
    { key: "featured", header: "Featured", exportValue: (p) => p.is_featured, cell: (p) => (p.is_featured ? "★" : "—") },
    { key: "status", header: "Status", exportValue: (p) => (p.is_active ? "Active" : "Archived"), cell: (p) => <Badge variant={p.is_active ? "default" : "outline"}>{p.is_active ? "Active" : "Archived"}</Badge> },
    { key: "actions", header: "", align: "right", cell: (p) => (
      <div className="flex justify-end gap-1">
        <Button asChild size="icon" variant="ghost" aria-label={`Open ${p.name}`}><Link to="/admin/products/$productId" params={{ productId: String(p.id) }}><Pencil className="size-4" /></Link></Button>
        {canEdit && p.is_active && <Button size="icon" variant="ghost" aria-label={`Archive ${p.name}`} onClick={() => void archive(p)}><Archive className="size-4" /></Button>}
      </div>) },
  ];

  return (
    <>
      <PageHeader title="Products" description={canEdit ? "Edit products, variants, photos and website visibility." : "View the catalogue. Ask a manager to make changes."}
        actions={canEdit && <Button onClick={() => void navigate({ to: "/admin/products/new" })}><Plus className="size-4" /> New product</Button>} />
      <DataTable columns={columns} rows={products.data?.data ?? []} rowKey={(p) => p.id} page={page} perPage={PER_PAGE} total={products.data?.meta.total ?? 0}
        onPageChange={setPage} search={q} onSearchChange={(v) => { setQ(v); setPage(1); }} searchPlaceholder="Search name or code…"
        loading={products.isLoading} error={products.error ? "Could not load products." : null} emptyTitle="No products match" exportFileName="nr-products"
        filters={[
          { id: "active", label: "Active", active: status === "active", onSelect: () => { setStatus("active"); setPage(1); } },
          { id: "archived", label: "Archived", active: status === "archived", onSelect: () => { setStatus("archived"); setPage(1); } },
          { id: "all", label: "All", active: status === "", onSelect: () => { setStatus(""); setPage(1); } },
        ]}
        toolbar={
          <Select value={String(categoryId)} onValueChange={(v) => { setCategoryId(Number(v)); setPage(1); }}>
            <SelectTrigger className="w-full rounded-full sm:w-56" aria-label="Filter by category"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">All categories</SelectItem>
              {(categories.data ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        } />
    </>
  );
}
