import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ArrowRight, Boxes, CircleDollarSign, FileText, Inbox, Package, RefreshCw, ShoppingCart, Users, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { EmptyState } from "@/components/nre/EmptyState";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { PageHeader } from "@/components/nre/PageHeader";
import { StatusPill } from "@/components/nre/StatusPill";
import { useAuth } from "@/hooks/use-auth";
import { formatBDT, formatQty, subMoney } from "@/lib/money";
import { dashboardSummaryQuery, lowStockQuery, newEnquiriesQuery, recentInvoicesQuery, salesByDayQuery } from "@/lib/queries";
import { pageHead } from "@/lib/seo";

const HEAD = pageHead("Dashboard — NR Enterprise Admin", "Review sales, customer dues, stock alerts, invoices and new enquiries in the NR Enterprise workspace.");
const chartConfig: ChartConfig = { total: { label: "Sales", color: "var(--color-chart-1)" } };

export const Route = createFileRoute("/admin/")({
  head: () => HEAD,
  component: Dashboard,
});

function Dashboard() {
  const { user, role } = useAuth();
  const [days, setDays] = useState<7 | 30>(7);
  const userId = user?.id ?? 0;
  const enabled = Boolean(user && role);
  const summaryQuery = useQuery({ ...dashboardSummaryQuery(userId, role ?? "staff"), enabled });
  const salesQuery = useQuery({ ...salesByDayQuery(userId, days), enabled });
  const stockQuery = useQuery({ ...lowStockQuery(userId), enabled });
  const invoicesQuery = useQuery({ ...recentInvoicesQuery(userId), enabled });
  const enquiriesQuery = useQuery({ ...newEnquiriesQuery(userId), enabled });
  const summary = summaryQuery.data;
  const delta = summary ? subMoney(summary.sales_today, summary.sales_yesterday) : "0.00";
  const plotData = (salesQuery.data ?? []).map((item) => ({ day: item.day, total: Number(item.total) }));

  return (
    <div className="space-y-7">
      <PageHeader title="Dashboard" description="Sales, stock and customer activity at a glance." actions={
        <Button asChild variant="outline"><Link to="/admin/invoices">View invoices <ArrowRight /></Link></Button>
      } />

      {summaryQuery.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"><span>Dashboard data could not be loaded.</span><Button variant="outline" size="sm" onClick={() => { void summaryQuery.refetch(); }}>Try again</Button></div>}

      <section aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Sales today" value={summary ? formatBDT(summary.sales_today) : "—"} note={summary ? `${delta.startsWith("-") ? "Down" : "Change"} ${formatBDT(delta)} vs yesterday` : "Compared with yesterday"} icon={CircleDollarSign} loading={summaryQuery.isPending} />
        {role !== "staff" && <MetricCard label="Stock value" value={summary?.stock_value === null ? "Unavailable" : summary ? formatBDT(summary.stock_value) : "—"} note="Current stock at recorded purchase cost" icon={Boxes} loading={summaryQuery.isPending} />}
        <MetricCard label="Customer dues" value={summary ? formatBDT(summary.customer_dues) : "—"} note={summary ? `${summary.unpaid_invoices} unpaid invoices` : "Open customer balances"} icon={Users} loading={summaryQuery.isPending} />
        <MetricCard label="Low stock" value={summary ? String(summary.low_stock_count) : "—"} note={summary ? `${summary.variant_count} tracked variants` : "Items at or below reorder level"} icon={Package} loading={summaryQuery.isPending} />
      </section>

      <section className="rounded-2xl border bg-card p-4 shadow-soft md:p-6" aria-labelledby="sales-title">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><h2 id="sales-title" className="text-lg font-semibold">Sales trend</h2><p className="mt-1 text-sm text-muted-foreground">Confirmed invoice totals</p></div>
          <div className="flex gap-1 rounded-full border bg-muted p-1" role="group" aria-label="Sales chart range">
            {([7, 30] as const).map((range) => <Button key={range} type="button" size="sm" variant={days === range ? "default" : "ghost"} aria-pressed={days === range} onClick={() => setDays(range)}>{range} days</Button>)}
          </div>
        </div>
        {salesQuery.isPending ? <div className="mt-6"><LoadingSkeleton rows={4} /></div>
          : salesQuery.isError ? <p role="alert" className="py-12 text-center text-sm text-muted-foreground">Sales trend is unavailable right now.</p>
            : <ChartContainer config={chartConfig} className="mt-5 h-64 w-full aspect-auto sm:h-72">
              <AreaChart data={plotData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="day" tickFormatter={(value) => formatDay(String(value))} tickLine={false} axisLine={false} minTickGap={28} />
                <YAxis tickFormatter={(value) => new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value))} tickLine={false} axisLine={false} width={52} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatBDT(String(value))} />} />
                <Area type="monotone" dataKey="total" stroke="var(--color-total)" strokeWidth={2.5} fill="var(--color-total)" fillOpacity={0.14} activeDot={{ r: 4 }} />
              </AreaChart>
            </ChartContainer>}
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <DashboardPanel title="Low stock" icon={Package} action={<Button asChild variant="link" size="sm"><Link to="/admin/stock">View stock <ArrowRight /></Link></Button>}>
          {stockQuery.isPending ? <LoadingSkeleton rows={3} />
            : stockQuery.isError ? <PanelMessage message="Stock information is unavailable." />
              : stockQuery.data?.data.length ? <ul className="divide-y">{stockQuery.data.data.map((item) => <li key={item.variant_id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><Link to="/admin/stock/$variantId" params={{ variantId: String(item.variant_id) }} className="block truncate font-medium hover:underline">{item.display_name}</Link><p className="mt-1 text-xs text-muted-foreground">{item.product_name} · {item.sku}</p></div><div className="flex items-center gap-3"><span className="text-sm tabular-nums">{formatQty(item.qty_on_hand, item.unit_code)} <span className="text-muted-foreground">/ {formatQty(item.reorder_level)}</span></span><StatusPill status={item.status} /></div></li>)}</ul>
                : <PanelMessage message="No low-stock items need attention." />}
        </DashboardPanel>

        <DashboardPanel title="Recent invoices" icon={FileText} action={<Button asChild variant="link" size="sm"><Link to="/admin/invoices">All invoices <ArrowRight /></Link></Button>}>
          {invoicesQuery.isPending ? <LoadingSkeleton rows={3} />
            : invoicesQuery.isError ? <PanelMessage message="Invoices are unavailable." />
              : invoicesQuery.data?.data.length ? <ul className="divide-y">{invoicesQuery.data.data.map((invoice) => <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="font-medium">{invoice.invoice_no}</p><p className="mt-1 truncate text-xs text-muted-foreground">{invoice.customer_name} · {invoice.invoice_date}</p></div><div className="flex items-center gap-3"><span className="text-sm font-semibold tabular-nums">{formatBDT(invoice.total)}</span><StatusPill status={invoice.status} /></div></li>)}</ul>
                : <PanelMessage message="No invoices have been recorded yet." />}
        </DashboardPanel>

        <DashboardPanel title="New enquiries" icon={Inbox} action={<Button asChild variant="link" size="sm"><Link to="/admin/enquiries">Open inbox <ArrowRight /></Link></Button>}>
          {enquiriesQuery.isPending ? <LoadingSkeleton rows={3} />
            : enquiriesQuery.isError ? <PanelMessage message="Enquiries are unavailable." />
              : enquiriesQuery.data?.data.length ? <ul className="divide-y">{enquiriesQuery.data.data.map((enquiry) => <li key={enquiry.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="font-medium">{enquiry.name}{enquiry.company ? ` · ${enquiry.company}` : ""}</p><p className="mt-1 truncate text-xs text-muted-foreground">{enquiry.product_name ?? "General enquiry"}{enquiry.quantity ? ` · ${enquiry.quantity}` : ""}</p></div><span className="shrink-0 text-xs text-muted-foreground">{formatTimestamp(enquiry.created_at)}</span></li>)}</ul>
                : <PanelMessage message="No new enquiries." />}
        </DashboardPanel>

        <section className="rounded-2xl border bg-card p-5 shadow-soft" aria-labelledby="quick-actions-title">
          <h2 id="quick-actions-title" className="text-lg font-semibold">Quick actions</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <QuickAction to="/admin/invoices" icon={FileText} label="New invoice" />
            <QuickAction to="/admin/purchases" icon={ShoppingCart} label="Receive goods" />
            <QuickAction to="/admin/products" icon={Package} label="Add product" />
            <QuickAction to="/admin/customers" icon={Users} label="Add customer" />
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><RefreshCw className="size-3.5" /> Dashboard refreshes as new records are saved.</p>
        </section>
      </section>
    </div>
  );
}

