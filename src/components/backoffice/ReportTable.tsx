import { useState } from "react";
import { DataTable, type Column } from "@/components/nre/DataTable";

/** All report rows are loaded at once; this pages them locally and exports every row. */
export function ReportTable<T>({ columns, rows, rowKey, loading, error, fileName, footer }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string | number; loading: boolean; error: unknown; fileName: string; footer?: React.ReactNode }) {
  const [page, setPage] = useState(1);
  const per = 50;
  return (
    <>
      <DataTable columns={columns} rows={rows.slice((page - 1) * per, page * per)} exportRows={rows} rowKey={rowKey} page={page} perPage={per} total={rows.length} onPageChange={setPage}
        loading={loading} error={error ? "Could not load this report." : null} emptyTitle="No data for this period" exportFileName={fileName} />
      {footer}
    </>
  );
}
