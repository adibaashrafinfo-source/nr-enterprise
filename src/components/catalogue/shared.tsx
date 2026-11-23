import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";

export const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Current account context for catalogue screens; writes are manager/admin only. */
export function useCatalogueAccess() {
  const { user, role } = useAuth();
  const qc = useQueryClient();
  return {
    userId: user?.id ?? 0, role: role ?? "staff", ready: Boolean(user && role),
    canEdit: role === "admin" || role === "manager",
    invalidate: () => qc.invalidateQueries({ queryKey: ["admin", user?.id ?? 0] }).then(() => qc.invalidateQueries({ queryKey: ["public"] })),
  };
}

/** Shows an API error as a toast and returns its per-field messages. */
export function apiFieldErrors(e: unknown): Record<string, string> {
  if (e instanceof ApiError) { toast.error(e.message); return e.fields ?? {}; }
  toast.error("Something went wrong. Please try again.");
  return {};
}

export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string | undefined; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p id={`${id}-error`} className="text-xs font-medium text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

const TABS = [
  { to: "/admin/products", label: "Products", exact: true },
  { to: "/admin/products/categories", label: "Categories" },
  { to: "/admin/products/units", label: "Units" },
  { to: "/admin/products/import", label: "Import" },
] as const;

export function CatalogueNav({ canEdit }: { canEdit: boolean }) {
  return (
    <nav aria-label="Catalogue" className="mb-6 flex gap-1 overflow-x-auto rounded-full border bg-card p-1 text-sm">
      {TABS.filter((t) => canEdit || t.to !== "/admin/products/import").map((t) => (
        <Link key={t.to} to={t.to} activeOptions={{ exact: "exact" in t }} className="whitespace-nowrap rounded-full px-4 py-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
          activeProps={{ className: "bg-primary text-primary-foreground hover:text-primary-foreground" }}>{t.label}</Link>
      ))}
    </nav>
  );
}
