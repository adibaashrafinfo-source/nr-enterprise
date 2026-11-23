import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageBanner, ProcessStrip, Certifications, ContactCta } from "@/components/site/TrustSections";
import { SectionHeading } from "@/components/nre/SectionHeading";
import { productsQuery, certificationsQuery } from "@/lib/queries";
import { pageHead } from "@/lib/seo";
import { canPrefetch, SHOW_CAPACITY } from "@/config/flags";

export const Route = createFileRoute("/_site/capabilities")({
  loader: async ({ context }) => { if (canPrefetch()) await context.queryClient.ensureQueryData(certificationsQuery()); },
  head: () => pageHead("Capabilities — NR Enterprise", "Explore woven and printed labels, offset tags, digital printing, thermal and RFID identification, finishing and our brief-to-delivery process."),
  component: Capabilities,
});
const METHODS = [
  ["Woven labels", "woven-labels", "Brand detail woven into your garment labels."],
  ["Printed care labels", "printed-fabric-labels", "Care and product information on fabric substrates."],
  ["Screen printing", "screen-printed-labels", "Distinctive prints for garment branding."],
  ["Offset tags", "offset-printed-tags", "Printed tags with a range of custom finishes."],
  ["Digital printing", "digital-printed-tags", "Detailed artwork and flexible tag printing."],
  ["Thermal printing", "thermal-stickers", "Clear identification and product information."],
  ["RFID & variable data", "rfid-tags", "Tracking and identification for the supply chain."],
];
function Capabilities() {
  const { data: products } = useQuery(productsQuery({ per_page: 48 }));
  return <><PageBanner title="Capabilities" text="From artwork to the finishing touch, accessories made around your requirements." /><ProcessStrip detailed />
    <section className="mx-auto max-w-7xl px-4 py-16"><SectionHeading eyebrow="Printing & identification" title="The right method for every detail" /><div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{METHODS.map(([name, slug, text]) => {
      const p = products?.data.find((x) => x.slug === slug);
      return <article key={name} className="overflow-hidden rounded-2xl border bg-card">{p?.primary_image && <img src={p.primary_image} alt={name} loading="lazy" className="aspect-[4/3] w-full object-cover" />}<div className="p-6"><h3 className="text-lg font-semibold">{name}</h3><p className="mt-3 text-sm text-muted-foreground">{text}</p></div></article>;
    })}</div><div className="mt-12"><h2 className="text-xl font-semibold">Finishing options</h2><ul className="mt-5 flex flex-wrap gap-3">{["Die cutting", "Embossing", "Foil stamping", "Varnishing", "Stringing", "Eyelet", "Folding"].map((f) => <li key={f} className="rounded-full bg-accent px-4 py-2 text-sm">{f}</li>)}</ul></div></section>
    <section className="bg-cream py-14"><div className="mx-auto max-w-7xl px-4"><SectionHeading title="Quality & responsible supply" /><p className="mt-6 max-w-3xl leading-relaxed text-muted-foreground">Every order starts with your requirements. We review artwork, material, colour and finishing against the approved sample, and check product information before delivery. Discuss your brand's compliance requirements with our team when requesting a quote.</p></div></section>
    <Certifications />{SHOW_CAPACITY && <section className="mx-auto max-w-7xl px-4 py-14"><h2 className="text-2xl font-semibold">Production capacity</h2></section>}<ContactCta title="Let's bring your artwork to life" /></>;
}
