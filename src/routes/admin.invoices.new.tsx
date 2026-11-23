import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/nre/PageHeader";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { SalesDocForm, newDoc } from "@/components/sales/SalesDocForm";
import { toInvoiceInput } from "@/components/sales/doc-convert";
import { adminApi } from "@/lib/api";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/invoices/new")({
  validateSearch: (s: Record<string, unknown>): { customer?: number } => (Number(s["customer"]) > 0 ? { customer: Number(s["customer"]) } : {}),
  head: () => noIndexPageHead("New invoice — NR Enterprise Admin", "Create a draft invoice."),
  component: NewInvoice,
});

function NewInvoice() {
  const { customer } = Route.useSearch();
  const navigate = useNavigate();
  const { invalidate } = useCatalogueAccess();
  return (
    <>
      <PageHeader title="New invoice" description="Saved as a draft with its own number. Confirm it to take the stock out." />
      <SalesDocForm kind="invoice" initial={newDoc(customer ?? 0)} submitLabel="Save draft" onSubmit={async (v) => {
        const inv = await adminApi.createInvoice(toInvoiceInput(v));
        toast.success(`Draft ${inv.invoice_no} saved.`); await invalidate();
        void navigate({ to: "/admin/invoices/$invoiceId", params: { invoiceId: String(inv.id) } });
      }} />
    </>
  );
}
