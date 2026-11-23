import { useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { adminSearchQuery } from "@/lib/queries";

export function AdminGlobalSearch({ userId }: { userId: number }) {
  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [value]);

  const search = useQuery({ ...adminSearchQuery(userId, debounced), enabled: debounced.length >= 2 });
  const products = search.data?.products.map((item) => ({ id: `p-${item.id}`, title: item.name, detail: item.code })) ?? [];
  const variants = search.data?.variants.map((item) => ({ id: `v-${item.id}`, title: item.display_name, detail: item.sku })) ?? [];
  const customers = search.data?.customers.map((item) => ({ id: `c-${item.id}`, title: item.name, detail: item.phone ?? "Customer" })) ?? [];
  const invoices = search.data?.invoices.map((item) => ({ id: `i-${item.id}`, title: item.invoice_no, detail: `${item.customer_name} · ${item.status}` })) ?? [];
  const groups = [
    { label: "Products", to: "/admin/products" as const, items: [...products, ...variants] },
    { label: "Customers", to: "/admin/customers" as const, items: customers },
    { label: "Invoices", to: "/admin/invoices" as const, items: invoices },
  ].filter((group) => group.items.length > 0);
  const hasResults = groups.some((group) => group.items.length > 0);

  return (
    <div className="relative w-full sm:max-w-[24rem]">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label="Search products, customers and invoices"
        aria-controls={panelId}
        aria-expanded={open && value.trim().length > 0}
        role="combobox"
        aria-autocomplete="list"
        value={value}
        onChange={(event) => { setValue(event.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}
        placeholder="Search products, customers, invoices"
        className="h-10 rounded-full bg-background pl-9"
      />
      {open && value.trim().length > 0 && (
        <div id={panelId} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl border bg-popover p-2 text-popover-foreground shadow-lift">
          {debounced.length < 2 ? <p className="px-3 py-4 text-sm text-muted-foreground">Enter at least two characters.</p>
            : search.isFetching ? <p className="px-3 py-4 text-sm text-muted-foreground">Searching…</p>
              : search.isError ? <p role="alert" className="px-3 py-4 text-sm text-destructive">Search is temporarily unavailable.</p>
                : !hasResults ? <p className="px-3 py-4 text-sm text-muted-foreground">No matching records.</p>
                  : groups.map((group) => (
                    <section key={group.label} className="py-1">
                      <h2 className="px-3 py-1 text-xs font-semibold uppercase text-muted-foreground">{group.label}</h2>
                      {group.items.map((item) => (
                        <Link key={item.id} to={group.to} role="option" aria-selected={false}
                          onClick={() => { setValue(""); setDebounced(""); setOpen(false); }}
                          className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-accent focus-visible:bg-accent">
                          <span className="min-w-0 truncate font-medium">{item.title}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{item.detail}</span>
                        </Link>
                      ))}
                    </section>
                  ))}
        </div>
      )}
    </div>
  );
}