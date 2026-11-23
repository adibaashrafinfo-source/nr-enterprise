import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { EmptyState } from "@/components/nre/EmptyState";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { PageHeader } from "@/components/nre/PageHeader";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { PurchaseForm, emptyPo, toPurchaseInput, type PoFormValue } from "@/components/purchases/PurchaseForm";
import { decodeLines } from "@/components/purchases/shared";
import { adminApi } from "@/lib/api";
import { reorderSuggestionsQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";

interface NewPoSearch { supplier_id?: number; lines?: string }
export const Route = createFileRoute("/admin/purchases/new")({
  validateSearch: (s: Record<string, unknown>): NewPoSearch => ({
    ...(Number(s["supplier_id"]) > 0 ? { supplier_id: Number(s["supplier_id"]) } : {}),
    ...(typeof s["lines"] === "string" && s["lines"] ? { lines: s["lines"] } : {}),
  }),
  head: () => noIndexPageHead("New purchase order — NR Enterprise Admin", "Create a purchase order for a supplier."),
  component: NewPurchase,
});

function NewPurchase() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { userId, role, ready, canEdit, invalidate } = useCatalogueAccess();
  const prefill = decodeLines(search.lines);
  const reorder = useQuery({ ...reorderSuggestionsQuery(userId, role), enabled: ready && canEdit && prefill.length > 0 });
  if (ready && !canEdit) return <EmptyState title="Managers only" description="Ask a manager to raise purchase orders." />;
  if (prefill.length && reorder.isLoading) return <LoadingSkeleton rows={6} />;
  const known = new Map((reorder.data ?? []).map((s) => [s.variant_id, s]));
  const initial: PoFormValue = { ...emptyPo(), supplier_id: search.supplier_id ?? 0,
    lines: prefill.flatMap((l) => { const s = known.get(l.variant_id); return s ? [{ variant_id: s.variant_id, display_name: s.display_name, sku: s.sku, unit_code: s.unit_code, qty_ordered: String(Number(l.qty)), rate: l.rate, last_rate: s.last_rate }] : []; }) };
  return (
    <>
      <PageHeader title="New purchase order" description="Save as draft, or place the order so goods can be received." />
      <PurchaseForm initial={initial} submitLabels={{ draft: "Save draft", ordered: "Place order" }} onSubmit={async (v, status) => {
        const po = await adminApi.createPurchase(toPurchaseInput(v, status));
        toast.success(`${po.po_no} saved.`); await invalidate();
        void navigate({ to: "/admin/purchases/$purchaseId", params: { purchaseId: String(po.id) } });
      }} />
    </>
  );
}
