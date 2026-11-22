import { cn } from "@/lib/utils";

export function Logo({ variant = "full", className }: { variant?: "full" | "mark"; className?: string }) {
  return variant === "full"
    ? <img src="/assets/brand/nr-logo-full.png" alt="NR Enterprise" className={cn("h-10 w-auto", className)} />
    : <img src="/assets/brand/nr-logo-mark.png" alt="NR Enterprise" className={cn("h-10 w-10", className)} />;
}
