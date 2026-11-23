import { Badge } from "@/components/ui/badge";
import type { PurchaseStatus } from "@/lib/types";

export const PURCHASE_STATUS: Record<PurchaseStatus, string> = { draft: "Draft", ordered: "Ordered", partial: "Partial", received: "Received", cancelled: "Cancelled" };
export function PurchaseStatusPill({ status }: { status: PurchaseStatus }) {
  return <Badge variant={status === "cancelled" ? "destructive" : status === "received" ? "secondary" : status === "draft" ? "outline" : "default"}>{PURCHASE_STATUS[status]}</Badge>;
}
/** Encodes reorder lines into the New PO search param: "variantId:qty:rate,…". */
export const encodeLines = (lines: { variant_id: number; qty: string; rate: string | null }[]) => lines.map((l) => `${l.variant_id}:${l.qty}:${l.rate ?? ""}`).join(",");
export const decodeLines = (raw: string | undefined) => (raw ? raw.split(",").map((part) => { const [v, q, r] = part.split(":"); return { variant_id: Number(v), qty: q ?? "", rate: r ?? "" }; }).filter((l) => l.variant_id > 0) : []);
