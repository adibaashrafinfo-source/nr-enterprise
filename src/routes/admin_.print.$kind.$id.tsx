import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { useAuth } from "@/hooks/use-auth";
import { adminApi } from "@/lib/api";
import { amountInWords, formatBDT, formatQty, toScaled } from "@/lib/money";
import { noIndexPageHead } from "@/lib/seo";
import type { CompanyBlock, Customer, SalesLine, Supplier } from "@/lib/types";

type Kind = "invoice" | "challan" | "receipt" | "quotation" | "purchase" | "voucher";
const KINDS: Kind[] = ["invoice", "challan", "receipt", "quotation", "purchase", "voucher"];
type Party = Pick<Customer, "name" | "billing_address" | "area" | "phone" | "bin">;
const supplierParty = (s: Supplier): Party => ({ name: s.name, billing_address: s.address, area: null, phone: s.phone, bin: null });

export const Route = createFileRoute("/admin_/print/$kind/$id")({
  head: () => noIndexPageHead("Print — NR Enterprise", "Printable NR Enterprise document."),
  component: PrintPage,
});

const fmtDate = (d: string | null | undefined) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—");

interface Doc {
  title: string; number: string; date: string; due?: string | null; terms?: string; company: CompanyBlock; customer: Party; partyLabel?: string;
  refs: { buyer_ref?: string | null; po_no?: string | null; style_no?: string | null };
  lines?: SalesLine[]; priced: boolean; totals?: { subtotal: string; discount: string; tax_rate?: string; tax_amount?: string; total: string; paid?: string; balance?: string };
  extra?: [string, string][]; words?: string; signLeft: string; signRight: string;
}

function useDoc(kind: Kind, id: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin", user?.id ?? 0, "print", kind, id], enabled: Boolean(user) && KINDS.includes(kind) && id > 0,
    queryFn: async (): Promise<Doc> => {
      if (kind === "invoice") {
        const i = await adminApi.invoice(id);
        return { title: i.status === "draft" ? "DRAFT INVOICE" : i.company.tax_enabled ? "TAX INVOICE" : "INVOICE", number: i.invoice_no, date: i.invoice_date, due: i.due_date ?? null, terms: i.customer.credit_days ? `Credit ${i.customer.credit_days}d` : "Cash",
          company: i.company, customer: i.customer, refs: i, lines: i.items, priced: true, words: amountInWords(i.total),
          totals: { subtotal: i.subtotal, discount: i.discount, ...(i.tax_rate ? { tax_rate: i.tax_rate } : {}), tax_amount: i.tax_amount, total: i.total, paid: i.paid, balance: i.balance }, signLeft: "Received by", signRight: "Authorised by" };
      }
      if (kind === "quotation") {
        const o = await adminApi.order(id);
        const c = (await adminApi.customer(o.customer_id));
        return { title: "QUOTATION", number: o.order_no, date: o.order_date, due: o.delivery_date, company: o.company, customer: c, refs: o, lines: o.items, priced: true, words: amountInWords(o.total),
          totals: { subtotal: o.subtotal, discount: o.discount, total: o.total }, signLeft: "Accepted by", signRight: "Authorised by" };
      }
      if (kind === "challan") {
        const ch = await adminApi.challan(id);
        return { title: "DELIVERY CHALLAN", number: ch.challan_no, date: ch.challan_date, company: ch.company, customer: ch.customer, refs: ch,
          lines: ch.items.map((l) => ({ ...l, variant_id: null, rate: "0", discount_percent: "0" })), priced: false,
          extra: [["Invoice", ch.invoice_no], ["Vehicle no.", ch.vehicle_no ?? "—"], ["Driver", ch.driver_name ?? "—"], ["Note", ch.note ?? "—"]], signLeft: `Received by${ch.received_by ? `: ${ch.received_by}` : ""}`, signRight: "Delivered by" };
      }
      if (kind === "purchase") {
        const po = await adminApi.purchase(id);
        return { title: po.status === "draft" ? "DRAFT PURCHASE ORDER" : "PURCHASE ORDER", number: po.po_no, date: po.order_date, due: po.expected_date, company: po.company, customer: supplierParty(po.supplier), partyLabel: "Supplier", refs: {},
          lines: po.items.map((l) => ({ variant_id: l.variant_id, description: `${l.display_name} (${l.sku})`, unit_code: l.unit_code, quantity: l.qty_ordered, rate: l.rate, discount_percent: "0", amount: l.line_total })), priced: true, words: amountInWords(po.total),
          totals: { subtotal: po.total, discount: "0.00", total: po.total }, extra: [["Supplier bill no.", po.bill_no ?? "—"], ["Notes", po.notes ?? "—"]], signLeft: "Supplier acceptance", signRight: "Authorised by" };
      }
      if (kind === "voucher") {
        const v = await adminApi.supplierPayment(id);
        return { title: "PAYMENT VOUCHER", number: v.voucher_no, date: v.payment_date, company: v.company, customer: supplierParty(v.supplier), partyLabel: "Paid to", refs: {}, priced: true,
          extra: [["Against PO", v.po_no ?? "—"], ["Method", v.method], ["Reference", v.reference_no ?? "—"], ["Amount", formatBDT(v.amount, { decimals: true })], ["Payable after", formatBDT(v.supplier.payable_balance, { decimals: true })], ["Note", v.note ?? "—"]],
          words: amountInWords(v.amount), signLeft: "Received by", signRight: "Paid by" };
      }
      const p = await adminApi.payment(id);
      const c = p.invoice?.customer ?? (await adminApi.customer(p.customer_id));
      return { title: p.method === "credit_note" ? "CREDIT NOTE" : "MONEY RECEIPT", number: p.receipt_no, date: p.payment_date, company: p.company, customer: c, refs: p.invoice ?? {}, priced: true,
        extra: [["Against invoice", p.invoice_no ?? "—"], ["Method", p.method.replace("_", " ")], ["Reference", p.reference_no ?? "—"], ["Amount", formatBDT(p.amount, { decimals: true })], ...(p.invoice ? [["Balance after", formatBDT(p.invoice.balance, { decimals: true })] as [string, string]] : []), ["Note", p.note ?? "—"]],
        words: amountInWords(p.amount), signLeft: "Paid by", signRight: "Received by" };
    },
  });
}

