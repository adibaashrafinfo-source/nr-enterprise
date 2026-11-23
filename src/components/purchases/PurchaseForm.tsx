import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, apiFieldErrors, useCatalogueAccess } from "@/components/catalogue/shared";
import { ItemPicker } from "@/components/sales/LinesEditor";
import { today } from "@/components/sales/SalesDocForm";
import { addMoney, formatBDT, formatQty, mulMoney } from "@/lib/money";
import { suppliersQuery } from "@/lib/queries";
import type { PurchaseInput } from "@/lib/types";

export interface PoLine { variant_id: number; display_name: string; sku: string; unit_code: string; qty_ordered: string; rate: string; last_rate: string | null }
export interface PoFormValue { supplier_id: number; order_date: string; expected_date: string; bill_no: string; notes: string; lines: PoLine[] }
export const emptyPo = (): PoFormValue => ({ supplier_id: 0, order_date: today(), expected_date: "", bill_no: "", notes: "", lines: [] });
const MONEY = /^\d+(\.\d{1,2})?$/; const QTY = /^\d+(\.\d{1,3})?$/;

export function toPurchaseInput(v: PoFormValue, status?: "draft" | "ordered"): PurchaseInput {
  return { supplier_id: v.supplier_id, order_date: v.order_date, expected_date: v.expected_date || null, bill_no: v.bill_no || null, notes: v.notes || null, ...(status ? { status } : {}),
    items: v.lines.map((l) => ({ variant_id: l.variant_id, qty_ordered: l.qty_ordered, rate: l.rate })) };
}

export function PurchaseForm({ initial, onSubmit, submitLabels }: { initial: PoFormValue; onSubmit: (v: PoFormValue, status: "draft" | "ordered") => Promise<unknown>; submitLabels: { draft?: string; ordered: string } }) {
  const { userId, role, ready } = useCatalogueAccess();
  const suppliers = useQuery({ ...suppliersQuery(userId, role, { per_page: 100 }), enabled: ready });
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const setLine = (i: number, patch: Partial<PoLine>) => setV((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const preview = addMoney(...v.lines.map((l) => (QTY.test(l.qty_ordered) && MONEY.test(l.rate) ? mulMoney(l.qty_ordered, l.rate) : "0")));

  const submit = async (status: "draft" | "ordered") => {
    setSaving(true); setErrors({});
    try { await onSubmit(v, status); } catch (e) { setErrors(apiFieldErrors(e)); } finally { setSaving(false); }
  };
  return (
    <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); void submit("ordered"); }}>
      <div className="grid gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="po-supplier" label="Supplier *" error={errors["supplier_id"]}>
          <select id="po-supplier" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={v.supplier_id || ""} onChange={(e) => setV((f) => ({ ...f, supplier_id: Number(e.target.value) }))}>
            <option value="">Choose supplier…</option>
            {(suppliers.data?.data ?? []).filter((s) => s.is_active || s.id === v.supplier_id).map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
          </select>
        </Field>
        <Field id="po-date" label="Order date"><Input id="po-date" type="date" value={v.order_date} onChange={(e) => setV((f) => ({ ...f, order_date: e.target.value }))} /></Field>
        <Field id="po-expected" label="Expected date"><Input id="po-expected" type="date" value={v.expected_date} onChange={(e) => setV((f) => ({ ...f, expected_date: e.target.value }))} /></Field>
        <Field id="po-bill" label="Supplier bill no."><Input id="po-bill" value={v.bill_no} onChange={(e) => setV((f) => ({ ...f, bill_no: e.target.value }))} /></Field>
      </div>

      <div className="space-y-3">
        <ItemPicker onPick={(p) => setV((f) => f.lines.some((l) => l.variant_id === p.id) ? f : ({ ...f, lines: [...f.lines, { variant_id: p.id, display_name: p.display_name, sku: p.sku, unit_code: p.unit_code, qty_ordered: "", rate: p.last_purchase_rate ?? "", last_rate: p.last_purchase_rate ?? null }] }))} />
        {errors["items"] && <p className="text-sm font-medium text-destructive">{errors["items"]}</p>}
        <div className="overflow-x-auto rounded-2xl border">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-2 pl-3">#</th><th className="p-2">Item</th><th className="w-32 p-2">Qty ordered</th><th className="w-36 p-2">Rate (৳)</th><th className="p-2 text-right">Amount</th><th className="w-10" /></tr>
            </thead>
            <tbody>
              {v.lines.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Search above to add items to this PO.</td></tr>}
              {v.lines.map((l, i) => (
                <tr key={l.variant_id} className="border-t align-top">
                  <td className="p-2 pl-3 pt-4 text-muted-foreground">{i + 1}</td>
                  <td className="p-2 pt-3"><p className="font-medium">{l.display_name}</p><p className="font-mono text-xs text-muted-foreground">{l.sku} · {l.unit_code}</p></td>
                  <td className="p-2"><Input aria-label={`Line ${i + 1} quantity`} inputMode="decimal" value={l.qty_ordered} onChange={(e) => setLine(i, { qty_ordered: e.target.value })} />
                    {errors[`items.${i}.qty_ordered`] && <p className="mt-1 text-xs text-destructive">{errors[`items.${i}.qty_ordered`]}</p>}</td>
                  <td className="p-2"><Input aria-label={`Line ${i + 1} rate`} inputMode="decimal" value={l.rate} onChange={(e) => setLine(i, { rate: e.target.value })} />
                    <p className="mt-1 text-xs text-muted-foreground">{l.last_rate ? <>Last purchase rate: <button type="button" className="font-medium text-secondary underline" onClick={() => setLine(i, { rate: l.last_rate ?? "" })}>{formatBDT(l.last_rate, { decimals: true })}</button></> : "No previous rate"}</p>
                    {errors[`items.${i}.rate`] && <p className="mt-1 text-xs text-destructive">{errors[`items.${i}.rate`]}</p>}</td>
                  <td className="p-2 pt-4 text-right font-medium tabular-nums">{QTY.test(l.qty_ordered) && MONEY.test(l.rate) ? formatBDT(mulMoney(l.qty_ordered, l.rate), { decimals: true }) : "—"}</td>
                  <td className="p-2"><Button type="button" size="icon" variant="ghost" aria-label={`Remove line ${i + 1}`} onClick={() => setV((f) => ({ ...f, lines: f.lines.filter((_, j) => j !== i) }))}><Trash2 className="size-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-right text-sm">Estimated total <span className="ml-2 text-lg font-bold tabular-nums">{formatBDT(preview, { decimals: true })}</span></p>
        <p className="text-right text-xs text-muted-foreground">{v.lines.length} line(s) · quantities shown as {v.lines[0] ? formatQty("1", v.lines[0].unit_code).replace("1 ", "") : "units"}. The saved total is calculated by the server.</p>
      </div>

      <Field id="po-notes" label="Notes"><Textarea id="po-notes" value={v.notes} onChange={(e) => setV((f) => ({ ...f, notes: e.target.value }))} /></Field>
      <div className="flex flex-wrap justify-end gap-2">
        {submitLabels.draft && <Button type="button" variant="outline" disabled={saving} onClick={() => void submit("draft")}>{submitLabels.draft}</Button>}
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : submitLabels.ordered}</Button>
      </div>
    </form>
  );
}
