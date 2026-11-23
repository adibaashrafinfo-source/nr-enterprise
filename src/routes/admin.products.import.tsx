import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/nre/PageHeader";
import { apiFieldErrors, useCatalogueAccess } from "@/components/catalogue/shared";
import { adminApi } from "@/lib/api";
import { buildImport, guessMapping, IMPORT_FIELDS, type Mapping } from "@/lib/product-import";
import { adminCategoriesQuery, adminUnitsQuery } from "@/lib/queries";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/products/import")({
  head: () => noIndexPageHead("Import products — NR Enterprise Admin", "Import products and variants from an Excel or CSV file."),
  component: ImportProducts,
});

function ImportProducts() {
  const { userId, role, ready, canEdit, invalidate } = useCatalogueAccess();
  const navigate = useNavigate();
  const categories = useQuery({ ...adminCategoriesQuery(userId, role), enabled: ready });
  const units = useQuery({ ...adminUnitsQuery(userId, role), enabled: ready });
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [serverErrors, setServerErrors] = useState<{ row: number; message: string }[]>([]);
  const [busy, setBusy] = useState(false);

  const result = useMemo(() => buildImport(data, mapping, categories.data ?? [], units.data ?? [], canEdit), [data, mapping, categories.data, units.data, canEdit]);
  if (ready && !canEdit) return <Navigate to="/admin/products" />;

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const sheet = wb.Sheets[wb.SheetNames[0] ?? ""];
      if (!sheet) throw new Error("empty");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const hs = Object.keys(rows[0] ?? {});
      if (!rows.length) { toast.error("This file has no rows."); return; }
      setFileName(file.name); setHeaders(hs); setData(rows); setMapping(guessMapping(hs)); setServerErrors([]);
    } catch { toast.error("Could not read this file. Use .xlsx, .xls or .csv."); }
  };
  const submit = async () => {
    setBusy(true);
    try {
      const res = await adminApi.importProducts(result.rows);
      if (res.errors.length) { setServerErrors(res.errors); toast.error("Nothing was imported. Fix the rows listed below."); return; }
      toast.success(`${res.created} products imported.`); await invalidate(); void navigate({ to: "/admin/products" });
    } catch (e) { apiFieldErrors(e); } finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title="Import products" description="Upload an Excel or CSV file. Rows with the same product code become variants of one product." />
      <section className="space-y-6">
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed bg-card p-8 text-center shadow-soft hover:border-primary">
          <FileSpreadsheet className="size-8 text-secondary" />
          <span className="font-semibold">{fileName || "Choose a spreadsheet"}</span>
          <span className="text-sm text-muted-foreground">{fileName ? `${data.length} rows found — choose another file to replace` : ".xlsx, .xls or .csv"}</span>
          <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" aria-label="Spreadsheet file" onChange={(e) => void readFile(e.target.files?.[0])} />
        </label>

        {headers.length > 0 && <>
          <div className="rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="mb-4 font-semibold">Match your columns</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {IMPORT_FIELDS.filter((f) => canEdit || f.key !== "purchase_price").map((f) => (
                <label key={f.key} className="space-y-1 text-sm">
                  <span className="font-medium">{f.label}{"required" in f ? " *" : ""}</span>
                  <Select value={mapping[f.key] ?? "__none"} onValueChange={(v) => setMapping((m) => { const n = { ...m }; if (v === "__none") delete n[f.key]; else n[f.key] = v; return n; })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="__none">— Not in file —</SelectItem>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border bg-card shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <p className="text-sm"><strong>{result.rows.length}</strong> products ready · <span className={result.errorCount ? "font-semibold text-destructive" : ""}>{result.errorCount} rows with problems</span></p>
              <Button disabled={busy || result.errorCount > 0 || result.rows.length === 0} onClick={() => void submit()}><Upload className="size-4" /> {busy ? "Importing…" : "Import"}</Button>
            </div>
            {serverErrors.length > 0 && <ul className="space-y-1 border-b bg-destructive/5 p-4 text-sm text-destructive">{serverErrors.map((e) => <li key={e.row}>Product {e.row}: {e.message}</li>)}</ul>}
            <div className="max-h-[28rem] overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Variant</TableHead><TableHead>Problems</TableHead></TableRow></TableHeader>
                <TableBody>{result.preview.map((r) => (
                  <TableRow key={r.line} className={r.errors.length ? "bg-destructive/5" : ""}>
                    <TableCell>{r.line}</TableCell><TableCell className="font-mono text-xs">{r.code || "—"}</TableCell><TableCell>{r.name || "—"}</TableCell><TableCell>{r.variant || "—"}</TableCell>
                    <TableCell className="text-sm text-destructive">{r.errors.join(", ") || <span className="text-secondary">OK</span>}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          </div>
        </>}
      </section>
    </>
  );
}
