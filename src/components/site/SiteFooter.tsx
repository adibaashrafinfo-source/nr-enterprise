import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Facebook, Mail, MapPin, Phone, Youtube } from "lucide-react";
import { Logo } from "@/components/nre/Logo";
import { categoriesQuery, productsQuery, settingsQuery } from "@/lib/queries";
import { telHref } from "@/lib/contact";

export function SiteFooter() {
  const { data: s } = useQuery(settingsQuery());
  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: all } = useQuery(productsQuery({ per_page: 48 }));

  return (
    <footer className="relative overflow-hidden bg-ink-green text-on-dark">
      <div className="nr-dotted pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 pt-14 pb-10 md:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3"><Logo variant="mark" className="size-12" /><div><p className="text-lg font-semibold">NR Enterprise</p><p className="text-sm opacity-75">{s?.tagline}</p></div></div>
          <ul className="mt-6 space-y-2 text-sm opacity-85">
            {s?.address && <li className="flex gap-2"><MapPin className="mt-0.5 size-4 shrink-0" />{s.address}</li>}
            {s?.phones.map((p) => <li key={p}><a href={telHref(p)} className="flex gap-2 hover:underline"><Phone className="mt-0.5 size-4 shrink-0" />{p}</a></li>)}
            {s?.emails.map((e) => <li key={e}><a href={`mailto:${e}`} className="flex gap-2 hover:underline"><Mail className="mt-0.5 size-4 shrink-0" />{e}</a></li>)}
          </ul>
          {(s?.facebook_url || s?.youtube_url) && (
            <div className="mt-4 flex gap-3">
              {s.facebook_url && <a href={s.facebook_url} aria-label="Facebook" target="_blank" rel="noreferrer"><Facebook className="size-5" /></a>}
              {s.youtube_url && <a href={s.youtube_url} aria-label="YouTube" target="_blank" rel="noreferrer"><Youtube className="size-5" /></a>}
            </div>
          )}
        </div>
        {categories.map((c) => (
          <div key={c.slug}>
            <Link to="/products/$categorySlug" params={{ categorySlug: c.slug }} className="font-semibold text-primary hover:underline">{c.name}</Link>
            <ul className="mt-3 space-y-1.5 text-sm opacity-80">
              {all?.data.filter((p) => p.category.slug === c.slug).map((p) => (
                <li key={p.slug}><Link to="/products/$categorySlug/$productSlug" params={{ categorySlug: c.slug, productSlug: p.slug }} className="hover:underline">{p.name}</Link></li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <p className="font-semibold text-primary">Company</p>
          <ul className="mt-3 space-y-1.5 text-sm opacity-80">
            <li><Link to="/about" className="hover:underline">About</Link></li>
            <li><Link to="/capabilities" className="hover:underline">Capabilities</Link></li>
            <li><Link to="/sustainability" className="hover:underline">Sustainability</Link></li>
            <li><Link to="/clients" className="hover:underline">Clients</Link></li>
            <li><Link to="/contact" className="hover:underline">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-on-dark/15">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 pt-5 pb-24 text-xs opacity-70 md:pb-5">
          <p>© {new Date().getFullYear()} NR Enterprise. All rights reserved.</p>
          <Link to="/admin/login" className="hover:underline">Admin login</Link>
        </div>
      </div>
    </footer>
  );
}
