import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/nre/Logo";
import spec from "@/data/spec.json";

const NAV = [
  { to: "/products", label: "Products" },
  { to: "/about", label: "About" },
  { to: "/capabilities", label: "Capabilities" },
  { to: "/sustainability", label: "Sustainability" },
  { to: "/clients", label: "Clients" },
  { to: "/contact", label: "Contact" },
] as const;

// Placeholder header/footer: the real ones (mega menu, WhatsApp, mobile bar) arrive in Phase 1.
export function PublicLayout({ children }: { children: ReactNode }) {
  const contact = spec.company.contact;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4">
          <Link to="/" aria-label="NR Enterprise home"><Logo /></Link>
          <nav className="hidden gap-6 text-sm font-medium lg:flex">
            {NAV.map((n) => <Link key={n.to} to={n.to} className="hover:text-secondary" activeProps={{ className: "text-secondary" }}>{n.label}</Link>)}
          </nav>
          <Button asChild size="sm"><Link to="/contact">Request a Quote</Link></Button>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="nr-dotted bg-ink-green text-on-dark">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:grid-cols-2">
          <div className="flex items-center gap-3"><Logo variant="mark" /><div><p className="font-semibold">NR Enterprise</p><p className="text-sm opacity-75">{spec.brand.tagline}</p></div></div>
          <div className="text-sm opacity-85 sm:text-right"><p>{contact.address}</p><p>{contact.phones.join(" · ")}</p><p>{contact.email}</p></div>
        </div>
      </footer>
    </div>
  );
}