function MetricCard({ label, value, note, icon: Icon, loading }: { label: string; value: string; note: string; icon: LucideIcon; loading: boolean }) {
  return <section className="rounded-2xl border bg-card p-5 shadow-soft" aria-label={label}>
    <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium text-muted-foreground">{label}</p><span className="grid size-9 place-items-center rounded-full bg-accent text-secondary"><Icon className="size-4" /></span></div>
    {loading ? <div className="mt-4 h-8 w-32 animate-pulse rounded bg-muted" aria-label={`Loading ${label}`} /> : <p className="mt-4 text-2xl font-semibold tabular-nums">{value}</p>}
    <p className="mt-2 min-h-5 text-xs text-muted-foreground">{note}</p>
  </section>;
}

function DashboardPanel({ title, icon: Icon, action, children }: { title: string; icon: LucideIcon; action?: ReactNode; children: ReactNode }) {
  return <section className="rounded-2xl border bg-card p-5 shadow-soft" aria-label={title}>
    <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-accent text-secondary"><Icon className="size-4" /></span><h2 className="font-semibold">{title}</h2></div>{action}</div>
    {children}
  </section>;
}

function PanelMessage({ message }: { message: string }) {
  return <div className="grid min-h-24 place-items-center text-center text-sm text-muted-foreground">{message}</div>;
}

function QuickAction({ to, icon: Icon, label }: { to: "/admin/invoices" | "/admin/purchases" | "/admin/products" | "/admin/customers"; icon: LucideIcon; label: string }) {
  return <Button asChild variant="outline" className="justify-between"><Link to={to}>{label}<Icon /></Link></Button>;
}

function formatDay(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recent";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}
