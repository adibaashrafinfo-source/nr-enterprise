import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FileUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/nre/DataTable";
import { PageHeader } from "@/components/nre/PageHeader";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { CUSTOMER_TYPES, CustomerFormDialog } from "@/components/parties/CustomerFormDialog";
import { adminApi } from "@/lib/api";
import { rowsToCustomers } from "@/lib/customer-import";
import { formatBDT } from "@/lib/money";
import { customerDuesQuery, customersQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";
import type { Customer, CustomerDue } from "@/lib/types";

export const Route = createFileRoute("/admin/customers/")({
  head: () => noIndexPageHead("Customers — NR Enterprise Admin", "Review customer records and balances in the NR Enterprise workspace."),
  component: CustomerList,
});

const PER_PAGE = 25;

function CustomerList() {
  const { userId, role, ready, invalidate } = useCatalogueAccess();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [type, setType] = useState("");
  const [hasDue, setHasDue] = useState(false);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const query = { page, per_page: PER_PAGE, ...(q ? { q } : {}), ...(type ? { type } : {}), ...(hasDue ? { has_due: 1 as const } : {}) };
  const list = useQuery({ ...customersQuery(userId, role, query), enabled: ready });
  const dues = useQuery({ ...customerDuesQuery(userId, role), enabled: ready });

  const importFile = async (file: File | undefined) => {
    if (!file) return;
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
      if (!sheet) throw new Error("empty");
      const rows = rowsToCustomers(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }));
      if (!rows.length) { toast.error("No customer rows found. The first row should hold column names such as Name, Phone, Area."); return; }
      const res = await adminApi.importCustomers(rows);
      if (res.errors.length) toast.warning(`${res.created} added. ${res.errors.length} skipped — row ${res.errors[0]?.row}: ${res.errors[0]?.message}`);
      else toast.success(`${res.created} customers added.`);
      await invalidate();
    } catch { toast.error("Could not read this file. Use .xlsx, .xls or .csv."); } finally { setImporting(false); }
  };

  const columns: Column<Customer>[] = [
    { key: "code", header: "Code", exportValue: (c) => c.code, cell: (c) => <span className="font-mono text-xs">{c.code}</span> },
    { key: "name", header: "Name", exportValue: (c) => c.name, cell: (c) => <Link to="/admin/customers/$customerId" params={{ customerId: String(c.id) }} className="font-semibold hover:underline">{c.name}{!c.is_active && <Badge variant="outline" className="ml-2">Inactive</Badge>}</Link> },
    { key: "phone", header: "Phone", exportValue: (c) => c.phone ?? "", cell: (c) => c.phone ?? "—" },
    { key: "area", header: "Area", exportValue: (c) => c.area ?? "", cell: (c) => c.area ?? "—" },
    { key: "type", header: "Type", exportValue: (c) => CUSTOMER_TYPES[c.type], cell: (c) => CUSTOMER_TYPES[c.type] },
    { key: "sales", header: "Total sales", align: "right", exportValue: (c) => c.total_sales, cell: (c) => formatBDT(c.total_sales) },
    { key: "due", header: "Due balance", align: "right", exportValue: (c) => c.due_balance, cell: (c) => <span className={c.due_balance.startsWith("-") || c.due_balance === "0.00" ? "" : "font-semibold text-destructive"}>{formatBDT(c.due_balance)}</span> },
  ];
  const dueColumns: Column<CustomerDue>[] = [
    { key: "inv", header: "Invoice", exportValue: (d) => d.invoice_no, cell: (d) => <span className="font-mono text-xs">{d.invoice_no}</span> },
    { key: "cust", header: "Customer", exportValue: (d) => d.customer_name, cell: (d) => <Link to="/admin/customers/$customerId" params={{ customerId: String(d.customer_id) }} className="font-semibold hover:underline">{d.customer_name}</Link> },
    { key: "date", header: "Invoice date", exportValue: (d) => d.invoice_date, cell: (d) => d.invoice_date },
    { key: "due", header: "Due date", exportValue: (d) => d.due_date, cell: (d) => d.due_date },
    { key: "days", header: "Days overdue", align: "right", exportValue: (d) => d.days_overdue, cell: (d) => <span className={d.days_overdue > 0 ? "font-semibold text-destructive" : ""}>{d.days_overdue}</span> },
    { key: "bal", header: "Balance", align: "right", exportValue: (d) => d.balance, cell: (d) => formatBDT(d.balance) },
  ];

  return (
    <>
      <PageHeader title="Customers" description="Customer details, sales and what each one still owes."
        actions={<>
          <Button asChild variant="outline" disabled={importing}><label className="cursor-pointer"><FileUp className="size-4" /> {importing ? "Importing…" : "Import Excel"}<input type="file" accept=".xlsx,.xls,.csv" className="sr-only" aria-label="Import customers file" onChange={(e) => { void importFile(e.target.files?.[0]); e.target.value = ""; }} /></label></Button>
          <Button onClick={() => setAdding(true)}><Plus className="size-4" /> Add customer</Button>
        </>} />
      <Tabs defaultValue="all">
        <TabsList className="mb-4"><TabsTrigger value="all">All customers</TabsTrigger><TabsTrigger value="dues">Due follow-up{dues.data?.meta.total ? ` (${dues.data.meta.total})` : ""}</TabsTrigger></TabsList>
        <TabsContent value="all">
          <DataTable columns={columns} rows={list.data?.data ?? []} rowKey={(c) => c.id} page={page} perPage={PER_PAGE} total={list.data?.meta.total ?? 0}
            onPageChange={setPage} search={q} onSearchChange={(v) => { setQ(v); setPage(1); }} searchPlaceholder="Search name, phone or area…"
            loading={list.isLoading} error={list.error ? "Could not load customers." : null} emptyTitle="No customers match" exportFileName="nr-customers"
            filters={[{ id: "due", label: "Has due", active: hasDue, onSelect: () => { setHasDue((v) => !v); setPage(1); } }]}
            toolbar={
              <Select value={type || "all"} onValueChange={(v) => { setType(v === "all" ? "" : v); setPage(1); }}>
                <SelectTrigger className="w-full rounded-full sm:w-48" aria-label="Filter by type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All types</SelectItem>{Object.entries(CUSTOMER_TYPES).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            } />
        </TabsContent>
        <TabsContent value="dues">
          <DataTable columns={dueColumns} rows={dues.data?.data ?? []} rowKey={(d) => d.invoice_id} page={1} perPage={100} total={dues.data?.meta.total ?? 0} onPageChange={() => {}}
            loading={dues.isLoading} error={dues.error ? "Could not load dues." : null} emptyTitle="No unpaid invoices" exportFileName="nr-customer-dues" />
        </TabsContent>
      </Tabs>
      <CustomerFormDialog open={adding} onOpenChange={setAdding} onSaved={async (c) => { await invalidate(); void navigate({ to: "/admin/customers/$customerId", params: { customerId: String(c.id) } }); }} />
    </>
  );
}
