import { createContext, useContext, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import type { PublicProductSummary } from "@/lib/types";

export const quoteSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  company: z.string().trim().max(150).optional(),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{6,19}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").max(150).optional().or(z.literal("")),
  quantity: z.string().trim().max(50).optional(),
  message: z.string().trim().max(2000).optional(),
  wants_sample: z.boolean().optional(),
});
type QuoteValues = z.infer<typeof quoteSchema>;

const Ctx = createContext<{ openQuote: (p?: PublicProductSummary) => void } | null>(null);
export const useQuote = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useQuote must be used inside QuoteProvider");
  return c;
};

export function QuoteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState<PublicProductSummary | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset, setValue, watch } =
    useForm<QuoteValues>({ resolver: zodResolver(quoteSchema), defaultValues: { name: "", phone: "", wants_sample: false } });

  const openQuote = (p?: PublicProductSummary) => { setProduct(p ?? null); setOpen(true); };

  // Submit is wired to POST /public/enquiries in Phase 2.
  const onSubmit = async () => {
    toast.success("Thanks! We'll contact you shortly.", product ? { description: `Quote request for ${product.name}` } : {});
    reset(); setOpen(false);
  };

  return (
    <Ctx.Provider value={{ openQuote }}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Request a Quote</SheetTitle>
            <SheetDescription>{product ? <>For <b className="text-foreground">{product.name}</b> ({product.code})</> : "Tell us what you need and we'll reply quickly."}</SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4 px-1" noValidate>
            <Field id="q-name" label="Name *" error={errors.name?.message}><Input id="q-name" {...register("name")} /></Field>
            <Field id="q-company" label="Company"><Input id="q-company" {...register("company")} /></Field>
            <Field id="q-phone" label="Phone *" error={errors.phone?.message}><Input id="q-phone" type="tel" {...register("phone")} /></Field>
            <Field id="q-email" label="Email" error={errors.email?.message}><Input id="q-email" type="email" {...register("email")} /></Field>
            <Field id="q-qty" label={`Quantity${product ? ` (${product.unit_code})` : ""}`}><Input id="q-qty" {...register("quantity")} /></Field>
            <Field id="q-msg" label="Message"><Textarea id="q-msg" rows={3} {...register("message")} /></Field>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={!!watch("wants_sample")} onCheckedChange={(v) => setValue("wants_sample", v === true)} /> I need a sample first
            </label>
            <Button type="submit" className="w-full" disabled={isSubmitting}>Send request</Button>
          </form>
        </SheetContent>
      </Sheet>
    </Ctx.Provider>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string | undefined; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
