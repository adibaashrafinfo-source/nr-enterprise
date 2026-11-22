import { Skeleton } from "@/components/ui/skeleton";

export function LoadingSkeleton({ rows = 5, variant = "rows" }: { rows?: number; variant?: "rows" | "cards" }) {
  if (variant === "cards") {
    return (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-80 rounded-2xl" />)}
      </div>
    );
  }
  return <div className="space-y-2" aria-busy="true">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>;
}
