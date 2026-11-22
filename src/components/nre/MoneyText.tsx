import { formatBDT } from "@/lib/money";
import { cn } from "@/lib/utils";

export function MoneyText({ value, decimals, className }: { value: string | null | undefined; decimals?: boolean; className?: string }) {
  const negative = String(value ?? "").startsWith("-");
  return <span className={cn("tabular-nums", negative && "text-destructive", className)}>{formatBDT(value, decimals === undefined ? {} : { decimals })}</span>;
}
