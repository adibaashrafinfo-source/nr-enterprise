import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/nre/EmptyState";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { PageHeader } from "@/components/nre/PageHeader";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { adminApi, ApiError } from "@/lib/api";
import { formatQty } from "@/lib/money";
import { stockQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/stock/opening")({
  head: () => noIndexPageHead("Opening stock — NR Enterprise Admin", "Enter starting stock quantities and purchase costs for NR Enterprise variants."),
  component: OpeningStock,
});

type RowState = { quantity: string; cost: string; result?: { ok: boolean; message: string } };

function OpeningStock() {
  const { userId, role, ready, canEdit, invalidate } = useCatalogueAccess();
  const variants = useQuery({ ...stockQuery(userId, role, { per_page: 100 }), enabled: ready && canEdit });
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [saving, setSaving] = useState(false);
  const edit = (id: number, field: "quantity" | "cost", value: string) => setRows((r) => {
    const cur = r[id] ?? { quantity: "", cost: "" };
    return { ...r, [id]: { quantity: cur.quantity, cost: cur.cost, [field]: value } };
  });
  const set = (id: number, patch: Partial<RowState>) => setRows((r) => ({ ...r, [id]: { quantity: "", cost: "", ...r[id], ...patch } }));

  if (!canEdit) return <><PageHeader title="Opening stock" /><EmptyState title="Managers only" description="Ask a manager or admin to enter opening stock." /></>;

  const save = async () => {
    const entries = Object.entries(rows).filter(([, r]) => r.quantity.trim() && !r.result?.ok);
    if (!entries.length) return;
    setSaving(true);
    for (const [id, r] of entries) {
      try {
        await adminApi.openingStock({ variant_id: Number(id), quantity: r.quantity.trim(), ...(r.cost.trim() ? { cost: r.cost.trim() } : {}) });
        set(Number(id), { result: { ok: true, message: "Saved" } });
      } catch (e) {
        const msg = e instanceof ApiError ? Object.values(e.fields ?? {})[0] ?? e.message : "Could not save.";
        set(Number(id), { result: { ok: false, message: msg } });
      }
    }
    setSaving(false);
    await invalidate();
  };
  const filled = Object.values(rows).filter((r) => r.quantity.trim() && !r.result?.ok).length;

  return (
    <>
      <PageHeader title="Opening stock" description="Enter the stock you already hold. Each row is saved on its own, so one mistake won't stop the rest."
        actions={<div className="flex gap-2"><Button asChild variant="outline"><Link to="/admin/stock">Back to stock</Link></Button>
          <Button onClick={() => void save()} disabled={saving || !filled}>{saving ? "Saving…" : `Save ${filled || ""} row${filled === 1 ? "" : "s"}`}</Button></div>} />
      {variants.isLoading ? <LoadingSkeleton rows={6} /> : !variants.data?.data.length ? <EmptyState title="No variants yet" description="Add variants to your products first, then come back here." /> : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Variant</TableHead><TableHead className="text-right">In stock now</TableHead><TableHead>Quantity</TableHead><TableHead>Purchase cost (৳)</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
            <TableBody>
              {variants.data.data.map((v) => { const r = rows[v.variant_id]; return (
                <TableRow key={v.variant_id}>
                  <TableCell><p className="font-medium">{v.display_name}</p><p className="font-mono text-xs text-muted-foreground">{v.sku}</p></TableCell>
                  <TableCell className="text-right tabular-nums">{formatQty(v.qty_on_hand, v.unit_code)}</TableCell>
                  <TableCell><Input aria-label={`Quantity for ${v.sku}`} inputMode="decimal" className="w-28" value={r?.quantity ?? ""} disabled={r?.result?.ok} onChange={(e) => edit(v.variant_id, "quantity", e.target.value)} /></TableCell>
                  <TableCell><Input aria-label={`Cost for ${v.sku}`} inputMode="decimal" className="w-28" value={r?.cost ?? ""} disabled={r?.result?.ok} onChange={(e) => edit(v.variant_id, "cost", e.target.value)} /></TableCell>
                  <TableCell>{r?.result && <span className={`inline-flex items-center gap-1 text-sm ${r.result.ok ? "text-secondary" : "text-destructive"}`}>{r.result.ok ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}{r.result.message}</span>}</TableCell>
                </TableRow>); })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
