import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type Column } from "@/components/nre/DataTable";
import { EmptyState } from "@/components/nre/EmptyState";
import { FormDialog } from "@/components/nre/FormDialog";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { PageHeader } from "@/components/nre/PageHeader";
import { Field, apiFieldErrors, useCatalogueAccess } from "@/components/catalogue/shared";
import { fileToUrl } from "@/components/backoffice/file-to-url";
import { useAuth } from "@/hooks/use-auth";
import { adminApi } from "@/lib/api";
import { noIndexPageHead } from "@/lib/seo";
import type { ActivityRow, AdminUser, CompanySettings, DocCounter, Role } from "@/lib/types";

export const Route = createFileRoute("/admin/settings")({
  head: () => noIndexPageHead("Settings — NR Enterprise Admin", "Company details, tax, document numbers, users and activity log."),
  component: Settings,
});

function Settings() {
  const { role, user } = useAuth();
  if (user && role !== "admin") return <EmptyState title="Admins only" description="Only an admin can change settings and users." />;
  return (
    <>
      <PageHeader title="Settings" description="Company details used on the website and printed documents, tax, numbering, users and the activity log." />
      <Tabs defaultValue="company">
        <TabsList className="mb-4 flex-wrap"><TabsTrigger value="company">Company</TabsTrigger><TabsTrigger value="tax">Tax & numbering</TabsTrigger><TabsTrigger value="users">Users & roles</TabsTrigger><TabsTrigger value="log">Activity log</TabsTrigger></TabsList>
        <TabsContent value="company"><CompanyForm /></TabsContent>
        <TabsContent value="tax"><TaxNumbering /></TabsContent>
        <TabsContent value="users"><Users /></TabsContent>
        <TabsContent value="log"><Activity /></TabsContent>
      </Tabs>
    </>
  );
}

function useSettings() {
  const { userId, role, ready } = useCatalogueAccess();
  return useQuery({ queryKey: ["admin", userId, role, "settings", "company"], queryFn: adminApi.companySettings, enabled: ready && role === "admin" });
}

function CompanyForm() {
  const { invalidate } = useCatalogueAccess();
  const q = useSettings();
  const [f, setF] = useState<CompanySettings | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (q.data) setF(q.data); }, [q.data]);
  if (!f) return <LoadingSkeleton rows={6} />;
  const t = (k: keyof CompanySettings, label: string, multi = false) => (
    <Field id={`cs-${k}`} label={label} error={errors[k]}>
      {multi ? <Textarea id={`cs-${k}`} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        : <Input id={`cs-${k}`} value={String(f[k] ?? "")} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}
    </Field>
  );
  const submit = async () => {
    setSaving(true); setErrors({});
    try { await adminApi.saveCompanySettings(f); toast.success("Company details saved."); await invalidate(); } catch (e) { setErrors(apiFieldErrors(e)); } finally { setSaving(false); }
  };
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <section className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2">
        {t("company_name", "Company name *")}{t("tagline", "Tagline")}
        <div className="sm:col-span-2">{t("address", "Address", true)}</div>
        <Field id="cs-phones" label="Phones" hint="Separate with commas."><Input id="cs-phones" value={f.phones.join(", ")} onChange={(e) => setF({ ...f, phones: e.target.value.split(",").map((x) => x.trim()) })} /></Field>
        <Field id="cs-emails" label="Emails" hint="Separate with commas."><Input id="cs-emails" value={f.emails.join(", ")} onChange={(e) => setF({ ...f, emails: e.target.value.split(",").map((x) => x.trim()) })} /></Field>
        {t("whatsapp", "WhatsApp")}{t("website_url", "Website")}{t("facebook_url", "Facebook link")}{t("youtube_url", "YouTube link")}
        <div className="sm:col-span-2">{t("map_embed_url", "Google Map embed link")}</div>
        <Field id="cs-logo" label="Logo">
          <div className="flex items-center gap-3"><img src={f.logo_url} alt="" className="size-14 rounded-xl border bg-background object-contain" />
            <Input type="file" accept="image/*" aria-label="Upload company logo" onChange={(e) => { const file = e.target.files?.[0]; if (file) fileToUrl(file).then((url) => setF({ ...f, logo_url: url })).catch((err: Error) => toast.error(err.message)); }} /></div>
        </Field>
      </section>
      <section className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-3">
        {t("bin", "BIN")}{t("tin", "TIN")}{t("trade_licence", "Trade licence")}
        <div className="sm:col-span-3">{t("bank_details", "Bank / bKash details (printed on invoices)", true)}</div>
        <div className="sm:col-span-3">{t("invoice_footer", "Invoice footer", true)}</div>
      </section>
      <div className="flex justify-end"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save company details"}</Button></div>
    </form>
  );
}

