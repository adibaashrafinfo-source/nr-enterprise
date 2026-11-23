import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { FileText, MessageCircle, Paperclip, Phone } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type Column } from "@/components/nre/DataTable";
import { PageHeader } from "@/components/nre/PageHeader";
import { Field, apiFieldErrors, useCatalogueAccess } from "@/components/catalogue/shared";
import { adminApi } from "@/lib/api";
import { customersQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";
import type { Enquiry, EnquiryStatus } from "@/lib/types";

export const Route = createFileRoute("/admin/enquiries")({
  head: () => noIndexPageHead("Enquiries — NR Enterprise Admin", "Review and follow up on NR Enterprise quote and sample enquiries."),
  component: Enquiries,
});

export const ENQUIRY_STATUS: Record<EnquiryStatus, string> = { new: "New", contacted: "Contacted", quoted: "Quoted", won: "Won", lost: "Lost" };
const pill = (s: EnquiryStatus) => <Badge variant={s === "new" ? "default" : s === "lost" ? "destructive" : s === "won" ? "secondary" : "outline"}>{ENQUIRY_STATUS[s]}</Badge>;
const digits = (p: string) => p.replace(/[^\d]/g, "");
const PER = 25;

function Enquiries() {
  const { userId, role, ready, invalidate } = useCatalogueAccess();
  const [q, setQ] = useState(""); const [page, setPage] = useState(1); const [status, setStatus] = useState<EnquiryStatus | "">("");
  const [openId, setOpenId] = useState<number | null>(null);
  const list = useQuery({ queryKey: ["admin", userId, role, "enquiries", "list", { q, page, status }], queryFn: () => adminApi.enquiries({ page, per_page: PER, ...(q ? { q } : {}), ...(status ? { status } : {}) }), enabled: ready });
  const columns: Column<Enquiry>[] = [
    { key: "d", header: "Received", exportValue: (e) => e.created_at.slice(0, 10), cell: (e) => e.created_at.slice(0, 10) },
    { key: "n", header: "From", exportValue: (e) => `${e.name}${e.company ? ` (${e.company})` : ""}`, cell: (e) => <button type="button" className="text-left font-semibold hover:underline" onClick={() => setOpenId(e.id)}>{e.name}<span className="block text-xs font-normal text-muted-foreground">{e.company ?? ""}</span></button> },
    { key: "p", header: "Phone", exportValue: (e) => e.phone, cell: (e) => e.phone },
    { key: "pr", header: "Product / qty", exportValue: (e) => [e.product_name, e.quantity].filter(Boolean).join(" · "), cell: (e) => [e.product_name, e.quantity].filter(Boolean).join(" · ") || "—" },
    { key: "s", header: "Status", exportValue: (e) => ENQUIRY_STATUS[e.status], cell: (e) => pill(e.status) },
  ];
  const chip = (s: EnquiryStatus | "", label: string) => ({ id: s || "all", label, active: status === s, onSelect: () => { setStatus(s); setPage(1); } });
  return (
    <>
      <PageHeader title="Enquiries" description="Quote and sample requests from the website. Follow up, note what happened and turn good ones into quotations." />
      <DataTable columns={columns} rows={list.data?.data ?? []} rowKey={(e) => e.id} page={page} perPage={PER} total={list.data?.meta.total ?? 0} onPageChange={setPage}
        search={q} onSearchChange={(v) => { setQ(v); setPage(1); }} searchPlaceholder="Search name, company, phone, product…" loading={list.isLoading} error={list.error ? "Could not load enquiries." : null}
        emptyTitle="No enquiries" exportFileName="nr-enquiries"
        filters={[chip("", "All"), ...(Object.keys(ENQUIRY_STATUS) as EnquiryStatus[]).map((s) => chip(s, ENQUIRY_STATUS[s]))]} />
      <EnquiryDetail id={openId} onClose={() => setOpenId(null)} onChanged={invalidate} />
    </>
  );
}

function EnquiryDetail({ id, onClose, onChanged }: { id: number | null; onClose: () => void; onChanged: () => Promise<unknown> }) {
  const { userId, role, ready } = useCatalogueAccess();
  const navigate = useNavigate();
  const e = useQuery({ queryKey: ["admin", userId, role, "enquiries", "one", id], queryFn: () => adminApi.enquiry(id!), enabled: ready && id !== null });
  const customers = useQuery({ ...customersQuery(userId, role, { per_page: 100 }), enabled: ready && id !== null });
  const [note, setNote] = useState(""); const [customerId, setCustomerId] = useState(""); const [busy, setBusy] = useState(false);
  const d = e.data;
  useEffect(() => { setNote(d?.internal_note ?? ""); setCustomerId(""); }, [d?.id, d?.internal_note]);
  const save = async (patch: { status?: EnquiryStatus; internal_note?: string | null }) => {
    if (!d) return; setBusy(true);
    try { await adminApi.updateEnquiry(d.id, patch); toast.success("Enquiry updated."); await onChanged(); } catch (err) { apiFieldErrors(err); } finally { setBusy(false); }
  };
  const attachment = async () => {
    if (!d) return;
    try { const a = await adminApi.enquiryAttachment(d.id); if (a.url) window.open(a.url, "_blank", "noopener"); else toast.info(a.note ?? a.name); } catch (err) { apiFieldErrors(err); }
  };
  const convert = async () => {
    if (!d) return; setBusy(true);
    try { const r = await adminApi.convertEnquiry(d.id, customerId ? Number(customerId) : undefined); toast.success("Quotation created."); await onChanged(); void navigate({ to: "/admin/orders/$orderId", params: { orderId: String(r.order_id) } }); }
    catch (err) { apiFieldErrors(err); } finally { setBusy(false); }
  };
  return (
    <Sheet open={id !== null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {d ? <>
          <SheetHeader><SheetTitle>{d.name}{d.company ? ` · ${d.company}` : ""}</SheetTitle><SheetDescription>Received {d.created_at.slice(0, 10)} · {ENQUIRY_STATUS[d.status]}</SheetDescription></SheetHeader>
          <div className="mt-4 space-y-4 text-sm">
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline"><a href={`tel:${d.phone}`}><Phone className="size-4" /> Call</a></Button>
              <Button asChild size="sm" variant="outline"><a href={`https://wa.me/${digits(d.phone)}`} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" /> WhatsApp</a></Button>
              {d.attachment_name && <Button size="sm" variant="outline" onClick={() => void attachment()}><Paperclip className="size-4" /> {d.attachment_name}</Button>}
            </div>
            <dl className="grid grid-cols-[8rem_1fr] gap-y-1">
              {([["Phone", d.phone], ["Email", d.email], ["Product", d.product_name], ["Quantity", d.quantity], ["Needed by", d.required_date], ["Sample", d.wants_sample ? "Yes, wants a sample" : "No"]] as [string, string | null | undefined][]).map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{v || "—"}</dd></div>)}
            </dl>
            {d.message && <p className="whitespace-pre-line rounded-xl bg-muted p-3">{d.message}</p>}
            <Field id="enq-status" label="Status">
              <select id="enq-status" className="h-10 w-full rounded-md border bg-background px-3" value={d.status} disabled={busy} onChange={(ev) => void save({ status: ev.target.value as EnquiryStatus })}>
                {(Object.keys(ENQUIRY_STATUS) as EnquiryStatus[]).map((s) => <option key={s} value={s}>{ENQUIRY_STATUS[s]}</option>)}
              </select>
            </Field>
            <Field id="enq-note" label="Internal note" hint="Only your team sees this."><Textarea id="enq-note" value={note} onChange={(ev) => setNote(ev.target.value)} /></Field>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void save({ internal_note: note })}>Save note</Button>
            <div className="space-y-2 rounded-2xl border p-3">
              {d.converted_order_id ? (
                <Button className="w-full" onClick={() => void navigate({ to: "/admin/orders/$orderId", params: { orderId: String(d.converted_order_id) } })}><FileText className="size-4" /> Open quotation</Button>
              ) : <>
                <Field id="enq-customer" label="Customer for the quotation">
                  <select id="enq-customer" className="h-10 w-full rounded-md border bg-background px-3" value={customerId} onChange={(ev) => setCustomerId(ev.target.value)}>
                    <option value="">Create a new customer from this enquiry</option>
                    {(customers.data?.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                  </select>
                </Field>
                <Button className="w-full" disabled={busy} onClick={() => void convert()}><FileText className="size-4" /> Convert to quotation</Button>
              </>}
            </div>
          </div>
        </> : <p className="p-4 text-sm text-muted-foreground">Loading…</p>}
      </SheetContent>
    </Sheet>
  );
}
