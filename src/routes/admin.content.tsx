import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertTriangle, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/nre/EmptyState";
import { FormDialog } from "@/components/nre/FormDialog";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { PageHeader } from "@/components/nre/PageHeader";
import { Field, apiFieldErrors, useCatalogueAccess } from "@/components/catalogue/shared";
import { fileToUrl } from "@/components/backoffice/file-to-url";
import { adminApi } from "@/lib/api";
import { noIndexPageHead } from "@/lib/seo";
import type { AdminCertification, AdminClient, CertificationInput, ClientInput } from "@/lib/types";

export const Route = createFileRoute("/admin/content")({
  head: () => noIndexPageHead("Website content — NR Enterprise Admin", "Manage public-facing NR Enterprise client and website content."),
  component: Content,
});

function Content() {
  const { ready, canEdit } = useCatalogueAccess();
  if (ready && !canEdit) return <EmptyState title="Managers only" description="Ask a manager to change website content." />;
  return (
    <>
      <PageHeader title="Website content" description="Choose which client logos and certifications appear on the public website." />
      <Tabs defaultValue="clients">
        <TabsList className="mb-4"><TabsTrigger value="clients">Clients</TabsTrigger><TabsTrigger value="certs">Certifications</TabsTrigger></TabsList>
        <TabsContent value="clients"><Clients /></TabsContent>
        <TabsContent value="certs"><Certifications /></TabsContent>
      </Tabs>
    </>
  );
}

function LogoInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      {value ? <img src={value} alt="" className="size-14 rounded-xl border bg-card object-contain" /> : <div className="size-14 rounded-xl border bg-muted" />}
      <Input type="file" accept="image/*" aria-label="Upload logo" onChange={(e) => { const f = e.target.files?.[0]; if (f) fileToUrl(f).then(onChange).catch((err: Error) => toast.error(err.message)); }} />
    </div>
  );
}

function Clients() {
  const { userId, role, ready, invalidate } = useCatalogueAccess();
  const q = useQuery({ queryKey: ["admin", userId, role, "content", "clients"], queryFn: adminApi.adminClients, enabled: ready });
  const [edit, setEdit] = useState<AdminClient | "new" | null>(null);
  const save = async (c: AdminClient, patch: Partial<ClientInput>) => {
    const { id, ...rest } = c;
    try { await adminApi.saveClient({ ...rest, ...patch }, id); await invalidate(); } catch (e) { apiFieldErrors(e); }
  };
  const remove = async (c: AdminClient) => { if (!window.confirm(`Delete ${c.name}?`)) return; try { await adminApi.deleteClient(c.id); toast.success("Client removed."); await invalidate(); } catch (e) { apiFieldErrors(e); } };
  if (q.isLoading) return <LoadingSkeleton rows={5} />;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button onClick={() => setEdit("new")}><Plus className="size-4" /> Add client</Button></div>
      <ul className="divide-y rounded-2xl border bg-card">
        {(q.data ?? []).map((c) => (
          <li key={c.id} className="flex flex-wrap items-center gap-4 p-3">
            <img src={c.logo_url} alt="" className="size-12 rounded-lg border bg-background object-contain" />
            <div className="min-w-40 flex-1"><p className="font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">Order {c.sort_order}</p>
              {!c.permission_confirmed && <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-warning"><AlertTriangle className="size-3" /> Hidden from the website until permission is confirmed</p>}</div>
            <label className="flex items-center gap-2 text-sm"><Switch checked={c.is_active} onCheckedChange={(v) => void save(c, { is_active: v })} aria-label={`Show ${c.name}`} /> Show</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={c.permission_confirmed} onCheckedChange={(v) => void save(c, { permission_confirmed: v })} aria-label={`Permission for ${c.name}`} /> Permission</label>
            <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setEdit(c)}><Pencil className="size-4" /></Button>
            <Button size="icon" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => void remove(c)}><Trash2 className="size-4" /></Button>
          </li>
        ))}
      </ul>
      <ClientDialog value={edit} onClose={() => setEdit(null)} onSaved={invalidate} nextOrder={(q.data?.length ?? 0) + 1} />
    </div>
  );
}

