import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FormDialog } from "@/components/nre/FormDialog";
import { Field, apiFieldErrors } from "@/components/catalogue/shared";
import { adminApi } from "@/lib/api";
import { formatQty } from "@/lib/money";
import type { StockRow } from "@/lib/types";

/** Manager/admin stock correction: signed quantity plus a required reason. */
export function AdjustStockDialog({ open, onOpenChange, variants, initialVariantId, onDone }: {
  open: boolean; onOpenChange: (o: boolean) => void; variants: StockRow[]; initialVariantId?: number; onDone: () => void | Promise<unknown>;
}) {
  const [variantId, setVariantId] = useState(0);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (open) { setVariantId(initialVariantId ?? 0); setQuantity(""); setReason(""); setErrors({}); } }, [open, initialVariantId]);
  const current = variants.find((v) => v.variant_id === variantId);

  const submit = async () => {
    setSaving(true); setErrors({});
    try {
      await adminApi.adjustStock({ variant_id: variantId, quantity: quantity.trim(), reason });
      toast.success("Stock adjusted.");
      onOpenChange(false);
      await onDone();
    } catch (e) { setErrors(apiFieldErrors(e)); } finally { setSaving(false); }
  };

  return (
    <FormDialog open={open} onOpenChange={onOpenChange} title="Adjust stock" description="Use a minus sign to reduce stock, e.g. -5." onSubmit={() => void submit()} submitting={saving} submitLabel="Save adjustment">
      <Field id="adj-variant" label="Variant *" error={errors["variant_id"]}>
        <Select value={variantId ? String(variantId) : ""} onValueChange={(v) => setVariantId(Number(v))}>
          <SelectTrigger id="adj-variant" aria-label="Variant"><SelectValue placeholder="Choose a variant" /></SelectTrigger>
          <SelectContent>{variants.map((v) => <SelectItem key={v.variant_id} value={String(v.variant_id)}>{v.display_name} · {v.sku}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      {current && <p className="text-sm text-muted-foreground">Currently in stock: <span className="font-semibold text-foreground">{formatQty(current.qty_on_hand, current.unit_code)}</span></p>}
      <Field id="adj-qty" label="Quantity (+/-) *" error={errors["quantity"]}>
        <Input id="adj-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="e.g. 10 or -5" />
      </Field>
      <Field id="adj-reason" label="Reason *" error={errors["reason"]}>
        <Textarea id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged during storage" />
      </Field>
    </FormDialog>
  );
}
