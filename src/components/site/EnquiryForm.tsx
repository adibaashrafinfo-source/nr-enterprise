import { useId, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MessageCircle, Send, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { categoriesQuery, productsQuery, settingsQuery } from "@/lib/queries";
import { emptyEnquiry, enquiryFileError, enquirySchema, submitEnquiry, type EnquiryValues } from "@/lib/enquiry";
import { ApiError } from "@/lib/api-error";
import { waHref } from "@/lib/contact";
import type { PublicProductSummary } from "@/lib/types";

export function EnquiryForm({ compact = false, product, sample = false }: { compact?: boolean; product?: PublicProductSummary | undefined; sample?: boolean }) {
  const id = useId();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<number | null>(null);
  const { data: categories = [] } = useQuery(categoriesQuery());
  const { data: products } = useQuery(productsQuery({ per_page: 48 }));
  const { data: settings } = useQuery(settingsQuery());
  const { register, handleSubmit, watch, setValue, setError, reset, formState: { errors, isSubmitting } } = useForm<EnquiryValues>({
    resolver: zodResolver(enquirySchema), defaultValues: { ...emptyEnquiry, product_id: product ? String(product.id) : "", category_id: product ? String(product.category.id) : "", wants_sample: sample },
  });
  const categoryId = watch("category_id");
  const selectedProducts = products?.data.filter((p) => !categoryId || String(p.category.id) === categoryId) ?? [];
  const onSubmit = async (values: EnquiryValues) => {
    const error = enquiryFileError(file);
    setFileError(error);
    if (error) return;
    try {
      const result = await submitEnquiry(values, file);
      setRequestId(result.id);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.fields) {
        for (const [key, message] of Object.entries(e.fields)) {
          if (key === "file") setFileError(message);
          else if (key in emptyEnquiry) setError(key as keyof EnquiryValues, { message });
        }
      }
      setError("root", { message: e instanceof Error ? e.message : "Could not send your request. Please try again." });
    }
  };
  const field = (name: keyof EnquiryValues, label: string, type = "text") => <div className="space-y-1.5">
    <Label htmlFor={`${id}-${name}`}>{label}</Label>
    <Input id={`${id}-${name}`} type={type} {...register(name)} aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${id}-${name}-error` : undefined} />
    {errors[name] && <p id={`${id}-${name}-error`} className="text-xs text-destructive">{errors[name]?.message}</p>}
  </div>;
  if (requestId !== null) {
    const whatsapp = waHref(settings?.whatsapp, `Hello NR Enterprise, following up on quote request #${requestId}.`);
    return <div role="status" className="space-y-5 py-8 text-center">
      <CheckCircle2 className="mx-auto size-12 text-secondary" />
      <h3 className="text-2xl font-semibold">Thank you for your enquiry!</h3>
      <p className="text-sm text-muted-foreground">Your request #{requestId} has been received. Our team will contact you shortly with options, samples and a quote.</p>
      <div className="flex flex-wrap justify-center gap-3">
        {whatsapp && <Button asChild><a href={whatsapp} target="_blank" rel="noopener noreferrer"><MessageCircle />Follow up on WhatsApp</a></Button>}
        <Button variant="outline" onClick={() => { reset(); setFile(null); setFileError(null); setRequestId(null); }}>Send another enquiry</Button>
      </div>
    </div>;
  }
  return <form onSubmit={handleSubmit(onSubmit)} className="grid gap-5 sm:grid-cols-2" noValidate encType="multipart/form-data">
    {field("name", "Name *")}
    {field("phone", "Phone *", "tel")}
    {!compact && field("company", "Company")}
    {!compact && field("email", "Email", "email")}
    {!compact && <div className="space-y-1.5"><Label htmlFor={`${id}-category`}>Category</Label>
      <Select value={categoryId || "all"} onValueChange={(v) => { setValue("category_id", v === "all" ? "" : v); setValue("product_id", ""); }}>
        <SelectTrigger id={`${id}-category`}><SelectValue placeholder="Choose a category" /></SelectTrigger>
        <SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
      </Select>{errors.category_id && <p className="text-xs text-destructive">{errors.category_id.message}</p>}
    </div>}
    <div className="space-y-1.5"><Label htmlFor={`${id}-product`}>Product</Label>
      <Select value={watch("product_id") || "none"} onValueChange={(v) => setValue("product_id", v === "none" ? "" : v)}>
        <SelectTrigger id={`${id}-product`} className="w-full"><SelectValue placeholder="Choose a product" /></SelectTrigger>
        <SelectContent><SelectItem value="none">Choose a product</SelectItem>{selectedProducts.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
      </Select>{errors.product_id && <p className="text-xs text-destructive">{errors.product_id.message}</p>}
    </div>
    {field("quantity", "Quantity")}
    {!compact && field("required_date", "Required date", "date")}
    {!compact && <div className="space-y-1.5 sm:col-span-2"><Label htmlFor={`${id}-message`}>Message</Label><Textarea id={`${id}-message`} rows={4} {...register("message")} aria-invalid={!!errors.message} />{errors.message && <p className="text-xs text-destructive">{errors.message.message}</p>}</div>}
    {!compact && <div className="space-y-2 sm:col-span-2"><Label htmlFor={`${id}-file`} className="flex items-center gap-2"><Upload className="size-4" />Artwork or reference file</Label><Input id={`${id}-file`} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => { const next = e.target.files?.[0] ?? null; setFile(next); setFileError(enquiryFileError(next)); }} aria-describedby={`${id}-file-help`} /><p id={`${id}-file-help`} className="text-xs text-muted-foreground">JPG, PNG, WebP or PDF · up to 5 MB</p>{fileError && <p role="alert" className="text-xs text-destructive">{fileError}</p>}</div>}
    {!compact && <div className="flex items-center gap-2 sm:col-span-2"><Checkbox id={`${id}-sample`} checked={watch("wants_sample")} onCheckedChange={(v) => setValue("wants_sample", v === true)} /><Label htmlFor={`${id}-sample`}>I need a sample first</Label></div>}
    <div hidden aria-hidden="true"><label htmlFor={`${id}-website`}>Website</label><input id={`${id}-website`} tabIndex={-1} autoComplete="off" {...register("website")} /></div>
    {errors.root && <p role="alert" className="text-sm text-destructive sm:col-span-2">{errors.root.message}</p>}
    <Button type="submit" disabled={isSubmitting || !!fileError} className="sm:col-span-2">{isSubmitting ? <Loader2 className="animate-spin" /> : <Send />} {isSubmitting ? "Sending…" : "Send quote request"}</Button>
  </form>;
}
