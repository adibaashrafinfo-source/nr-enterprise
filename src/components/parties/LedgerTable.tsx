import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { formatBDT } from "@/lib/money";
import type { LedgerRow } from "@/lib/types";

const LABEL: Record<LedgerRow["type"], string> = { opening: "Opening balance", invoice: "Invoice", payment: "Payment", purchase: "Purchase received", supplier_payment: "Payment made" };

/** Ledger with running balance, a date range and a Print button (print hides the admin frame). */
export function LedgerTable({ title, rows, loading, debitLabel, creditLabel, range, onRangeChange }: {
  title: string; rows: LedgerRow[] | undefined; loading: boolean; debitLabel: string; creditLabel: string;
  range: { from: string; to: string }; onRangeChange: (r: { from: string; to: string }) => void;
}) {
  const final = rows?.at(-1)?.running_balance;
  return (
    <div className="space-y-4">
      <div data-print-hide className="flex flex-wrap items-center gap-2">
        <Input type="date" aria-label="From date" value={range.from} onChange={(e) => onRangeChange({ ...range, from: e.target.value })} className="w-auto rounded-full" />
        <Input type="date" aria-label="To date" value={range.to} onChange={(e) => onRangeChange({ ...range, to: e.target.value })} className="w-auto rounded-full" />
        <Button variant="outline" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
      </div>
      <h2 className="hidden text-lg font-bold print:block">{title}</h2>
      {loading ? <LoadingSkeleton rows={4} /> : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Document</TableHead><TableHead className="text-right">{debitLabel}</TableHead><TableHead className="text-right">{creditLabel}</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
            <TableBody>
              {(rows ?? []).map((r, i) => (
                <TableRow key={i}>
                  <TableCell>{r.date || "—"}</TableCell><TableCell>{LABEL[r.type]}</TableCell><TableCell className="font-mono text-xs">{r.doc_no ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.type === "opening" ? "" : formatBDT(r.debit)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.type === "opening" ? "" : formatBDT(r.credit)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{formatBDT(r.running_balance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {final !== undefined && <p className="text-right text-sm">Closing balance: <span className="font-bold" data-testid="ledger-closing">{formatBDT(final)}</span></p>}
    </div>
  );
}