function PrintPage() {
  const { kind, id } = Route.useParams();
  const router = useRouter();
  const { user, loading } = useAuth();
  const q = useDoc(kind as Kind, Number(id));
  if (loading) return <div className="p-8"><LoadingSkeleton /></div>;
  if (!user) return <div className="p-8 text-center"><p className="mb-4">Please sign in to view this document.</p><Button asChild><Link to="/admin/login">Sign in</Link></Button></div>;
  if (!KINDS.includes(kind as Kind)) return <p className="p-8">Unknown document type.</p>;
  if (q.isLoading) return <div className="p-8"><LoadingSkeleton rows={8} /></div>;
  if (!q.data) return <p className="p-8">This document could not be loaded.</p>;
  const d = q.data;
  return (
    <div className="min-h-screen bg-muted py-6 print:bg-transparent print:py-0">
      <div data-print-hide className="mx-auto mb-4 flex max-w-[210mm] justify-between gap-2 px-2">
        <Button variant="outline" onClick={() => router.history.back()}><ArrowLeft className="size-4" /> Back</Button>
        <Button onClick={() => window.print()}><Printer className="size-4" /> Print / save PDF</Button>
      </div>
      <article className="print-sheet mx-auto w-full max-w-[210mm] bg-card p-[12mm] text-[12px] leading-snug text-card-foreground shadow-sm print:shadow-none" style={{ fontFamily: "Poppins, 'Hind Siliguri', sans-serif" }}>
        <header className="flex justify-between gap-6 border-b pb-4">
          <div className="flex gap-3">
            <img src={d.company.logo_url} alt="NR Enterprise" className="h-14 w-14 object-contain" />
            <div><p className="text-base font-bold">{d.company.company_name}</p><p className="max-w-[80mm]">{d.company.address}</p>
              <p>{d.company.phones.join(", ")}</p><p>{d.company.emails.join(", ")}{d.company.bin ? ` · BIN: ${d.company.bin}` : ""}</p></div>
          </div>
          <div className="text-right"><p className="text-lg font-bold tracking-wide">{d.title}</p>
            <p>No: <b>{d.number}</b></p><p>Date: {fmtDate(d.date)}</p>{d.due !== undefined && <p>{d.title === "QUOTATION" ? "Delivery" : d.title.includes("PURCHASE") ? "Expected" : "Due"}: {fmtDate(d.due)}</p>}{d.terms && <p>Terms: {d.terms}</p>}</div>
        </header>
        <section className="flex justify-between gap-6 border-b py-3">
          <div><p className="text-[11px] uppercase text-muted-foreground">{d.partyLabel ?? "Bill to"}</p><p className="font-semibold" lang="bn">{d.customer.name}</p>
            <p>{d.customer.billing_address ?? d.customer.area ?? ""}</p><p>{[d.customer.phone, d.customer.bin ? `BIN: ${d.customer.bin}` : null].filter(Boolean).join(" · ")}</p></div>
          <div className="text-right">{d.refs.buyer_ref && <p>Buyer: {d.refs.buyer_ref}</p>}{d.refs.po_no && <p>PO: {d.refs.po_no}</p>}{d.refs.style_no && <p>Style: {d.refs.style_no}</p>}</div>
        </section>
        {d.extra && <dl className="grid grid-cols-2 gap-x-6 gap-y-1 border-b py-3">{d.extra.map(([k, v]) => <div key={k} className="flex gap-2"><dt className="text-muted-foreground">{k}:</dt><dd className="font-medium">{v}</dd></div>)}</dl>}
        {d.lines && (
          <table className="mt-3 w-full border-collapse">
            <thead><tr className="border-y bg-muted/60 text-left"><th className="p-1.5">#</th><th className="p-1.5">Item</th><th className="p-1.5 text-right">Qty</th><th className="p-1.5">Unit</th>{d.priced && <><th className="p-1.5 text-right">Rate</th><th className="p-1.5 text-right">Amount</th></>}</tr></thead>
            <tbody>{d.lines.map((l, i) => <tr key={i} className="border-b"><td className="p-1.5">{i + 1}</td><td className="p-1.5" lang="bn">{l.description}{l.discount_percent && Number(l.discount_percent) > 0 ? ` (−${Number(l.discount_percent)}%)` : ""}</td><td className="p-1.5 text-right">{formatQty(l.quantity)}</td><td className="p-1.5">{l.unit_code}</td>{d.priced && <><td className="p-1.5 text-right">{formatBDT(l.rate, { decimals: true }).replace("৳ ", "")}</td><td className="p-1.5 text-right">{formatBDT(l.amount, { decimals: true }).replace("৳ ", "")}</td></>}</tr>)}</tbody>
          </table>
        )}
        {(d.totals || d.words) && (
          <section className="mt-3 flex justify-between gap-6">
            <div className="max-w-[100mm] space-y-2">{d.words && <p><span className="text-muted-foreground">In words (BDT):</span> <b>{d.words}</b></p>}{d.company.bank_details && d.title !== "DELIVERY CHALLAN" && <p className="whitespace-pre-line text-muted-foreground">{d.company.bank_details}</p>}</div>
            {d.totals && <table className="w-[70mm]"><tbody>
              <tr><td className="p-1">Subtotal</td><td className="p-1 text-right">{formatBDT(d.totals.subtotal, { decimals: true })}</td></tr>
              <tr><td className="p-1">Discount</td><td className="p-1 text-right">−{formatBDT(d.totals.discount, { decimals: true })}</td></tr>
              {d.totals.tax_amount !== undefined && <tr><td className="p-1">VAT{d.totals.tax_rate && toScaled(d.totals.tax_rate) > 0n ? ` ${d.totals.tax_rate}%` : ""}</td><td className="p-1 text-right">{toScaled(d.totals.tax_amount) > 0n ? formatBDT(d.totals.tax_amount, { decimals: true }) : "—"}</td></tr>}
              <tr className="border-t font-bold"><td className="p-1">TOTAL (৳)</td><td className="p-1 text-right">{formatBDT(d.totals.total, { decimals: true })}</td></tr>
              {d.totals.paid !== undefined && <tr><td className="p-1">Paid</td><td className="p-1 text-right">{formatBDT(d.totals.paid, { decimals: true })}</td></tr>}
              {d.totals.balance !== undefined && <tr className="font-bold"><td className="p-1">BALANCE DUE</td><td className="p-1 text-right">{formatBDT(d.totals.balance, { decimals: true })}</td></tr>}
            </tbody></table>}
          </section>
        )}
        <footer className="mt-16 flex items-end justify-between gap-6 border-t pt-3">
          <p className="w-40 border-t border-foreground pt-1 text-center">{d.signLeft}</p>
          <p className="w-40 border-t border-foreground pt-1 text-center">{d.signRight}</p>
          <p className="max-w-[60mm] text-right text-muted-foreground">{d.company.footer}</p>
        </footer>
      </article>
    </div>
  );
}
