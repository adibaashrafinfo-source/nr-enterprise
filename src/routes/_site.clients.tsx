import { createFileRoute } from "@tanstack/react-router";
import { PageBanner, ClientLogos, ContactCta } from "@/components/site/TrustSections";
import { clientsQuery } from "@/lib/queries";
import { canPrefetch } from "@/config/flags";
import { pageHead } from "@/lib/seo";
export const Route = createFileRoute("/_site/clients")({
  loader: async ({ context }) => { if (canPrefetch()) await context.queryClient.ensureQueryData(clientsQuery()); },
  head: () => pageHead("Our Clients — NR Enterprise", "Discover the brands that trust NR Enterprise for garment labels, tags, stickers and trims."),
  component: () => <><PageBanner title="Our Clients" text="Trusted by leading brands for the details that matter." /><section className="mx-auto max-w-7xl px-4 py-16"><ClientLogos /></section><ContactCta title="Become our next client" /></>,
});
