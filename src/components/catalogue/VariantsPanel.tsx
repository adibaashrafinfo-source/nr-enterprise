import { useState } from "react";
import { Archive, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormDialog } from "@/components/nre/FormDialog";
import { adminApi } from "@/lib/api";
import { formatBDT, formatQty } from "@/lib/money";
import type { AdminProduct, Variant, VariantInput } from "@/lib/types";
import { apiFieldErrors, Field, type useCatalogueAccess } from "./shared";

const blank = (): VariantInput => ({ sku: "", name: "", color: null, size: null, material: null, pack_size: null, selling_price: "", reorder_level: "0", is_active: true, purchase_price: "" });
const fromVariant = (v: Variant): VariantInput => ({ sku: v.sku, name: v.name, color: v.color, size: v.size, material: v.material, pack_size: v.pack_size, selling_price: v.selling_price, reorder_level: v.reorder_level, is_active: v.is_active, purchase_price: v.purchase_price ?? "" });
const num = (s: string) => s.replace(/[^\d.]/g, "");

export function VariantsPanel({ product, access }: { product: AdminProduct; access: ReturnType<typeof useCatalogueAccess> }) {
  const { canEdit, invalidate } = access;
  const [editing, setEditing] = useState<Variant | "new" | null>(null);
  const [form, setForm] = useState<VariantInput>(blank());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const open = (v: Variant | "new") => { setEditing(v); setErrors({}); setForm(v === "new" ? blank() : fromVariant(v)); };
  const text = (k: "sku" | "name" | "color" | "size" | "material") => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: k === "sku" || k === "name" ? e.target.value : e.target.value || null }));

  const submit = async () => {
    setSaving(true); setErrors({});
    const { purchase_price, ...rest } = form;
    const input: VariantInput = { ...rest, ...(canEdit && purchase_price ? { purchase_price } : {}) };
    try {
      if (editing === "new") await adminApi.createVariant(product.id, input); else if (editing) await adminApi.updateVariant(editing.id, input);
      toast.success("Variant saved."); setEditing(null); await invalidate();
    } catch (e) { setErrors(apiFieldErrors(e)); } finally { setSaving(false); }
  };
  const archive = async (v: Variant) => {
    try { await adminApi.archiveVariant(v.id); toast.success("Variant archived."); await invalidate(); } catch (e) { apiFieldErrors(e); }
  };

  return (
    <section className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-semibold">Variants</h2><p className="text-sm text-muted-foreground">Each colour, size or pack you sell. Leave SKU empty to create one automatically.</p></div>
        {canEdit && <Button type="button" onClick={() => open("new")}><Plus className="size-4" /> Add variant</Button>}
      </div>
      {product.variants.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No variants yet.</p> : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>SKU</TableHead><TableHead>Name</TableHead><TableHead>Colour</TableHead><TableHead>Size / width</TableHead><TableHead>Material</TableHead><TableHead className="text-right">Pack</TableHead>
              <TableHead className="text-right">Selling price</TableHead>{canEdit && <TableHead className="text-right">Purchase price</TableHead>}
              <TableHead className="text-right">Reorder at</TableHead><TableHead className="text-right">Stock</TableHead><TableHead>Status</TableHead>{canEdit && <TableHead />}
            </TableRow></TableHeader>
            <TableBody>
              {product.variants.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-xs">{v.sku}</TableCell><TableCell className="font-medium">{v.name}</TableCell>
                  <TableCell>{v.color ?? "—"}</TableCell><TableCell>{v.size ?? "—"}</TableCell><TableCell>{v.material ?? "—"}</TableCell>
                  <TableCell className="text-right">{v.pack_size ?? "—"}</TableCell><TableCell className="text-right">{formatBDT(v.selling_price)}</TableCell>
                  {canEdit && <TableCell className="text-right">{v.purchase_price ? formatBDT(v.purchase_price) : "—"}</TableCell>}
                  <TableCell className="text-right">{formatQty(v.reorder_level)}</TableCell><TableCell className="text-right">{formatQty(v.stock_qty, product.unit_code)}</TableCell>
                  <TableCell><Badge variant={v.is_active ? "secondary" : "outline"}>{v.is_active ? "Active" : "Archived"}</Badge></TableCell>
                  {canEdit && <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" aria-label={`Edit ${v.sku}`} onClick={() => open(v)}><Pencil className="size-4" /></Button>
                    {v.is_active && <Button size="icon" variant="ghost" aria-label={`Archive ${v.sku}`} onClick={() => void archive(v)}><Archive className="size-4" /></Button>}
                  </TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {canEdit && <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "Add variant" : "Edit variant"} onSubmit={() => void submit()} submitting={saving}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="v-name" label="Name *" error={errors["name"]}><Input id="v-name" value={form.name} aria-invalid={!!errors["name"]} onChange={text("name")} /></Field>
          <Field id="v-sku" label="SKU" error={errors["sku"]} hint="Leave empty to create automatically."><Input id="v-sku" value={form.sku} aria-invalid={!!errors["sku"]} onChange={text("sku")} /></Field>
          <Field id="v-color" label="Colour"><Input id="v-color" value={form.color ?? ""} onChange={text("color")} /></Field>
          <Field id="v-size" label="Size / width"><Input id="v-size" value={form.size ?? ""} onChange={text("size")} /></Field>
          <Field id="v-material" label="Material"><Input id="v-material" value={form.material ?? ""} onChange={text("material")} /></Field>
          <Field id="v-pack" label="Pack size"><Input id="v-pack" inputMode="decimal" value={form.pack_size ?? ""} onChange={(e) => setForm((f) => ({ ...f, pack_size: num(e.target.value) || null }))} /></Field>
          <Field id="v-price" label="Selling price (৳) *" error={errors["selling_price"]}><Input id="v-price" inputMode="decimal" value={form.selling_price} aria-invalid={!!errors["selling_price"]} onChange={(e) => setForm((f) => ({ ...f, selling_price: num(e.target.value) }))} /></Field>
          <Field id="v-cost" label="Purchase price (৳)" error={errors["purchase_price"]}><Input id="v-cost" inputMode="decimal" value={form.purchase_price ?? ""} onChange={(e) => setForm((f) => ({ ...f, purchase_price: num(e.target.value) }))} /></Field>
          <Field id="v-reorder" label="Reorder level"><Input id="v-reorder" inputMode="decimal" value={form.reorder_level} onChange={(e) => setForm((f) => ({ ...f, reorder_level: num(e.target.value) }))} /></Field>
          <label className="flex items-center justify-between gap-3 self-end rounded-xl border p-3 text-sm font-medium">Active<Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} /></label>
        </div>
      </FormDialog>}
    </section>
  );
}