function ClientDialog({ value, onClose, onSaved, nextOrder }: { value: AdminClient | "new" | null; onClose: () => void; onSaved: () => Promise<unknown>; nextOrder: number }) {
  const [f, setF] = useState<ClientInput>({ name: "", logo_url: "", sort_order: 1, is_active: true, permission_confirmed: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (value) { setErrors({}); setF(value === "new" ? { name: "", logo_url: "", sort_order: nextOrder, is_active: true, permission_confirmed: false } : { name: value.name, logo_url: value.logo_url, sort_order: value.sort_order, is_active: value.is_active, permission_confirmed: value.permission_confirmed }); } }, [value, nextOrder]);
  if (!value) return null;
  const submit = async () => { try { await adminApi.saveClient(f, value === "new" ? undefined : value.id); toast.success("Client saved."); await onSaved(); onClose(); } catch (e) { setErrors(apiFieldErrors(e)); } };
  return (
    <FormDialog open onOpenChange={(o) => { if (!o) onClose(); }} title={value === "new" ? "Add client" : "Edit client"} onSubmit={() => void submit()}>
      <Field id="cl-name" label="Name *" error={errors["name"]}><Input id="cl-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field id="cl-logo" label="Logo"><LogoInput value={f.logo_url} onChange={(v) => setF({ ...f, logo_url: v })} /></Field>
      <Field id="cl-order" label="Sort order"><Input id="cl-order" type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} /></Field>
      <label className="flex items-center gap-2 text-sm"><Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} /> Show on website</label>
      <label className="flex items-center gap-2 text-sm"><Switch checked={f.permission_confirmed} onCheckedChange={(v) => setF({ ...f, permission_confirmed: v })} /> The client has allowed us to show their logo</label>
      {!f.permission_confirmed && <p className="flex items-center gap-2 rounded-xl bg-warning/10 p-3 text-sm text-warning"><AlertTriangle className="size-4 shrink-0" /> Without permission this logo stays hidden from the public website.</p>}
    </FormDialog>
  );
}

const EMPTY_CERT: CertificationInput = { name: "", description: null, certificate_number: null, image_url: null, is_published: false, holder_confirmed: false };
function Certifications() {
  const { userId, role, ready, invalidate } = useCatalogueAccess();
  const q = useQuery({ queryKey: ["admin", userId, role, "content", "certs"], queryFn: adminApi.adminCertifications, enabled: ready });
  const [edit, setEdit] = useState<AdminCertification | "new" | null>(null);
  const [f, setF] = useState<CertificationInput>(EMPTY_CERT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => { if (edit) { setErrors({}); setF(edit === "new" ? EMPTY_CERT : (({ id: _i, ...rest }) => rest)(edit)); } }, [edit]);
  const submit = async () => { try { await adminApi.saveCertification(f, edit && edit !== "new" ? edit.id : undefined); toast.success("Certification saved."); await invalidate(); setEdit(null); } catch (e) { setErrors(apiFieldErrors(e)); } };
  const remove = async (c: AdminCertification) => { if (!window.confirm(`Delete ${c.name}?`)) return; try { await adminApi.deleteCertification(c.id); await invalidate(); } catch (e) { apiFieldErrors(e); } };
  if (q.isLoading) return <LoadingSkeleton rows={3} />;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button onClick={() => setEdit("new")}><Plus className="size-4" /> Add certification</Button></div>
      {(q.data ?? []).length === 0 ? <EmptyState title="No certifications" description="Only add certificates NR Enterprise actually holds." /> : (
        <ul className="divide-y rounded-2xl border bg-card">{(q.data ?? []).map((c) => (
          <li key={c.id} className="flex items-center gap-4 p-3">
            {c.image_url ? <img src={c.image_url} alt="" className="size-12 rounded-lg border object-contain" /> : <div className="size-12 rounded-lg bg-muted" />}
            <div className="flex-1"><p className="font-semibold">{c.name}</p><p className="text-xs text-muted-foreground">{c.certificate_number ?? "No number"} · {c.is_published ? "Published" : "Not published"}</p></div>
            <Button size="icon" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setEdit(c)}><Pencil className="size-4" /></Button>
            <Button size="icon" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => void remove(c)}><Trash2 className="size-4" /></Button>
          </li>))}</ul>
      )}
      {edit && (
        <FormDialog open onOpenChange={(o) => { if (!o) setEdit(null); }} title={edit === "new" ? "Add certification" : "Edit certification"} onSubmit={() => void submit()}>
          <Field id="ce-name" label="Name *" error={errors["name"]}><Input id="ce-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field id="ce-no" label="Certificate number"><Input id="ce-no" value={f.certificate_number ?? ""} onChange={(e) => setF({ ...f, certificate_number: e.target.value || null })} /></Field>
          <Field id="ce-desc" label="Description"><Textarea id="ce-desc" value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value || null })} /></Field>
          <Field id="ce-logo" label="Logo"><LogoInput value={f.image_url ?? ""} onChange={(v) => setF({ ...f, image_url: v })} /></Field>
          <label className="flex items-center gap-2 text-sm"><Switch checked={f.is_published} onCheckedChange={(v) => setF({ ...f, is_published: v })} /> Publish on website</label>
          {f.is_published && <label className="flex items-start gap-2 rounded-xl border p-3 text-sm"><Checkbox checked={f.holder_confirmed} onCheckedChange={(v) => setF({ ...f, holder_confirmed: v === true })} className="mt-0.5" /> I confirm NR Enterprise holds this certificate</label>}
          {errors["holder_confirmed"] && <p className="text-sm text-destructive">{errors["holder_confirmed"]}</p>}
        </FormDialog>
      )}
    </div>
  );
}
