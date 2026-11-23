import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/nre/DataTable";
import { PageHeader } from "@/components/nre/PageHeader";
import { StatusPill } from "@/components/nre/StatusPill";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { formatBDT } from "@/lib/money";
import { customersQuery, invoicesQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";
import type { Invoice, InvoiceStatus } from "@/lib/types";

export const Route = createFileRoute("/admin/invoices/")({
  validateSearch: (s: Record<string, unknown>): { customer?: number } => (Number(s["customer"]) > 0 ? { customer: Number(s["customer"]) } : {}),
  head: () => noIndexPageHead("Invoices — NR Enterprise Admin", "Invoices, balances and payments in the NR Enterprise workspace."),
  component: InvoiceList,
});

const PER_PAGE = 25;
function InvoiceList() {
  const { customer } = Route.useSearch();
  const { userId, role, ready } = useCatalogueAccess();
  const [q, setQ] = useState(""); const [page, setPage] = useState(1);
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [customerId, setCustomerId] = useState(customer ?? 0);
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const customers = useQuery({ ...customersQuery(userId, role, { per_page: 100 }), enabled: ready });
  const list = useQuery({ ...invoicesQuery(userId, role, { page, per_page: PER_PAGE, ...(q ? { q } : {}), ...(status ? { status } : {}), ...(customerId ? { customer_id: customerId } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }), enabled: ready });
  const columns: Column<Invoice>[] = [
    { key: "no", header: "Number", exportValue: (i) => i.invoice_no, cell: (i) => <Link to="/admin/invoices/$invoiceId" params={{ invoiceId: String(i.id) }} className="font-mono text-sm font-semibold hover:underline">{i.invoice_no}</Link> },
    { key: "date", header: "Date", exportValue: (i) => i.invoice_date, cell: (i) => i.invoice_date },
    { key: "cust", header: "Customer", exportValue: (i) => i.customer_name, cell: (i) => i.customer_name },
    { key: "total", header: "Total", align: "right", exportValue: (i) => i.total, cell: (i) => formatBDT(i.total) },
    { key: "paid", header: "Paid", align: "right", exportValue: (i) => i.paid, cell: (i) => formatBDT(i.paid) },
    { key: "bal", header: "Balance", align: "right", exportValue: (i) => i.balance, cell: (i) => <span className="font-semibold">{formatBDT(i.balance)}</span> },
    { key: "status", header: "Status", exportValue: (i) => i.status, cell: (i) => <StatusPill status={i.status} /> },
  ];
  const chip = (s: InvoiceStatus | "", label: string) => ({ id: s || "all", label, active: status === s, onSelect: () => { setStatus(s); setPage(1); } });
  return (
    <>
      <PageHeader title="Invoices" description="Drafts can be edited. Confirming an invoice takes the stock out."
        actions={<Button asChild><Link to="/admin/invoices/new" search={customerId ? { customer: customerId } : {}}><Plus className="size-4" /> New invoice</Link></Button>} />
      <DataTable columns={columns} rows={list.data?.data ?? []} rowKey={(i) => i.id} page={page} perPage={PER_PAGE} total={list.data?.meta.total ?? 0} onPageChange={setPage}
        search={q} onSearchChange={(v) => { setQ(v); setPage(1); }} searchPlaceholder="Search number or customer…" loading={list.isLoading} error={list.error ? "Could not load invoices." : null}
        emptyTitle="No invoices match" exportFileName="nr-invoices"
        filters={[chip("", "All"), chip("draft", "Draft"), chip("due", "Due"), chip("partial", "Partial"), chip("paid", "Paid"), chip("cancelled", "Cancelled")]}
        toolbar={<div className="flex flex-wrap gap-2">
          <Select value={String(customerId)} onValueChange={(v) => { setCustomerId(Number(v)); setPage(1); }}>
            <SelectTrigger className="w-full rounded-full sm:w-56" aria-label="Filter by customer"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="0">All customers</SelectItem>{(customers.data?.data ?? []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
          <Input type="date" aria-label="From date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="w-auto rounded-full" />
          <Input type="date" aria-label="To date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="w-auto rounded-full" />
        </div>} />
    </>
  );
}
