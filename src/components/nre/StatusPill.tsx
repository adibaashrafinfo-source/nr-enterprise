import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

export type PillStatus = "ok" | "low" | "out" | "draft" | "due" | "partial" | "paid" | "cancelled";

const pill = cva("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold before:size-1.5 before:rounded-full before:bg-current", {
  variants: {
    status: {
      ok: "bg-secondary/10 text-secondary",
      paid: "bg-secondary/10 text-secondary",
      low: "bg-yellow-soft text-warning",
      partial: "bg-yellow-soft text-warning",
      due: "bg-primary/25 text-ink",
      out: "bg-destructive/10 text-destructive",
      cancelled: "bg-destructive/10 text-destructive",
      draft: "bg-muted text-muted-foreground border",
    },
  },
});

const LABEL: Record<PillStatus, string> = { ok: "In stock", low: "Low stock", out: "Out of stock", draft: "Draft", due: "Due", partial: "Partial", paid: "Paid", cancelled: "Cancelled" };

export function StatusPill({ status, label, className }: { status: PillStatus; label?: string; className?: string }) {
  return <span className={cn(pill({ status }), className)}>{label ?? LABEL[status]}</span>;
}
