import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/nre/FormDialog";
import { Field, apiFieldErrors, useCatalogueAccess } from "@/components/catalogue/shared";
import { adminApi } from "@/lib/api";
import { adminProductsQuery } from "@/lib/queries";
import type { Supplier, SupplierInput } from "@/lib/types";

const EMPTY: SupplierInput = { name: "", contact_person: null, phone: null, email: null, address: null, payment_terms: null, opening_balance: "0.00", notes: null, is_active: true, product_ids: [] };
const toInput = (s: Supplier): SupplierInput => { const { id: _i, code: _c, total_purchased: _t, paid: _p, payable_balance: _b, ...rest } = s; return rest; };

export function SupplierFormDialog({ open, onOpenChange, supplier, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; supplier?: Supplier | undefined; onSaved: (s: Supplier) => void | Promise<unknown> }) {
  const { userId, role, ready } = useCatalogueAccess();
  const products = useQuery({ ...adminProductsQuery(userId, role, { per_page: 100, status: "active" }), enabled: ready && open });
  const [form, setForm] = useState<SupplierInput>(EMPTY);
  const [filter, setFilter] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setForm(supplier ? toInput(supplier) : EMPTY); setErrors({}); setFilter(""); } }, [open, supplier]);
  const text = (k: keyof SupplierInput) => ({ id: `su-${k}`, value: String(form[k] ?? ""), onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })) });
  const toggle = (id: number, on: boolean) => setForm((f) => ({ ...f, product_ids: on ? [...f.product_ids, id] : f.product_ids.filter((x) => x !== id) }));

  const submit = async () => {
    setSaving(true); setErrors({});
    try {
      const saved = supplier ? await adminApi.updateSupplier(supplier.id, form) : await adminApi.createSupplier(form);
      toast.success(supplier ? "Supplier updated." : `Supplier ${saved.code} added.`);
      onOpenChange(false); await onSaved(saved);
    } catch (e) { setErrors(apiFieldErrors(e)); } finally { setSaving(false); }
  };
  const list = (products.data?.data ?? []).filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()));

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={supplier ? `Edit ${supplier.name}` : "Add supplier"} description="Fields marked * are required." onSubmit={() => void submit()} submitting={saving}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field id="su-name" label="Name *" error={errors["name"]}><Input {...text("name")} /></Field></div>
        <Field id="su-contact_person" label="Contact person"><Input {...text("contact_person")} /></Field>
        <Field id="su-phone" label="Phone"><Input {...text("phone")} inputMode="tel" /></Field>
        <Field id="su-email" label="Email" error={errors["email"]}><Input {...text("email")} type="email" /></Field>
        <Field id="su-payment_terms" label="Payment terms" hint="e.g. 30 days"><Input {...text("payment_terms")} /></Field>
        <div className="sm:col-span-2"><Field id="su-address" label="Address"><Textarea {...text("address")} rows={2} /></Field></div>
        <Field id="su-opening_balance" label="Opening balance (৳)" error={errors["opening_balance"]} hint="Amount you already owed them."><Input {...text("opening_balance")} inputMode="decimal" /></Field>
        <div className="sm:col-span-2 space-y-2">
          <p className="text-sm font-medium">Products supplied ({form.product_ids.length})</p>
          <Input placeholder="Filter products…" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter products" />
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border p-2">
            {list.map((p) => (
              <label key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted">
                <Checkbox checked={form.product_ids.includes(p.id)} onCheckedChange={(v) => toggle(p.id, v === true)} />{p.name}
              </label>
            ))}
            {!list.length && <p className="px-2 py-1 text-sm text-muted-foreground">No products.</p>}
          </div>
        </div>
        <div className="sm:col-span-2"><Field id="su-notes" label="Notes"><Textarea {...text("notes")} rows={2} /></Field></div>
        <label className="flex items-center justify-between rounded-full border px-4 py-2 sm:col-span-2"><span className="text-sm font-medium">Active</span><Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} /></label>
      </div>
    </FormDialog>
  );
}
