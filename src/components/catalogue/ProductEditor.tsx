import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { PageHeader } from "@/components/nre/PageHeader";
import spec from "@/data/spec.json";
import { adminApi } from "@/lib/api";
import { adminCategoriesQuery, adminProductQuery, adminUnitsQuery } from "@/lib/queries";
import type { AdminCategory, AdminProduct, ProductInput } from "@/lib/types";
import { apiFieldErrors, Field, slugify, useCatalogueAccess } from "./shared";
import { ImagesPanel } from "./ImagesPanel";
import { VariantsPanel } from "./VariantsPanel";

type SpecProduct = { category_slug: string; specs: { fields?: string[] } };
/** Spec field template per category, taken from the catalogue spec. */
export function specFieldsFor(categorySlug: string | undefined): string[] {
  const fields = new Set<string>();
  for (const p of spec.products as SpecProduct[]) if (p.category_slug === categorySlug) p.specs.fields?.forEach((f) => fields.add(f));
  return [...fields];
}
const fieldLabel = (f: string) => f.replace(/_/g, " ").replace(/\bmm\b/, "(mm)").replace(/^\w/, (c) => c.toUpperCase());

const EMPTY: ProductInput = { name: "", slug: "", code: "", category_id: 0, unit_code: "pcs", moq: "", short_description: "", description: "", features: [], specs: {}, show_on_website: true, is_featured: false, seo_title: null, seo_description: null };
const toInput = (p: AdminProduct): ProductInput => ({ name: p.name, slug: p.slug, code: p.code, category_id: p.category.id, unit_code: p.unit_code, moq: p.moq, short_description: p.short_description, description: p.description, features: p.features, specs: p.specs, show_on_website: p.show_on_website, is_featured: p.is_featured, is_active: p.is_active, seo_title: p.seo_title, seo_description: p.seo_description });

