import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Phone, Mail, MessageCircle, Facebook, Youtube } from "lucide-react";
import { PageBanner } from "@/components/site/TrustSections";
import { EnquiryForm } from "@/components/site/EnquiryForm";
import { Button } from "@/components/ui/button";
import { settingsQuery, productsQuery } from "@/lib/queries";
import { waHref, telHref } from "@/lib/contact";
import { pageHead } from "@/lib/seo";
interface ContactSearch { product?: string; sample?: number }
export const Route = createFileRoute("/_site/contact")({
  validateSearch: (s: Record<string, unknown>): ContactSearch => {
    const out: ContactSearch = {};
    if (typeof s["product"] === "string" && s["product"]) out.product = s["product"];
    if (Number(s["sample"]) === 1) out.sample = 1;
    return out;
  },
  head: () => pageHead("Contact & Request a Quote — NR Enterprise", "Request a quote or sample for labels, tags and trims. Contact NR Enterprise in Uttarkhan, Dhaka by phone, email or WhatsApp."),
  component: Contact,
});
function Contact() {
  const search = Route.useSearch();
  const { data: settings } = useQuery(settingsQuery());
  const { data: products, isLoading } = useQuery(productsQuery({ per_page: 48 }));
  const product = products?.data.find((p) => p.slug === search.product);
  const whatsapp = waHref(settings?.whatsapp);
  return <><PageBanner title="Contact & Request a Quote" text="Tell us about your next order. Our team is ready to help with artwork, samples and options." />
    <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 lg:grid-cols-[1fr_1.6fr]">
      <aside><h2 className="text-2xl font-semibold">Let's talk</h2><p className="mt-3 text-sm text-muted-foreground">NR Enterprise · All Kinds of Garments Accessories</p><div className="mt-8 space-y-7">
        {settings?.address && <div className="flex gap-4"><MapPin className="mt-1 size-5 shrink-0 text-secondary" /><div><h3 className="font-semibold">Visit us</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{settings.address}</p></div></div>}
        {!!settings?.phones.length && <div className="flex gap-4"><Phone className="mt-1 size-5 shrink-0 text-secondary" /><div><h3 className="font-semibold">Call us</h3>{settings.phones.map((p) => <a key={p} href={telHref(p)} className="mt-2 block text-sm hover:underline">{p}</a>)}</div></div>}
        {!!settings?.emails.length && <div className="flex gap-4"><Mail className="mt-1 size-5 shrink-0 text-secondary" /><div className="min-w-0"><h3 className="font-semibold">Email</h3>{settings.emails.map((e) => <a key={e} href={`mailto:${e}`} className="mt-2 block break-all text-sm hover:underline">{e}</a>)}</div></div>}
        {whatsapp && <Button asChild variant="outline"><a href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle />Chat on WhatsApp</a></Button>}
        <div className="flex gap-3">{settings?.facebook_url && <Button asChild variant="outline" size="icon"><a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" aria-label="Facebook"><Facebook /></a></Button>}{settings?.youtube_url && <Button asChild variant="outline" size="icon"><a href={settings.youtube_url} target="_blank" rel="noopener noreferrer" aria-label="YouTube"><Youtube /></a></Button>}</div>
      </div></aside>
      <div><h2 className="mb-6 text-2xl font-semibold">Request a quote</h2>{isLoading ? <p className="text-muted-foreground">Loading products…</p> : <EnquiryForm key={`${search.product ?? ""}-${search.sample ?? 0}`} product={product} sample={search.sample === 1} />}</div>
    </section>
    <section className="border-t bg-cream"><div className="mx-auto max-w-7xl px-4 py-12">{settings?.map_embed_url ? <iframe src={settings.map_embed_url} title="NR Enterprise location" loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-80 w-full rounded-2xl border" /> : <div className="flex min-h-56 flex-col items-center justify-center gap-3 rounded-2xl border bg-background p-8 text-center"><MapPin className="size-8 text-secondary" /><h2 className="text-xl font-semibold">Find us in Uttarkhan, Dhaka</h2><p className="max-w-lg text-sm text-muted-foreground">{settings?.address}</p><p className="text-sm text-muted-foreground">Call our team for directions.</p></div>}</div></section>
  </>;
}