function TaxNumbering() {
  const { userId, role, ready, invalidate } = useCatalogueAccess();
  const s = useSettings();
  const n = useQuery({ queryKey: ["admin", userId, role, "settings", "numbering"], queryFn: adminApi.numbering, enabled: ready && role === "admin" });
  const [tax, setTax] = useState({ enabled: false, rate: "0" });
  const [rows, setRows] = useState<DocCounter[]>([]);
  useEffect(() => { if (s.data) setTax({ enabled: s.data.tax_enabled, rate: s.data.tax_rate }); }, [s.data]);
  useEffect(() => { if (n.data) setRows(n.data); }, [n.data]);
  if (!s.data || !n.data) return <LoadingSkeleton rows={5} />;
  const saveTax = async () => { try { await adminApi.saveCompanySettings({ ...s.data!, tax_enabled: tax.enabled, tax_rate: tax.rate }); toast.success("Tax setting saved."); await invalidate(); } catch (e) { apiFieldErrors(e); } };
  const saveNumbers = async () => { try { await adminApi.saveNumbering(rows); toast.success("Numbering saved."); await invalidate(); } catch (e) { apiFieldErrors(e); } };
  const set = (i: number, patch: Partial<DocCounter>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end gap-4 rounded-2xl border bg-card p-4">
        <label className="flex items-center gap-2 text-sm"><Switch checked={tax.enabled} onCheckedChange={(v) => setTax({ ...tax, enabled: v })} /> Charge VAT on invoices</label>
        <Field id="tx-rate" label="VAT rate (%)"><Input id="tx-rate" inputMode="decimal" className="w-28" value={tax.rate} disabled={!tax.enabled} onChange={(e) => setTax({ ...tax, rate: e.target.value })} /></Field>
        <Button onClick={() => void saveTax()}>Save tax</Button>
        <p className="w-full text-xs text-muted-foreground">Currency is fixed to BDT (৳).</p>
      </section>
      <section className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">Document</th><th className="p-3">Prefix</th><th className="p-3">Digits</th><th className="p-3">Last number</th><th className="p-3">Next looks like</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.type} className="border-t">
              <td className="p-3 capitalize">{r.type}</td>
              <td className="p-3"><Input aria-label={`${r.type} prefix`} className="w-24" value={r.prefix} onChange={(e) => set(i, { prefix: e.target.value.toUpperCase() })} /></td>
              <td className="p-3"><Input aria-label={`${r.type} digits`} type="number" min={3} max={8} className="w-20" value={r.padding} onChange={(e) => set(i, { padding: Number(e.target.value) })} /></td>
              <td className="p-3"><Input aria-label={`${r.type} last number`} type="number" min={n.data!.find((x) => x.type === r.type)?.last_number ?? 0} className="w-28" value={r.last_number} onChange={(e) => set(i, { last_number: Number(e.target.value) })} /></td>
              <td className="p-3 font-mono">{r.prefix}-{String(r.last_number + 1).padStart(r.padding, "0")}</td>
            </tr>))}</tbody>
        </table>
        <div className="flex items-center justify-between gap-3 border-t p-3"><p className="text-xs text-muted-foreground">Counters can only move forward, so numbers are never reused.</p><Button onClick={() => void saveNumbers()}>Save numbering</Button></div>
      </section>
    </div>
  );
}

