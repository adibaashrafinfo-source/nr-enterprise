import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/nre/PageHeader";
import type { Column } from "@/components/nre/DataTable";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { ReportTable } from "@/components/backoffice/ReportTable";
import { adminApi, type DuesAgingRow, type GroupRow, type MovementReportRow, type PayableRow, type StockReportRow } from "@/lib/api";
import { addMoney, formatBDT, formatQty } from "@/lib/money";
import { noIndexPageHead } from "@/lib/seo";
import type { StockRow } from "@/lib/types";

export const Route = createFileRoute("/admin/reports")({
  head: () => noIndexPageHead("Reports — NR Enterprise Admin", "Review stock, sales, dues and purchasing reports for NR Enterprise."),
  component: Reports,
});

type Key = "stock" | "low" | "movements" | "sales" | "purchases" | "dues" | "payables" | "profit";
const REPORTS: { key: Key; label: string; manager: boolean; dated: boolean }[] = [
  { key: "stock", label: "Stock & value", manager: true, dated: false }, { key: "low", label: "Low stock", manager: false, dated: false },
  { key: "movements", label: "Stock movement", manager: false, dated: true }, { key: "sales", label: "Sales", manager: true, dated: true },
  { key: "purchases", label: "Purchases", manager: true, dated: true }, { key: "dues", label: "Customer dues & aging", manager: false, dated: false },
  { key: "payables", label: "Supplier payable", manager: true, dated: false }, { key: "profit", label: "Profit summary", manager: true, dated: true },
];
const money = (v: string) => formatBDT(v, { decimals: true });

