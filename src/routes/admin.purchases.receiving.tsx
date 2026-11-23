import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/nre/EmptyState";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { PageHeader } from "@/components/nre/PageHeader";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { ReceiveDialog, type ReceiveTarget } from "@/components/purchases/PurchaseDialogs";
import { formatQty } from "@/lib/money";
import { pendingReceiptsQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/purchases/receiving")({
  head: () => noIndexPageHead("Pending receipts — NR Enterprise Admin", "Receive supplier goods into stock."),
  component: Receiving,
});

/** Staff-safe: built only from /receiving/pending, which carries no rates or values. */
function Receiving() {
  const { userId, role, ready, invalidate } = useCatalogueAccess();
  const q = useQuery({ ...pendingReceiptsQuery(userId, role), enabled: ready });
  const [target, setTarget] = useState<ReceiveTarget | null>(null);
  const rows = q.data ?? [];
  return (
    <>
      <PageHeader title="Pending receipts" description="Goods ordered from suppliers that have not fully arrived. Count what arrived and receive it into stock." />
      {q.isLoading ? <LoadingSkeleton rows={5} /> : rows.length === 0 ? <EmptyState title="Nothing waiting" description="All ordered goods have been received." /> : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="p-3">PO</th><th className="p-3">Supplier</th><th className="p-3">Item</th><th className="p-3 text-right">Ordered</th><th className="p-3 text-right">Received</th><th className="p-3 text-right">Pending</th><th className="p-3" /></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.item_id} className="border-t">
                <td className="p-3 font-mono font-semibold">{r.po_no}<p className="font-sans text-xs font-normal text-muted-foreground">{r.expected_date ? `Expected ${r.expected_date}` : ""}</p></td>
                <td className="p-3">{r.supplier_name}</td>
                <td className="p-3"><p className="font-medium">{r.display_name}</p><p className="font-mono text-xs text-muted-foreground">{r.sku}</p></td>
                <td className="p-3 text-right tabular-nums">{formatQty(r.qty_ordered, r.unit_code)}</td>
                <td className="p-3 text-right tabular-nums">{formatQty(r.qty_received, r.unit_code)}</td>
                <td className="p-3 text-right font-semibold tabular-nums">{formatQty(r.qty_pending, r.unit_code)}</td>
                <td className="p-3 text-right"><Button size="sm" onClick={() => setTarget({ item_id: r.item_id, po_no: r.po_no, display_name: r.display_name, unit_code: r.unit_code, qty_pending: r.qty_pending })}>Receive</Button></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <ReceiveDialog target={target} onClose={() => setTarget(null)} onDone={invalidate} />
    </>
  );
}
