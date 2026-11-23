import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/nre/EmptyState";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { PageHeader } from "@/components/nre/PageHeader";
import { StatusPill } from "@/components/nre/StatusPill";
import { apiFieldErrors, useCatalogueAccess } from "@/components/catalogue/shared";
import { CUSTOMER_TYPES, CustomerFormDialog } from "@/components/parties/CustomerFormDialog";
import { LedgerTable } from "@/components/parties/LedgerTable";
import { adminApi } from "@/lib/api";
import { formatBDT } from "@/lib/money";
import { customerLedgerQuery, customerQuery, ordersQuery } from "@/lib/queries";
import { OrderStatusPill } from "@/components/sales/OrderStatusPill";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/customers/$customerId")({
  head: () => noIndexPageHead("Customer — NR Enterprise Admin", "Customer profile, invoices, payments and ledger."),
  component: CustomerProfile,
});


function CustomerProfile() {
  const id = Number(Route.useParams().customerId);
  const { userId, role, ready, canEdit, invalidate } = useCatalogueAccess();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [range, setRange] = useState({ from: "", to: "" });
  const c = useQuery({ ...customerQuery(userId, role, id), enabled: ready && id > 0 });
  const ledger = useQuery({ ...customerLedgerQuery(userId, role, id, { ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) }), enabled: ready && id > 0 });
  const orders = useQuery({ ...ordersQuery(userId, role, { customer_id: id, per_page: 50 }), enabled: ready && id > 0 });
  const data = c.data;

  const remove = async () => {
    if (!data || !window.confirm(`Delete “${data.name}”? Customers with documents are archived instead.`)) return;
    try { const r = await adminApi.deleteCustomer(id); toast.success(r.archived ? "Customer has documents, so it was archived." : "Customer deleted."); await invalidate(); void navigate({ to: "/admin/customers" }); }
    catch (e) { apiFieldErrors(e); }
  };

  if (c.isLoading) return <LoadingSkeleton rows={6} />;
  if (!data) return <EmptyState title="Customer not found" description="It may have been deleted." />;

  return (
    <>
      <div data-print-hide>
        <PageHeader title={data.name} description={`${data.code} · ${CUSTOMER_TYPES[data.type]}${data.area ? ` · ${data.area}` : ""}`}
          actions={<>
            <Button asChild variant="outline"><Link to="/admin/orders/new" search={{ customer: data.id }}>New order</Link></Button>
            <Button asChild variant="outline"><Link to="/admin/invoices/new" search={{ customer: data.id }}>New invoice</Link></Button>
            <Button asChild><Link to="/admin/invoices" search={{ customer: data.id }}>Receive payment</Link></Button>
            <Button variant="ghost" size="icon" aria-label="Edit customer" onClick={() => setEditing(true)}><Pencil className="size-4" /></Button>
            {canEdit && <Button variant="ghost" size="icon" aria-label="Delete customer" onClick={() => void remove()}><Trash2 className="size-4" /></Button>}
          </>} />
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[["Due balance", formatBDT(data.due_balance)], ["Total sales", formatBDT(data.total_sales)], ["Credit limit", formatBDT(data.credit_limit)], ["Credit days", String(data.credit_days)]].map(([l, v]) => (
            <div key={l} className="rounded-2xl border bg-card p-4"><p className="text-sm text-muted-foreground">{l}</p><p className="mt-1 text-xl font-bold tabular-nums" data-testid={l === "Due balance" ? "due-balance" : undefined}>{v}</p></div>
          ))}
        </div>
        <div className="mb-6 grid gap-2 rounded-2xl border bg-card p-4 text-sm sm:grid-cols-2">
          <p><span className="text-muted-foreground">Contact:</span> {data.contact_person ?? "—"}</p>
          <p><span className="text-muted-foreground">Phone:</span> {data.phone ?? "—"}{data.whatsapp ? ` · WhatsApp ${data.whatsapp}` : ""}</p>
          <p><span className="text-muted-foreground">Email:</span> {data.email ?? "—"}</p>
          <p><span className="text-muted-foreground">BIN:</span> {data.bin ?? "—"}</p>
          <p><span className="text-muted-foreground">Billing:</span> {data.billing_address ?? "—"}</p>
          <p><span className="text-muted-foreground">Delivery:</span> {data.delivery_address ?? "—"}</p>
          {data.buyers_served && <p className="sm:col-span-2"><span className="text-muted-foreground">Buyers served:</span> {data.buyers_served}</p>}
        </div>
      </div>
      <Tabs defaultValue="ledger">
        <TabsList data-print-hide className="mb-4 flex-wrap">
          <TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="invoices">Invoices ({data.invoices.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger><TabsTrigger value="ledger">Ledger</TabsTrigger><TabsTrigger value="notes">Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          {orders.data?.data.length ? <ul className="divide-y rounded-2xl border bg-card">{orders.data.data.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><Link to="/admin/orders/$orderId" params={{ orderId: String(o.id) }} className="font-mono text-sm font-semibold hover:underline">{o.order_no}</Link>
              <span className="flex items-center gap-4 text-sm"><span className="text-muted-foreground">{o.order_date}</span><span className="tabular-nums">{formatBDT(o.total)}</span><OrderStatusPill status={o.status} /></span></li>))}</ul>
            : <EmptyState title="No orders yet" description="Use New order to make a quotation for this customer." />}
        </TabsContent>
        <TabsContent value="invoices">
          {data.invoices.length ? <ul className="divide-y rounded-2xl border bg-card">{data.invoices.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><Link to="/admin/invoices/$invoiceId" params={{ invoiceId: String(i.id) }} className="font-mono text-sm font-semibold hover:underline">{i.invoice_no}</Link><p className="text-xs text-muted-foreground">{i.invoice_date}</p></div>
              <div className="flex items-center gap-4 text-sm tabular-nums"><span>{formatBDT(i.total)}</span><span className="text-muted-foreground">Balance {formatBDT(i.balance)}</span><StatusPill status={i.status} /></div></li>))}</ul>
            : <EmptyState title="No invoices yet" description="Invoices for this customer will appear here." />}
        </TabsContent>
        <TabsContent value="payments">
          {data.payments.length ? <ul className="divide-y rounded-2xl border bg-card">{data.payments.map((p) => <li key={p.id} className="flex justify-between p-4 text-sm"><span className="font-mono">{p.receipt_no} · {p.payment_date}</span><span>{formatBDT(p.amount)}</span></li>)}</ul>
            : <EmptyState title="No payments yet" description="Payments received will appear here." />}
        </TabsContent>
        <TabsContent value="ledger">
          <LedgerTable title={`Customer ledger — ${data.name} (${data.code})`} rows={ledger.data} loading={ledger.isLoading} debitLabel="Debit (sold)" creditLabel="Credit (paid)" range={range} onRangeChange={setRange} />
        </TabsContent>
        <TabsContent value="notes"><div className="whitespace-pre-wrap rounded-2xl border bg-card p-4 text-sm">{data.notes ?? <span className="text-muted-foreground">No notes. Use Edit to add some.</span>}</div></TabsContent>
      </Tabs>
      <p data-print-hide className="mt-6"><Link to="/admin/customers" className="text-sm text-secondary hover:underline">← All customers</Link></p>
      <CustomerFormDialog open={editing} onOpenChange={setEditing} customer={data} onSaved={invalidate} />
    </>
  );
}
