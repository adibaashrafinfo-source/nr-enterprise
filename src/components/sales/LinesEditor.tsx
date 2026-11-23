import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AlertTriangle, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { formatBDT, formatQty, previewLineAmount, toScaled } from "@/lib/money";
import { stockQuery, variantSearchQuery } from "@/lib/queries";
import type { SalesLine, VariantPick } from "@/lib/types";

export const emptyLine = (): SalesLine => ({ variant_id: null, description: "", unit_code: "pcs", quantity: "", rate: "", discount_percent: "0" });

export function ItemPicker({ onPick }: { onPick: (v: VariantPick) => void }) {
  const { userId, role, ready } = useCatalogueAccess();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const res = useQuery({ ...variantSearchQuery(userId, role, q.trim()), enabled: ready && open });
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search item or SKU…" aria-label="Search item" className="pl-9" />
      {open && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border bg-popover p-1 shadow-lg">
          {(res.data ?? []).map((v) => (
            <li key={v.id}><button type="button" role="option" aria-selected={false} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-muted"
              onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick(v); setQ(""); setOpen(false); }}>
              <span className="min-w-0"><span className="block truncate font-medium">{v.display_name}</span><span className="font-mono text-xs text-muted-foreground">{v.sku}</span></span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatQty(v.qty_on_hand, v.unit_code)} · {formatBDT(v.selling_price)}</span>
            </button></li>
          ))}
          {res.data && !res.data.length && <li className="px-3 py-2 text-sm text-muted-foreground">No items found. You can still type a free-text line below.</li>}
        </ul>
      )}
    </div>
  );
}

/** Editable document lines. Amount is a preview only; the server computes the saved totals. */
export function LinesEditor({ lines, onChange, errors, readOnly }: { lines: SalesLine[]; onChange: (l: SalesLine[]) => void; errors: Record<string, string>; readOnly?: boolean }) {
  const { userId, role, ready } = useCatalogueAccess();
  const stock = useQuery({ ...stockQuery(userId, role, { per_page: 100 }), enabled: ready && !readOnly });
  const onHand = new Map((stock.data?.data ?? []).map((r) => [r.variant_id, r.qty_on_hand]));
  const set = (i: number, patch: Partial<SalesLine>) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-3">
      {!readOnly && <ItemPicker onPick={(v) => {
        const blank = lines.findIndex((l) => !l.description && !l.variant_id);
        const line: SalesLine = { variant_id: v.id, description: v.display_name, unit_code: v.unit_code, quantity: "", rate: v.selling_price, discount_percent: "0" };
        onChange(blank >= 0 ? lines.map((l, j) => (j === blank ? line : l)) : [...lines, line]);
      }} />}
      {errors["items"] && <p className="text-sm font-medium text-destructive">{errors["items"]}</p>}
      <div className="overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr><th className="p-2 pl-3">#</th><th className="p-2">Description</th><th className="p-2 w-20">Unit</th><th className="p-2 w-28">Qty</th><th className="p-2 w-28">Rate (৳)</th><th className="p-2 w-20">Disc %</th><th className="p-2 text-right">Amount</th>{!readOnly && <th className="w-10" />}</tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const avail = l.variant_id ? onHand.get(l.variant_id) : undefined;
              const short = avail !== undefined && l.quantity && toScaled(l.quantity) > toScaled(avail);
              const amount = l.quantity && l.rate ? previewLineAmount(l.quantity, l.rate, l.discount_percent || "0") : "0.00";
              return (
                <tr key={i} className="border-t align-top">
                  <td className="p-2 pl-3 pt-4 text-muted-foreground">{i + 1}</td>
                  <td className="p-2">
                    {readOnly ? <p className="pt-2">{l.description}</p> : <Input aria-label={`Line ${i + 1} description`} value={l.description} onChange={(e) => set(i, { description: e.target.value })} />}
                    {errors[`items.${i}.description`] && <p className="mt-1 text-xs text-destructive">{errors[`items.${i}.description`]}</p>}
                    {avail !== undefined && !readOnly && <p className={`mt-1 inline-flex items-center gap-1 text-xs ${short ? "font-medium text-warning" : "text-muted-foreground"}`}>{short && <AlertTriangle className="size-3" />}In stock: {formatQty(avail, l.unit_code)}{short ? " — not enough" : ""}</p>}
                  </td>
                  <td className="p-2">{readOnly ? <p className="pt-2">{l.unit_code}</p> : <Input aria-label={`Line ${i + 1} unit`} value={l.unit_code} onChange={(e) => set(i, { unit_code: e.target.value })} />}</td>
                  <td className="p-2">{readOnly ? <p className="pt-2 tabular-nums">{formatQty(l.quantity)}</p> : <Input aria-label={`Line ${i + 1} quantity`} inputMode="decimal" value={l.quantity} onChange={(e) => set(i, { quantity: e.target.value })} />}
                    {errors[`items.${i}.quantity`] && <p className="mt-1 text-xs text-destructive">{errors[`items.${i}.quantity`]}</p>}</td>
                  <td className="p-2">{readOnly ? <p className="pt-2 tabular-nums">{l.rate}</p> : <Input aria-label={`Line ${i + 1} rate`} inputMode="decimal" value={l.rate} onChange={(e) => set(i, { rate: e.target.value })} />}
                    {errors[`items.${i}.rate`] && <p className="mt-1 text-xs text-destructive">{errors[`items.${i}.rate`]}</p>}</td>
                  <td className="p-2">{readOnly ? <p className="pt-2 tabular-nums">{l.discount_percent}</p> : <Input aria-label={`Line ${i + 1} discount`} inputMode="decimal" value={l.discount_percent} onChange={(e) => set(i, { discount_percent: e.target.value })} />}</td>
                  <td className="p-2 pt-4 text-right font-medium tabular-nums">{formatBDT(l.amount ?? amount, { decimals: true })}</td>
                  {!readOnly && <td className="p-2"><Button type="button" size="icon" variant="ghost" aria-label={`Remove line ${i + 1}`} onClick={() => onChange(lines.filter((_, j) => j !== i))}><Trash2 className="size-4" /></Button></td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!readOnly && <Button type="button" variant="outline" size="sm" onClick={() => onChange([...lines, emptyLine()])}><Plus className="size-4" /> Add free-text line</Button>}
    </div>
  );
}
