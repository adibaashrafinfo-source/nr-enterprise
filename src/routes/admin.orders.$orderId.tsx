import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/nre/EmptyState";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { PageHeader } from "@/components/nre/PageHeader";
import { apiFieldErrors, useCatalogueAccess } from "@/components/catalogue/shared";
import { LinesEditor } from "@/components/sales/LinesEditor";
import { OrderStatusPill } from "@/components/sales/OrderStatusPill";
import { SalesDocForm } from "@/components/sales/SalesDocForm";
import { fromDoc, toOrderInput } from "@/components/sales/doc-convert";
import { adminApi } from "@/lib/api";
import { formatBDT } from "@/lib/money";
import { orderQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";
import type { OrderStatus } from "@/lib/types";

export const Route = createFileRoute("/admin/orders/$orderId")({
  head: () => noIndexPageHead("Sales order — NR Enterprise Admin", "View, update and convert a sales order."),
  component: OrderPage,
});

function OrderPage() {
  const id = Number(Route.useParams().orderId);
  const { userId, role, ready, canEdit, invalidate } = useCatalogueAccess();
  const navigate = useNavigate();
  const q = useQuery({ ...orderQuery(userId, role, id), enabled: ready && id > 0 });
  const o = q.data;
  if (q.isLoading) return <LoadingSkeleton rows={6} />;
  if (!o) return <EmptyState title="Order not found" />;
  const editable = o.status === "quotation" || o.status === "confirmed";
  const setStatus = async (s: OrderStatus) => {
    if (s === "cancelled" && !window.confirm(`Cancel ${o.order_no}?`)) return;
    try { await adminApi.setOrderStatus(o.id, s); toast.success("Order updated."); await invalidate(); } catch (e) { apiFieldErrors(e); }
  };
  const convert = async () => {
    try { const r = await adminApi.convertOrder(o.id); toast.success("Draft invoice created."); await invalidate(); void navigate({ to: "/admin/invoices/$invoiceId", params: { invoiceId: String(r.invoice_id) } }); }
    catch (e) { apiFieldErrors(e); }
  };
  return (
    <>
      <PageHeader title={`${o.order_no} · ${o.customer_name}`} description={`Order date ${o.order_date}${o.delivery_date ? ` · Delivery ${o.delivery_date}` : ""}`}
        actions={<>
          <OrderStatusPill status={o.status} />
          <Button asChild variant="outline"><Link to="/admin/print/$kind/$id" params={{ kind: "quotation", id: String(o.id) }}><Printer className="size-4" /> Print quotation</Link></Button>
          {o.status === "quotation" && <Button variant="outline" onClick={() => void setStatus("confirmed")}>Mark confirmed</Button>}
          {o.status === "confirmed" && <Button variant="outline" onClick={() => void setStatus("delivered")}>Mark delivered</Button>}
          {canEdit && o.status !== "invoiced" && o.status !== "cancelled" && <Button variant="ghost" onClick={() => void setStatus("cancelled")}>Cancel order</Button>}
          {o.status !== "invoiced" && o.status !== "cancelled" && <Button onClick={() => void convert()}><FileText className="size-4" /> Convert to invoice</Button>}
          {o.invoice_id && <Button asChild variant="link"><Link to="/admin/invoices/$invoiceId" params={{ invoiceId: String(o.invoice_id) }}>Open invoice</Link></Button>}
        </>} />
      {editable ? (
        <SalesDocForm key={`${o.id}-${o.total}`} kind="order" initial={fromDoc(o, o.order_date, o.delivery_date)} submitLabel="Save changes" onSubmit={async (v) => { await adminApi.updateOrder(o.id, toOrderInput(v)); toast.success("Order saved."); await invalidate(); }} />
      ) : (
        <div className="space-y-4">
          <LinesEditor lines={o.items} onChange={() => {}} errors={{}} readOnly />
          <div className="ml-auto max-w-xs space-y-1 rounded-2xl border bg-card p-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatBDT(o.subtotal, { decimals: true })}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>−{formatBDT(o.discount, { decimals: true })}</span></div>
            <div className="flex justify-between border-t pt-1 font-bold"><span>Total</span><span>{formatBDT(o.total, { decimals: true })}</span></div>
          </div>
        </div>
      )}
    </>
  );
}
