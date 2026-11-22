import type { ReactNode } from "react";
import { QuoteProvider } from "@/components/site/QuoteDrawer";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { ContactFloaters } from "@/components/site/ContactFloaters";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <QuoteProvider>
      <div className="flex min-h-screen flex-col">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2">Skip to content</a>
        <SiteHeader />
        <main id="main" className="flex-1">{children}</main>
        <SiteFooter />
        <ContactFloaters />
      </div>
    </QuoteProvider>
  );
}
