import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import spec from "@/data/spec.json";

export const Route = createFileRoute("/_site/")({
  head: () => ({
    meta: [
      { title: "NR Enterprise — All Kinds of Garments Accessories" },
      { name: "description", content: "Labels, tags, stickers, thread, elastic, twill tape, drawcords and buttons for garments, from Dhaka, Bangladesh." },
      { property: "og:title", content: "NR Enterprise — All Kinds of Garments Accessories" },
      { property: "og:description", content: "Garment trims and accessories supplier in Dhaka, Bangladesh." },
    ],
  }),
  component: Home,
});

// Placeholder home; the real sections are built in Phase 1.
function Home() {
  return (
    <section className="nr-dotted">
      <div className="mx-auto max-w-7xl px-4 py-24 animate-fade-up">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-secondary">{spec.brand.tagline}</p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">{spec.company.promise}</h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">{spec.company.motto}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild size="lg"><Link to="/contact">Request a Quote</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/products">View products</Link></Button>
        </div>
      </div>
    </section>
  );
}
