import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/nre/Logo";
import { StatusPill, type PillStatus } from "@/components/nre/StatusPill";
import { SectionHeading } from "@/components/nre/SectionHeading";
import { ProductCard } from "@/components/nre/ProductCard";
import { MoneyText } from "@/components/nre/MoneyText";
import { EmptyState } from "@/components/nre/EmptyState";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { ConfirmDialog } from "@/components/nre/ConfirmDialog";
import { publicApi } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/_site/styleguide")({
  head: () => ({ meta: [{ title: "Styleguide — NR Enterprise" }, { name: "description", content: "NR Enterprise brand colours, type and components." }, { property: "og:title", content: "Styleguide — NR Enterprise" }, { property: "og:description", content: "NR Enterprise brand colours, type and components." }, { name: "robots", content: "noindex" }] }),
  component: Styleguide,
});

const SWATCHES = [
  ["Yellow", "bg-primary", "#F8C840"], ["Deep green", "bg-secondary", "#2F5D1A"], ["Green", "bg-leaf", "#6FA33F"],
  ["Ink", "bg-ink", "#201818"], ["Ink green", "bg-ink-green", "#14210F"], ["Cream", "bg-cream", "#FBF8EE"],
  ["Yellow soft", "bg-yellow-soft", "#FFF4CC"], ["Line", "bg-border", "#E8E2CF"], ["Danger", "bg-destructive", "#C0392B"], ["Warning", "bg-warning", "#B7791F"],
] as const;
const PILLS: PillStatus[] = ["ok", "low", "out", "draft", "due", "partial", "paid", "cancelled"];

function Styleguide() {
  const products = useQuery({ queryKey: ["public", "products", "styleguide"], queryFn: () => publicApi.products({ per_page: 48 }) });
  return (
    <div className="mx-auto max-w-7xl space-y-16 px-4 py-12">
      <SectionHeading eyebrow="Design system" title="NR Enterprise styleguide" description="Tokens and components used across the website and admin." />

      <section className="space-y-4">
        <h3 className="font-semibold">Colours</h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {SWATCHES.map(([n, c, hex]) => <div key={n}><div className={`h-20 rounded-2xl border ${c}`} /><p className="mt-2 text-sm font-medium">{n}</p><p className="text-xs text-muted-foreground">{hex}</p></div>)}
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">Typography — Poppins</h3>
        <p className="text-5xl font-bold tracking-tight">Heading 700</p>
        <p className="text-3xl font-semibold">Heading 600</p>
        <p className="text-xl font-medium">Subheading 500</p>
        <p className="max-w-2xl text-muted-foreground">Body 400 — Woven labels are the original label. বাংলা ফলব্যাক: হিন্দ শিলিগুড়ি।</p>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">Buttons & badges</h3>
        <div className="flex flex-wrap gap-3">
          <Button>Request a Quote</Button><Button variant="secondary">Secondary</Button><Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button><Button variant="link">Link</Button><Button size="sm">Small</Button><Button disabled>Disabled</Button>
          <ConfirmDialog trigger={<Button variant="destructive">Cancel invoice</Button>} title="Cancel this invoice?" description="Stock will be returned." destructive confirmLabel="Yes, cancel" onConfirm={() => { toast.success("Confirmed"); }} />
        </div>
        <div className="flex flex-wrap gap-2"><Badge>Badge</Badge><Badge variant="secondary">Secondary</Badge><Badge variant="outline">Outline</Badge></div>
        <div className="flex flex-wrap gap-2">{PILLS.map((p) => <StatusPill key={p} status={p} />)}</div>
        <p className="flex flex-wrap gap-6"><MoneyText value="184500.00" /><MoneyText value="25440.50" /><MoneyText value="-1200.00" /></p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="grid place-items-center rounded-2xl border bg-background p-10"><Logo className="h-16" /></div>
        <div className="nr-dotted grid place-items-center rounded-2xl bg-ink-green p-10"><Logo variant="mark" className="size-20" /></div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <Card><CardHeader><CardTitle>Card</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">16px radius, soft shadow.</CardContent></Card>
        <EmptyState title="Empty state" description="Shown when a list has no rows." />
        <div className="rounded-2xl border p-4"><LoadingSkeleton rows={4} /></div>
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">Product cards (mock GET /public/products — {products.data?.meta.total ?? "…"} products)</h3>
        {products.isLoading ? <LoadingSkeleton variant="cards" rows={3} /> : products.isError ? <EmptyState title="Couldn't load products" /> : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.data!.data.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </section>
    </div>
  );
}
