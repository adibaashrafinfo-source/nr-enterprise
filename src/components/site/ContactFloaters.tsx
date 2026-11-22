import { useQuery } from "@tanstack/react-query";
import { FileText, MessageCircle, Phone } from "lucide-react";
import { settingsQuery } from "@/lib/queries";
import { telHref, waHref } from "@/lib/contact";
import { useQuote } from "./QuoteDrawer";

export function ContactFloaters() {
  const { data: s } = useQuery(settingsQuery());
  const { openQuote } = useQuote();
  const wa = waHref(s?.whatsapp, "Hello NR Enterprise, I'd like a quote.");
  const phone = s?.phones[0];
  return (
    <>
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"
          className="fixed bottom-6 right-6 z-40 hidden size-14 place-items-center rounded-full bg-secondary text-secondary-foreground shadow-lift transition-transform hover:scale-105 md:grid">
          <MessageCircle className="size-6" />
        </a>
      )}
      <nav aria-label="Quick contact" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t bg-background md:hidden">
        {phone && <a href={telHref(phone)} className="flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium"><Phone className="size-5 text-secondary" />Call</a>}
        {wa && <a href={wa} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium"><MessageCircle className="size-5 text-secondary" />WhatsApp</a>}
        <button type="button" onClick={() => openQuote()} className="flex flex-col items-center gap-0.5 bg-primary py-2.5 text-xs font-semibold text-primary-foreground"><FileText className="size-5" />Quote</button>
      </nav>
    </>
  );
}
