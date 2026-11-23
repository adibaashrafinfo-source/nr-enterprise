import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/nre/DataTable";
import { PageHeader } from "@/components/nre/PageHeader";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { ORDER_STATUS, OrderStatusPill } from "@/components/sales/OrderStatusPill";
import { formatBDT } from "@/lib/money";
import { ordersQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";
import type { OrderStatus, SalesOrder } from "@/lib/types";

export const Route = createFileRoute("/admin/orders/")({
  head: () => noIndexPageHead("Sales orders — NR Enterprise Admin", "Quotations and sales orders in the NR Enterprise workspace."),
  component: OrderList,
});

const PER_PAGE = 25;
function OrderList() {
  const { userId, role, ready } = useCatalogueAccess();
  const [q, setQ] = useState(""); const [page, setPage] = useState(1); const [status, setStatus] = useState<OrderStatus | "">("");
  const list = useQuery({ ...ordersQuery(userId, role, { page, per_page: PER_PAGE, ...(q ? { q } : {}), ...(status ? { status } : {}) }), enabled: ready });
  const columns: Column<SalesOrder>[] = [
    { key: "no", header: "Order no.", exportValue: (o) => o.order_no, cell: (o) => <Link to="/admin/orders/$orderId" params={{ orderId: String(o.id) }} className="font-mono text-sm font-semibold hover:underline">{o.order_no}</Link> },
    { key: "date", header: "Date", exportValue: (o) => o.order_date, cell: (o) => o.order_date },
    { key: "cust", header: "Customer", exportValue: (o) => o.customer_name, cell: (o) => o.customer_name },
    { key: "refs", header: "Buyer / style", exportValue: (o) => [o.buyer_ref, o.style_no].filter(Boolean).join(" / "), cell: (o) => [o.buyer_ref, o.style_no].filter(Boolean).join(" / ") || "—" },
    { key: "total", header: "Total", align: "right", exportValue: (o) => o.total, cell: (o) => formatBDT(o.total) },
    { key: "status", header: "Status", exportValue: (o) => ORDER_STATUS[o.status], cell: (o) => <OrderStatusPill status={o.status} /> },
  ];
  const chip = (s: OrderStatus | "", label: string) => ({ id: s || "all", label, active: status === s, onSelect: () => { setStatus(s); setPage(1); } });
  return (
    <>
      <PageHeader title="Sales orders" description="Quotations and confirmed orders. Convert an order into an invoice when you deliver."
        actions={<Button asChild><Link to="/admin/orders/new" search={{}}><Plus className="size-4" /> New order</Link></Button>} />
      <DataTable columns={columns} rows={list.data?.data ?? []} rowKey={(o) => o.id} page={page} perPage={PER_PAGE} total={list.data?.meta.total ?? 0} onPageChange={setPage}
        search={q} onSearchChange={(v) => { setQ(v); setPage(1); }} searchPlaceholder="Search number, customer, PO, style…" loading={list.isLoading} error={list.error ? "Could not load orders." : null}
        emptyTitle="No orders yet" exportFileName="nr-orders"
        filters={[chip("", "All"), chip("quotation", "Quotation"), chip("confirmed", "Confirmed"), chip("delivered", "Delivered"), chip("invoiced", "Invoiced"), chip("cancelled", "Cancelled")]} />
    </>
  );
}
