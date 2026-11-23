import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/nre/FormDialog";
import { Field, apiFieldErrors } from "@/components/catalogue/shared";
import { adminApi } from "@/lib/api";
import type { Customer, CustomerInput, CustomerType } from "@/lib/types";

export const CUSTOMER_TYPES: Record<CustomerType, string> = { factory: "Factory", buying_house: "Buying house", brand: "Brand", retail: "Retail", other: "Other" };
const EMPTY: CustomerInput = { name: "", contact_person: null, phone: null, whatsapp: null, email: null, billing_address: null, delivery_address: null, area: null, type: "factory", credit_days: 0, credit_limit: "0.00", opening_balance: "0.00", buyers_served: null, bin: null, notes: null, is_active: true };
const toInput = (c: Customer): CustomerInput => { const { id: _i, code: _c, total_sales: _t, due_balance: _d, invoice_count: _n, order_count: _o, ...rest } = c; return rest; };

/** Add/edit a customer. The customer code is created by the server and never sent. */
export function CustomerFormDialog({ open, onOpenChange, customer, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; customer?: Customer | undefined; onSaved: (c: Customer) => void | Promise<unknown> }) {
  const [form, setForm] = useState<CustomerInput>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setForm(customer ? toInput(customer) : EMPTY); setErrors({}); } }, [open, customer]);
  const text = (k: keyof CustomerInput) => ({ id: `cu-${k}`, value: String(form[k] ?? ""), onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value })) });

  const submit = async () => {
    setSaving(true); setErrors({});
    try {
      const body = { ...form, credit_days: Number(form.credit_days) || 0 };
      const saved = customer ? await adminApi.updateCustomer(customer.id, body) : await adminApi.createCustomer(body);
      toast.success(customer ? "Customer updated." : `Customer ${saved.code} added.`);
      onOpenChange(false); await onSaved(saved);
    } catch (e) { setErrors(apiFieldErrors(e)); } finally { setSaving(false); }
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title={customer ? `Edit ${customer.name}` : "Add customer"} description="Fields marked * are required." onSubmit={() => void submit()} submitting={saving}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Field id="cu-name" label="Name *" error={errors["name"]}><Input {...text("name")} /></Field></div>
        <Field id="cu-contact_person" label="Contact person"><Input {...text("contact_person")} /></Field>
        <Field id="cu-type" label="Type" error={errors["type"]}>
          <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as CustomerType }))}>
            <SelectTrigger id="cu-type"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(CUSTOMER_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field id="cu-phone" label="Phone"><Input {...text("phone")} inputMode="tel" /></Field>
        <Field id="cu-whatsapp" label="WhatsApp"><Input {...text("whatsapp")} inputMode="tel" /></Field>
        <Field id="cu-email" label="Email" error={errors["email"]}><Input {...text("email")} type="email" /></Field>
        <Field id="cu-area" label="Area"><Input {...text("area")} placeholder="e.g. Gazipur" /></Field>
        <div className="sm:col-span-2"><Field id="cu-billing_address" label="Billing address"><Textarea {...text("billing_address")} rows={2} /></Field></div>
        <div className="sm:col-span-2"><Field id="cu-delivery_address" label="Delivery address"><Textarea {...text("delivery_address")} rows={2} /></Field></div>
        <Field id="cu-credit_days" label="Credit days" error={errors["credit_days"]}><Input {...text("credit_days")} inputMode="numeric" /></Field>
        <Field id="cu-credit_limit" label="Credit limit (৳)" error={errors["credit_limit"]}><Input {...text("credit_limit")} inputMode="decimal" /></Field>
        <Field id="cu-opening_balance" label="Opening balance (৳)" error={errors["opening_balance"]} hint="Amount they already owed you."><Input {...text("opening_balance")} inputMode="decimal" /></Field>
        <Field id="cu-bin" label="BIN"><Input {...text("bin")} /></Field>
        <div className="sm:col-span-2"><Field id="cu-buyers_served" label="Buyers served" hint="e.g. H&M, Zara"><Input {...text("buyers_served")} /></Field></div>
        <div className="sm:col-span-2"><Field id="cu-notes" label="Notes"><Textarea {...text("notes")} rows={2} /></Field></div>
        <label className="flex items-center justify-between rounded-full border px-4 py-2 sm:col-span-2"><span className="text-sm font-medium">Active</span><Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} /></label>
      </div>
    </FormDialog>
  );
}