const ROLE_LABEL: Record<string, string> = { admin: "Admin", manager: "Manager", staff: "Staff", none: "No access" };
function Users() {
  const { userId, role, ready, invalidate } = useCatalogueAccess();
  const q = useQuery({ queryKey: ["admin", userId, role, "settings", "users"], queryFn: adminApi.users, enabled: ready && role === "admin" });
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ email: "", full_name: "", role: "staff", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const update = async (u: AdminUser, patch: { role?: Role | null; is_active?: boolean }) => { try { await adminApi.updateUser(u.id, patch); toast.success("User updated."); await invalidate(); } catch (e) { apiFieldErrors(e); } };
  const reset = async (u: AdminUser) => {
    if (!window.confirm(`Set a temporary password for ${u.email}?`)) return;
    try { const r = await adminApi.resetUserPassword(u.id); toast.success(`Temporary password: ${r.temporary_password}`, { duration: 20_000 }); } catch (e) { apiFieldErrors(e); }
  };
  const create = async () => {
    try { await adminApi.createUser({ ...f, role: f.role === "none" ? null : (f.role as Role) }); toast.success("User created."); setAdding(false); await invalidate(); } catch (e) { setErrors(apiFieldErrors(e)); }
  };
  if (q.isLoading) return <LoadingSkeleton rows={4} />;
  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button onClick={() => { setF({ email: "", full_name: "", role: "staff", password: "" }); setErrors({}); setAdding(true); }}><Plus className="size-4" /> Add user</Button></div>
      <ul className="divide-y rounded-2xl border bg-card">{(q.data ?? []).map((u) => (
        <li key={u.id} className="flex flex-wrap items-center gap-3 p-3">
          <div className="min-w-48 flex-1"><p className="font-semibold">{u.full_name}{u.id === userId ? " (you)" : ""}</p><p className="text-xs text-muted-foreground">{u.email}</p></div>
          <select aria-label={`Role for ${u.email}`} className="h-9 rounded-md border bg-background px-2 text-sm" value={u.role ?? "none"} onChange={(e) => void update(u, { role: e.target.value === "none" ? null : (e.target.value as Role) })}>
            {Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm"><Switch checked={u.is_active} onCheckedChange={(v) => void update(u, { is_active: v })} aria-label={`Active ${u.email}`} /> Active</label>
          <Button size="sm" variant="ghost" onClick={() => void reset(u)}><KeyRound className="size-4" /> Reset password</Button>
        </li>))}</ul>
      {adding && (
        <FormDialog open onOpenChange={setAdding} title="Add user" onSubmit={() => void create()}>
          <Field id="us-name" label="Full name *" error={errors["full_name"]}><Input id="us-name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
          <Field id="us-email" label="Email *" error={errors["email"]}><Input id="us-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field id="us-role" label="Role" error={errors["role"]}><select id="us-role" className="h-10 w-full rounded-md border bg-background px-3" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>{Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field id="us-pass" label="Temporary password *" error={errors["password"]} hint="At least 8 characters. Ask them to change it after signing in."><Input id="us-pass" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        </FormDialog>
      )}
    </div>
  );
}

const TABLES = ["products", "variants", "customers", "suppliers", "invoices", "sales_orders", "payments", "purchase_orders", "supplier_payments", "stock_movements", "settings", "users", "clients", "certifications", "enquiries"];
function Activity() {
  const { userId, role, ready } = useCatalogueAccess();
  const users = useQuery({ queryKey: ["admin", userId, role, "settings", "users"], queryFn: adminApi.users, enabled: ready && role === "admin" });
  const [flt, setFlt] = useState({ table: "", action: "", user_id: 0 });
  const [page, setPage] = useState(1);
  const q = useQuery({ queryKey: ["admin", userId, role, "settings", "activity", flt, page], queryFn: () => adminApi.activityLog({ page, ...(flt.table ? { table: flt.table } : {}), ...(flt.action ? { action: flt.action } : {}), ...(flt.user_id ? { user_id: flt.user_id } : {}) }), enabled: ready && role === "admin" });
  const columns: Column<ActivityRow>[] = [
    { key: "t", header: "When", exportValue: (r) => r.created_at, cell: (r) => new Date(r.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }) },
    { key: "u", header: "Who", exportValue: (r) => r.user_name, cell: (r) => r.user_name },
    { key: "a", header: "Action", exportValue: (r) => r.action, cell: (r) => <span className="capitalize">{r.action}</span> },
    { key: "tb", header: "Area", exportValue: (r) => r.table_name, cell: (r) => r.table_name.replaceAll("_", " ") },
    { key: "r", header: "Record", exportValue: (r) => r.record, cell: (r) => <span className="font-mono text-xs">{r.record}</span> },
  ];
  const sel = "h-9 rounded-md border bg-background px-2 text-sm";
  return (
    <DataTable columns={columns} rows={q.data?.data ?? []} rowKey={(r) => r.id} page={page} perPage={50} total={q.data?.meta.total ?? 0} onPageChange={setPage} loading={q.isLoading}
      error={q.error ? "Could not load the activity log." : null} emptyTitle="No activity yet" exportFileName="nr-activity-log"
      toolbar={<div className="flex flex-wrap gap-2">
        <select aria-label="Filter by area" className={sel} value={flt.table} onChange={(e) => { setFlt({ ...flt, table: e.target.value }); setPage(1); }}><option value="">All areas</option>{TABLES.map((t) => <option key={t} value={t}>{t.replaceAll("_", " ")}</option>)}</select>
        <select aria-label="Filter by action" className={sel} value={flt.action} onChange={(e) => { setFlt({ ...flt, action: e.target.value }); setPage(1); }}><option value="">All actions</option><option value="create">Create</option><option value="update">Update</option><option value="delete">Delete</option></select>
        <select aria-label="Filter by user" className={sel} value={flt.user_id} onChange={(e) => { setFlt({ ...flt, user_id: Number(e.target.value) }); setPage(1); }}><option value={0}>All users</option>{(users.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}</select>
      </div>} />
  );
}
