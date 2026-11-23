import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/nre/DataTable";
import { PageHeader } from "@/components/nre/PageHeader";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { SupplierFormDialog } from "@/components/parties/SupplierFormDialog";
import { formatBDT } from "@/lib/money";
import { suppliersQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";
import type { Supplier } from "@/lib/types";

export const Route = createFileRoute("/admin/suppliers/")({
  head: () => noIndexPageHead("Suppliers — NR Enterprise Admin", "Manage NR Enterprise suppliers, purchases and payables."),
  component: SupplierList,
});

const PER_PAGE = 25;

function SupplierList() {
  const { userId, role, ready, canEdit, invalidate } = useCatalogueAccess();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const list = useQuery({ ...suppliersQuery(userId, role, { page, per_page: PER_PAGE, ...(q ? { q } : {}) }), enabled: ready && canEdit });

  const columns: Column<Supplier>[] = [
    { key: "code", header: "Code", exportValue: (s) => s.code, cell: (s) => <span className="font-mono text-xs">{s.code}</span> },
    { key: "name", header: "Name", exportValue: (s) => s.name, cell: (s) => <Link to="/admin/suppliers/$supplierId" params={{ supplierId: String(s.id) }} className="font-semibold hover:underline">{s.name}{!s.is_active && <Badge variant="outline" className="ml-2">Inactive</Badge>}</Link> },
    { key: "phone", header: "Phone", exportValue: (s) => s.phone ?? "", cell: (s) => s.phone ?? "—" },
    { key: "purchased", header: "Total purchased", align: "right", exportValue: (s) => s.total_purchased, cell: (s) => formatBDT(s.total_purchased) },
    { key: "paid", header: "Paid", align: "right", exportValue: (s) => s.paid, cell: (s) => formatBDT(s.paid) },
    { key: "payable", header: "Payable", align: "right", exportValue: (s) => s.payable_balance, cell: (s) => <span className="font-semibold">{formatBDT(s.payable_balance)}</span> },
  ];

  return (
    <>
      <PageHeader title="Suppliers" description="Who you buy from and what you still owe them." actions={<Button onClick={() => setAdding(true)}><Plus className="size-4" /> Add supplier</Button>} />
      <DataTable columns={columns} rows={list.data?.data ?? []} rowKey={(s) => s.id} page={page} perPage={PER_PAGE} total={list.data?.meta.total ?? 0}
        onPageChange={setPage} search={q} onSearchChange={(v) => { setQ(v); setPage(1); }} searchPlaceholder="Search name or phone…"
        loading={list.isLoading} error={list.error ? "Could not load suppliers." : null} emptyTitle="No suppliers yet" exportFileName="nr-suppliers" />
      <SupplierFormDialog open={adding} onOpenChange={setAdding} onSaved={async (s) => { await invalidate(); void navigate({ to: "/admin/suppliers/$supplierId", params: { supplierId: String(s.id) } }); }} />
    </>
  );
}