function Reports() {
  const { userId, role, ready, canEdit } = useCatalogueAccess();
  const visible = REPORTS.filter((r) => canEdit || !r.manager);
  const [key, setKey] = useState<Key>("low");
  const [range, setRange] = useState({ from: "", to: "" });
  const [group, setGroup] = useState<"day" | "customer" | "product" | "supplier">("day");
  const current = visible.find((r) => r.key === key) ?? visible[0]!;
  const q = { ...(range.from ? { from: range.from } : {}), ...(range.to ? { to: range.to } : {}) };
  const salesGroup = group === "supplier" ? "day" : group; const purchaseGroup = group === "customer" ? "day" : group;
  const data = useQuery({
    queryKey: ["admin", userId, role, "reports", current.key, q, group], enabled: ready,
    queryFn: async (): Promise<unknown> => {
      switch (current.key) {
        case "stock": return adminApi.reportStock();
        case "low": return adminApi.reportLowStock();
        case "movements": return adminApi.reportMovements(q);
        case "sales": return adminApi.reportSales({ ...q, group: salesGroup });
        case "purchases": return adminApi.reportPurchases({ ...q, group: purchaseGroup });
        case "dues": return adminApi.reportDues();
        case "payables": return adminApi.reportPayables();
        case "profit": return adminApi.reportProfit(q);
      }
    },
  });
  const common = { loading: data.isLoading, error: data.error, fileName: `nr-report-${current.key}` };
  const rows = <T,>() => (Array.isArray(data.data) ? data.data as T[] : []);
  const total = (label: string, v: string) => <p className="mt-3 text-right text-sm">{label} <b className="ml-2 text-lg tabular-nums">{money(v)}</b></p>;

  let body: React.ReactNode = null;
  if (current.key === "stock") {
    const r = rows<StockReportRow>();
    body = <ReportTable {...common} rows={r} rowKey={(x) => x.variant_id} footer={total("Total stock value", addMoney(...r.map((x) => x.value)))} columns={[
      { key: "item", header: "Item", exportValue: (x) => x.display_name, cell: (x) => <><p className="font-medium">{x.display_name}</p><p className="font-mono text-xs text-muted-foreground">{x.sku}</p></> },
      { key: "cat", header: "Category", exportValue: (x) => x.category_name, cell: (x) => x.category_name },
      { key: "qty", header: "On hand", align: "right", exportValue: (x) => x.qty_on_hand, cell: (x) => formatQty(x.qty_on_hand, x.unit_code) },
      { key: "cost", header: "Purchase price", align: "right", exportValue: (x) => x.purchase_price, cell: (x) => money(x.purchase_price) },
      { key: "value", header: "Value", align: "right", exportValue: (x) => x.value, cell: (x) => money(x.value) },
    ] satisfies Column<StockReportRow>[]} />;
  } else if (current.key === "low") {
    body = <ReportTable {...common} rows={rows<StockRow>()} rowKey={(x) => x.variant_id} columns={[
      { key: "item", header: "Item", exportValue: (x) => x.display_name, cell: (x) => <><p className="font-medium">{x.display_name}</p><p className="font-mono text-xs text-muted-foreground">{x.sku}</p></> },
      { key: "qty", header: "On hand", align: "right", exportValue: (x) => x.qty_on_hand, cell: (x) => formatQty(x.qty_on_hand, x.unit_code) },
      { key: "lvl", header: "Reorder level", align: "right", exportValue: (x) => x.reorder_level, cell: (x) => formatQty(x.reorder_level, x.unit_code) },
      { key: "st", header: "Status", exportValue: (x) => x.status, cell: (x) => (x.status === "out" ? <span className="font-semibold text-destructive">Out</span> : <span className="font-semibold text-warning">Low</span>) },
    ] satisfies Column<StockRow>[]} />;
  } else if (current.key === "movements") {
    body = <ReportTable {...common} rows={rows<MovementReportRow>()} rowKey={(x) => x.id} columns={[
      { key: "d", header: "Date", exportValue: (x) => x.date, cell: (x) => x.date },
      { key: "item", header: "Item", exportValue: (x) => x.display_name, cell: (x) => x.display_name },
      { key: "t", header: "Type", exportValue: (x) => x.type, cell: (x) => x.type.replaceAll("_", " ") },
      { key: "q", header: "Quantity", align: "right", exportValue: (x) => x.quantity, cell: (x) => formatQty(x.quantity) },
      { key: "u", header: "By", exportValue: (x) => x.user_name, cell: (x) => x.user_name },
      { key: "n", header: "Note", exportValue: (x) => x.note ?? "", cell: (x) => x.note ?? "—" },
    ] satisfies Column<MovementReportRow>[]} />;
  } else if (current.key === "sales" || current.key === "purchases") {
    const r = rows<GroupRow>();
    body = <ReportTable {...common} rows={r} rowKey={(x) => x.key} footer={total(current.key === "sales" ? "Total sales" : "Total received", addMoney(...r.map((x) => x.total)))} columns={[
      { key: "l", header: group === "day" ? "Date" : group === "product" ? "Product" : group === "customer" ? "Customer" : "Supplier", exportValue: (x) => x.label, cell: (x) => x.label },
      { key: "c", header: "Entries", align: "right", exportValue: (x) => x.count, cell: (x) => x.count },
      { key: "t", header: "Amount", align: "right", exportValue: (x) => x.total, cell: (x) => money(x.total) },
    ] satisfies Column<GroupRow>[]} />;
  } else if (current.key === "dues") {
    const r = rows<DuesAgingRow>();
    body = <ReportTable {...common} rows={r} rowKey={(x) => x.customer_id} footer={total("Total due", addMoney(...r.map((x) => x.total)))} columns={[
      { key: "n", header: "Customer", exportValue: (x) => x.customer_name, cell: (x) => <span lang="bn">{x.customer_name}</span> },
      ...(["0-30", "31-60", "61-90", "90+"] as const).map((b) => ({ key: b, header: `${b} days`, align: "right" as const, exportValue: (x: DuesAgingRow) => x[b], cell: (x: DuesAgingRow) => money(x[b]) })),
      { key: "t", header: "Total", align: "right", exportValue: (x) => x.total, cell: (x) => <b>{money(x.total)}</b> },
    ] satisfies Column<DuesAgingRow>[]} />;
  } else if (current.key === "payables") {
    const r = rows<PayableRow>();
    body = <ReportTable {...common} rows={r} rowKey={(x) => x.supplier_id} footer={total("Total payable", addMoney(...r.map((x) => x.payable_balance)))} columns={[
      { key: "n", header: "Supplier", exportValue: (x) => x.name, cell: (x) => <>{x.name} <span className="font-mono text-xs text-muted-foreground">{x.code}</span></> },
      { key: "b", header: "Purchased", align: "right", exportValue: (x) => x.total_purchased, cell: (x) => money(x.total_purchased) },
      { key: "p", header: "Paid", align: "right", exportValue: (x) => x.paid, cell: (x) => money(x.paid) },
      { key: "d", header: "Payable", align: "right", exportValue: (x) => x.payable_balance, cell: (x) => <b>{money(x.payable_balance)}</b> },
    ] satisfies Column<PayableRow>[]} />;
  } else if (current.key === "profit") {
    const p = data.data as { sales: string; cost: string; profit: string } | undefined;
    body = <div className="grid gap-4 sm:grid-cols-3">{[["Sales", p?.sales], ["Cost of goods", p?.cost], ["Profit", p?.profit]].map(([l, v]) => (
      <div key={l} className="rounded-2xl border bg-card p-5"><p className="text-sm text-muted-foreground">{l}</p><p className="mt-1 text-2xl font-bold tabular-nums" data-testid={`profit-${l}`}>{v ? money(v) : "—"}</p></div>))}
      <p className="text-xs text-muted-foreground sm:col-span-3">Sales are confirmed invoices after discount. Cost uses each item's current purchase price.</p></div>;
  }

  return (
    <>
      <div data-print-hide>
        <PageHeader title="Reports" description={canEdit ? "Stock, sales, purchases, dues and profit." : "Stock and customer dues reports."}
          actions={<Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>} />
        <div className="mb-4 flex flex-wrap gap-2" role="tablist">
          {visible.map((r) => <Button key={r.key} role="tab" aria-selected={r.key === current.key} size="sm" variant={r.key === current.key ? "default" : "outline"} onClick={() => { setKey(r.key); setGroup("day"); }}>{r.label}</Button>)}
        </div>
        {current.dated && (
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3">
            <label className="text-sm">From<Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></label>
            <label className="text-sm">To<Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></label>
            {(current.key === "sales" || current.key === "purchases") && (
              <label className="text-sm">Group by
                <select className="block h-10 rounded-md border bg-background px-3" value={group} onChange={(e) => setGroup(e.target.value as typeof group)}>
                  <option value="day">Date</option><option value={current.key === "sales" ? "customer" : "supplier"}>{current.key === "sales" ? "Customer" : "Supplier"}</option><option value="product">Product</option>
                </select></label>
            )}
            {(range.from || range.to) && <Button variant="ghost" size="sm" onClick={() => setRange({ from: "", to: "" })}>Clear dates</Button>}
          </div>
        )}
      </div>
      <h2 className="mb-3 hidden text-lg font-bold print:block">{current.label}{range.from || range.to ? ` · ${range.from || "…"} to ${range.to || "…"}` : ""}</h2>
      {body}
    </>
  );
}