export function ProductEditor({ productId }: { productId?: number }) {
  const access = useCatalogueAccess();
  const { userId, role, ready, canEdit, invalidate } = access;
  const navigate = useNavigate();
  const product = useQuery({ ...adminProductQuery(userId, role, productId ?? 0), enabled: ready && !!productId });
  const categories = useQuery({ ...adminCategoriesQuery(userId, role), enabled: ready });
  const units = useQuery({ ...adminUnitsQuery(userId, role), enabled: ready });
  const [form, setForm] = useState<ProductInput>(EMPTY);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (product.data) { setForm(toInput(product.data)); setSlugTouched(true); } }, [product.data]);

  if (productId && (product.isLoading || !ready)) return <LoadingSkeleton rows={6} />;
  if (productId && product.error) return <p className="text-destructive">This product could not be loaded.</p>;

  const set = <K extends keyof ProductInput>(k: K, v: ProductInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const category: AdminCategory | undefined = categories.data?.find((c) => c.id === form.category_id);
  const specFields = specFieldsFor(category?.slug);
  const disabled = !canEdit;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true); setErrors({});
    try {
      const input = { ...form, features: form.features.map((f) => f.trim()).filter(Boolean) };
      if (productId) { await adminApi.updateProduct(productId, input); toast.success("Product saved."); }
      else {
        const created = await adminApi.createProduct(input);
        toast.success("Product created. Add photos and variants next.");
        await invalidate();
        void navigate({ to: "/admin/products/$productId", params: { productId: String(created.id) } });
        return;
      }
      await invalidate();
    } catch (err) { setErrors(apiFieldErrors(err)); } finally { setSaving(false); }
  };

  const err = (k: string) => errors[k];
  const saveBar = canEdit && (
    <div className="flex justify-end border-t pt-4"><Button type="submit" disabled={saving}>{saving ? "Saving…" : productId ? "Save changes" : "Create product"}</Button></div>
  );

  return (
    <>
      <PageHeader title={productId ? product.data?.name ?? "Product" : "New product"} description={canEdit ? "Fields marked * are required." : "Read-only view."}
        actions={<Button variant="outline" onClick={() => void navigate({ to: "/admin/products" })}>Back to list</Button>} />
      <Tabs defaultValue="basic">
          <TabsList className="mb-4 flex h-auto flex-wrap justify-start">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="images" disabled={!productId}>Images</TabsTrigger>
            <TabsTrigger value="specs">Specs</TabsTrigger>
            <TabsTrigger value="variants" disabled={!productId}>Variants</TabsTrigger>
            <TabsTrigger value="web">Website & SEO</TabsTrigger>
          </TabsList>
            <TabsContent value="basic" className="mt-0"><Panel onSubmit={save} disabled={disabled}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="name" label="Name *" error={err("name")}><Input id="name" value={form.name} aria-invalid={!!err("name")} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) }))} /></Field>
                <Field id="slug" label="Slug *" error={err("slug")} hint="Used in the website address."><Input id="slug" value={form.slug} aria-invalid={!!err("slug")} onChange={(e) => { setSlugTouched(true); set("slug", slugify(e.target.value)); }} /></Field>
                <Field id="code" label="Code *" error={err("code")}><Input id="code" value={form.code} aria-invalid={!!err("code")} onChange={(e) => set("code", e.target.value.toUpperCase())} /></Field>
                <Field id="category" label="Category *" error={err("category_id")}>
                  <Select value={form.category_id ? String(form.category_id) : ""} onValueChange={(v) => set("category_id", Number(v))} disabled={disabled}>
                    <SelectTrigger id="category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                    <SelectContent>{(categories.data ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field id="unit" label="Unit *" error={err("unit_code")}>
                  <Select value={form.unit_code} onValueChange={(v) => set("unit_code", v)} disabled={disabled}>
                    <SelectTrigger id="unit"><SelectValue /></SelectTrigger>
                    <SelectContent>{(units.data ?? []).filter((u) => u.is_active || u.code === form.unit_code).map((u) => <SelectItem key={u.code} value={u.code}>{u.name} ({u.code})</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field id="moq" label="Minimum order quantity *" error={err("moq")}><Input id="moq" inputMode="decimal" value={form.moq} aria-invalid={!!err("moq")} onChange={(e) => set("moq", e.target.value.replace(/[^\d.]/g, ""))} /></Field>
              </div>
              <Field id="short" label="Short description"><Textarea id="short" rows={2} value={form.short_description} onChange={(e) => set("short_description", e.target.value)} /></Field>
              <Field id="desc" label="Full description"><Textarea id="desc" rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
              <div className="space-y-2">
                <p className="text-sm font-medium">Features</p>
                {form.features.map((f, i) => (
                  <div key={i} className="flex gap-2">
                    <Input aria-label={`Feature ${i + 1}`} value={f} onChange={(e) => set("features", form.features.map((x, j) => (j === i ? e.target.value : x)))} />
                    <Button type="button" size="icon" variant="ghost" aria-label="Remove feature" onClick={() => set("features", form.features.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={() => set("features", [...form.features, ""])}><Plus className="size-4" /> Add feature</Button>
              </div>
              {saveBar}
            </Panel></TabsContent>
            <TabsContent value="images" className="mt-0">{product.data && <ImagesPanel product={product.data} access={access} />}</TabsContent>
            <TabsContent value="variants" className="mt-0">{product.data && <VariantsPanel product={product.data} access={access} />}</TabsContent>
            <TabsContent value="specs" className="mt-0"><Panel onSubmit={save} disabled={disabled}>
              {!category ? <p className="text-sm text-muted-foreground">Choose a category on the Basic tab first.</p> : specFields.length === 0 ? <p className="text-sm text-muted-foreground">This category has no specification fields.</p> : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {specFields.map((f) => (
                    <Field key={f} id={`spec-${f}`} label={fieldLabel(f)}>
                      <Input id={`spec-${f}`} value={String((form.specs["values"] as Record<string, string> | undefined)?.[f] ?? "")}
                        onChange={(e) => set("specs", { ...form.specs, values: { ...((form.specs["values"] as Record<string, string> | undefined) ?? {}), [f]: e.target.value } })} />
                    </Field>
                  ))}
                </div>
              )}
              {saveBar}
            </Panel></TabsContent>
            <TabsContent value="web" className="mt-0"><Panel onSubmit={save} disabled={disabled}>
              <label className="flex items-center justify-between gap-4 rounded-xl border p-3"><span><span className="block font-medium">Show on website</span><span className="text-sm text-muted-foreground">Hidden products stay in the admin only.</span></span><Switch checked={form.show_on_website} onCheckedChange={(v) => set("show_on_website", v)} /></label>
              <label className="flex items-center justify-between gap-4 rounded-xl border p-3"><span><span className="block font-medium">Featured</span><span className="text-sm text-muted-foreground">Shown on the home page.</span></span><Switch checked={form.is_featured} onCheckedChange={(v) => set("is_featured", v)} /></label>
              {productId && <label className="flex items-center justify-between gap-4 rounded-xl border p-3"><span><span className="block font-medium">Active</span><span className="text-sm text-muted-foreground">Turn off to archive this product.</span></span><Switch checked={form.is_active ?? true} onCheckedChange={(v) => set("is_active", v)} /></label>}
              <Field id="seo-title" label="SEO title" hint={`${(form.seo_title ?? "").length}/60 characters`}><Input id="seo-title" maxLength={70} value={form.seo_title ?? ""} onChange={(e) => set("seo_title", e.target.value || null)} /></Field>
              <Field id="seo-desc" label="SEO description" hint={`${(form.seo_description ?? "").length}/160 characters`}><Textarea id="seo-desc" maxLength={170} rows={3} value={form.seo_description ?? ""} onChange={(e) => set("seo_description", e.target.value || null)} /></Field>
              {saveBar}
            </Panel></TabsContent>
      </Tabs>
    </>
  );
}

function Panel({ children, onSubmit, disabled }: { children: ReactNode; onSubmit: (e: FormEvent) => void; disabled: boolean }) {
  return <form onSubmit={onSubmit} className="rounded-2xl border bg-card p-5 shadow-soft"><fieldset disabled={disabled} className="space-y-4">{children}</fieldset></form>;
}
