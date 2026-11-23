import { z } from "zod";
import { publicApi } from "./api";

export const MAX_ENQUIRY_FILE_SIZE = 5 * 1024 * 1024;
export const ENQUIRY_FILE_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
export function enquiryFileError(file: { size: number; type: string } | null): string | null {
  if (!file) return null;
  if (file.size > MAX_ENQUIRY_FILE_SIZE) return "File must be 5 MB or smaller.";
  if (!ENQUIRY_FILE_TYPES.includes(file.type)) return "Choose a JPG, PNG, WebP or PDF file.";
  return null;
}
export const enquirySchema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(100),
  company: z.string().trim().max(150),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{6,19}$/, "Enter a valid phone number"),
  email: z.string().trim().email("Enter a valid email").max(150).or(z.literal("")),
  category_id: z.string().regex(/^\d*$/, "Choose a category"),
  product_id: z.string().regex(/^\d*$/, "Choose a product"),
  quantity: z.string().trim().max(50),
  required_date: z.string().refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v), "Enter a valid date"),
  message: z.string().trim().max(2000),
  wants_sample: z.boolean(),
  website: z.string(),
});
export type EnquiryValues = z.infer<typeof enquirySchema>;
export const emptyEnquiry: EnquiryValues = { name: "", company: "", phone: "", email: "", category_id: "", product_id: "", quantity: "", required_date: "", message: "", wants_sample: false, website: "" };
export function enquiryFormData(values: EnquiryValues, file: File | null = null) {
  const parsed = enquirySchema.parse(values);
  const error = enquiryFileError(file);
  if (error) throw new Error(error);
  const form = new FormData();
  for (const [key, value] of Object.entries(parsed)) form.append(key, typeof value === "boolean" ? (value ? "1" : "0") : value);
  if (file) form.append("file", file);
  return form;
}
export const submitEnquiry = (values: EnquiryValues, file: File | null = null) => publicApi.submitEnquiry(enquiryFormData(values, file));
