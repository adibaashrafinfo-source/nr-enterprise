import { createContext, useContext, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EnquiryForm } from "./EnquiryForm";
import type { PublicProductSummary } from "@/lib/types";

const Ctx = createContext<{ openQuote: (p?: PublicProductSummary) => void } | null>(null);
export const useQuote = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useQuote must be used inside QuoteProvider");
  return c;
};
export function QuoteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<PublicProductSummary | undefined>();
  const [instance, setInstance] = useState(0);
  const openQuote = (p?: PublicProductSummary) => { setProduct(p); setInstance((n) => n + 1); setOpen(true); };
  return <Ctx.Provider value={{ openQuote }}>{children}
    <Sheet open={open} onOpenChange={setOpen}><SheetContent className="w-full overflow-y-auto sm:max-w-xl">
      <SheetHeader><SheetTitle>Request a Quote</SheetTitle><SheetDescription>{product ? `For ${product.name} (${product.code})` : "Tell us what you need and our team will get in touch."}</SheetDescription></SheetHeader>
      <div className="mt-6 px-1 pb-8"><EnquiryForm key={instance} product={product} /></div>
    </SheetContent></Sheet>
  </Ctx.Provider>;
}
