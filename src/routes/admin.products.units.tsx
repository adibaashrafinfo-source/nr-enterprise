import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FormDialog } from "@/components/nre/FormDialog";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { PageHeader } from "@/components/nre/PageHeader";
import { apiFieldErrors, Field, useCatalogueAccess } from "@/components/catalogue/shared";
import { adminApi } from "@/lib/api";
import { adminUnitsQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";
import type { Unit } from "@/lib/types";

export const Route = createFileRoute("/admin/products/units")({
  head: () => noIndexPageHead("Units — NR Enterprise Admin", "Manage the units used to sell NR Enterprise products."),
  component: Units,
});

function Units() {
  const { userId, role, ready, canEdit, invalidate } = useCatalogueAccess();
  const list = useQuery({ ...adminUnitsQuery(userId, role), enabled: ready });
  const [editing, setEditing] = useState<Unit | "new" | null>(null);
  const [form, setForm] = useState<Unit>({ code: "", name: "", is_active: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const open = (u: Unit | "new") => { setEditing(u); setErrors({}); setForm(u === "new" ? { code: "", name: "", is_active: true } : { ...u }); };
  const submit = async () => {
    setSaving(true); setErrors({});
    try { await adminApi.saveUnit(form); toast.success("Unit saved."); setEditing(null); await invalidate(); }
    catch (e) { setErrors(apiFieldErrors(e)); } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title="Units" description="Pieces, rolls, metres and other selling units." actions={canEdit && <Button onClick={() => open("new")}><Plus className="size-4" /> New unit</Button>} />
      {list.isLoading || !ready ? <LoadingSkeleton rows={4} /> : (
        <div className="overflow-x-auto rounded-2xl border bg-card shadow-soft">
          <Table>
            <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Status</TableHead>{canEdit && <TableHead />}</TableRow></TableHeader>
            <TableBody>
              {(list.data ?? []).map((u) => (
                <TableRow key={u.code}>
                  <TableCell className="font-mono text-xs">{u.code}</TableCell><TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell><Badge variant={u.is_active ? "secondary" : "outline"}>{u.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  {canEdit && <TableCell className="text-right"><Button size="icon" variant="ghost" aria-label={`Edit ${u.code}`} onClick={() => open(u)}><Pencil className="size-4" /></Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {canEdit && <FormDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} title={editing === "new" ? "New unit" : "Edit unit"} onSubmit={() => void submit()} submitting={saving}>
        <Field id="u-code" label="Code *" error={errors["code"]} hint="Short code, e.g. pcs or roll."><Input id="u-code" value={form.code} disabled={editing !== "new"} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toLowerCase() }))} /></Field>
        <Field id="u-name" label="Name *" error={errors["name"]}><Input id="u-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
        <label className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium">Active<Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} /></label>
      </FormDialog>}
    </>
  );
}
