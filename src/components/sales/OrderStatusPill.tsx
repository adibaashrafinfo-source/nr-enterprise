import { Badge } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/types";

export const ORDER_STATUS: Record<OrderStatus, string> = { quotation: "Quotation", confirmed: "Confirmed", delivered: "Delivered", invoiced: "Invoiced", cancelled: "Cancelled" };
export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return <Badge variant={status === "cancelled" ? "destructive" : status === "invoiced" ? "secondary" : status === "quotation" ? "outline" : "default"}>{ORDER_STATUS[status]}</Badge>;
}
