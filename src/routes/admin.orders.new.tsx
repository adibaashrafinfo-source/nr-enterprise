import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/nre/PageHeader";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { SalesDocForm, newDoc } from "@/components/sales/SalesDocForm";
import { toOrderInput } from "@/components/sales/doc-convert";
import { adminApi } from "@/lib/api";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/orders/new")({
  validateSearch: (s: Record<string, unknown>): { customer?: number } => (Number(s["customer"]) > 0 ? { customer: Number(s["customer"]) } : {}),
  head: () => noIndexPageHead("New sales order — NR Enterprise Admin", "Create a quotation or sales order."),
  component: NewOrder,
});

function NewOrder() {
  const { customer } = Route.useSearch();
  const navigate = useNavigate();
  const { invalidate } = useCatalogueAccess();
  return (
    <>
      <PageHeader title="New sales order" description="Saved as a quotation. Confirm it once the customer agrees." />
      <SalesDocForm kind="order" initial={newDoc(customer ?? 0)} submitLabel="Save quotation" onSubmit={async (v) => {
        const o = await adminApi.createOrder(toOrderInput(v));
        toast.success(`Quotation ${o.order_no} saved.`); await invalidate();
        void navigate({ to: "/admin/orders/$orderId", params: { orderId: String(o.id) } });
      }} />
    </>
  );
}
