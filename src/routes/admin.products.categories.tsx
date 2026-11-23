import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormDialog } from "@/components/nre/FormDialog";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { PageHeader } from "@/components/nre/PageHeader";
import { apiFieldErrors, Field, slugify, useCatalogueAccess } from "@/components/catalogue/shared";
import { adminApi } from "@/lib/api";
import { adminCategoriesQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";
import type { AdminCategory, CategoryInput } from "@/lib/types";

export const Route = createFileRoute("/admin/products/categories")({
  head: () => noIndexPageHead("Categories — NR Enterprise Admin", "Manage product categories shown on the NR Enterprise website."),
  component: Categories,
});

const blank: CategoryInput = { slug: "", name: "", description: "", image_url: "", sort_order: 0, is_active: true };

function Categories() {
  const { userId, role, ready, canEdit, invalidate } = useCatalogueAccess();
  const list = useQuery({ ...adminCategoriesQuery(userId, role), enabled: ready });
  const [editing, setEditing] = useState<AdminCategory | "new" | null>(null);
  const [form, setForm] = useState<CategoryInput>(blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const open = (c: AdminCategory | "new") => {
    setEditing(c); setErrors({});
    setForm(c === "new" ? { ...blank, sort_order: (list.data?.length ?? 0) + 1 } : { slug: c.slug, name: c.name, description: c.description, image_url: c.image_url, sort_order: c.sort_order, is_active: c.is_active });
  };
  const submit = async () => {
    setSaving(true); setErrors({});
    try {
      if (editing === "new") await adminApi.createCategory(form); else if (editing) await adminApi.updateCategory(editing.id, form);
      toast.success("Category saved."); setEditing(null); await invalidate();
    } catch (e) { setErrors(apiFieldErrors(e)); } finally { setSaving(false); }
  };
  const remove = async (c: AdminCategory) => {
    if (!window.confirm(`Delete “${c.name}”?`)) return;
    try { await adminApi.deleteCategory(c.id); toast.success("Category deleted."); await invalidate(); } catch (e) { apiFieldErrors(e); }
  };

  return (
    <>
      <PageHeader title="Categories" description="Group products for the website menu and filters." actions={canEdit && <Button onClick={() => open("new")}><Plus className="size-4" /> New category</Button>} />
      {list.isLoading || !ready ? <LoadingSkeleton rows={5} /> : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
          <Table>
            <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Name</TableHead><TableHead>Slug</TableHead><TableHead className="text-right">Products</TableHead><TableHead>Status</TableHead>{canEdit && <TableHead />}</TableRow></TableHeader>
            <TableBody>
              {(list.data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.sort_order}</TableCell><TableCell className="font-medium">{c.name}</TableCell><TableCell className="font-mono text-xs">{c.slug}</TableCell>
                  <TableCell className="text-right">{c.product_count ?? 0}</TableCell>
                  <TableCell><Badge variant={c.is_active ? "secondary" : "outline"}>{c.is_active ? "Active" : "Hidden"}</Badge></TableCell>
                  {canEdit && <TableCell className="whitespace-nowrap text-right">
                    <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => open(c)}><Pencil className="size-4" /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => void remove(c)}><Trash2 className="size-4" /></Button>
                  </TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {canEdit && <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "New category" : "Edit category"} onSubmit={() => void submit()} submitting={saving}>
        <Field id="c-name" label="Name *" error={errors["name"]}><Input id="c-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, ...(editing === "new" ? { slug: slugify(e.target.value) } : {}) }))} /></Field>
        <Field id="c-slug" label="Slug *" error={errors["slug"]}><Input id="c-slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))} /></Field>
        <Field id="c-desc" label="Description"><Textarea id="c-desc" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></Field>
        <Field id="c-img" label="Image address"><Input id="c-img" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} /></Field>
        <Field id="c-order" label="Display order"><Input id="c-order" type="number" min={0} value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))} /></Field>
        <label className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium">Active<Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} /></label>
      </FormDialog>}
    </>
  );
}
