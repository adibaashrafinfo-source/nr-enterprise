import { describe, expect, it } from "vitest";
import {
  emptyEnquiry,
  enquiryFileError,
  enquiryFormData,
  enquirySchema,
  MAX_ENQUIRY_FILE_SIZE,
} from "@/lib/enquiry";

describe("public enquiry rules", () => {
  it("requires a name and valid phone number", () => {
    const result = enquirySchema.safeParse({ ...emptyEnquiry, name: "", phone: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.name).toContain("Please enter your name");
      expect(fields.phone).toContain("Enter a valid phone number");
    }
  });

  it("keeps the upload limit at exactly 5 MB", () => {
    expect(MAX_ENQUIRY_FILE_SIZE).toBe(5 * 1024 * 1024);
    expect(enquiryFileError({ size: MAX_ENQUIRY_FILE_SIZE, type: "application/pdf" })).toBeNull();
    expect(enquiryFileError({ size: MAX_ENQUIRY_FILE_SIZE + 1, type: "application/pdf" })).toBe("File must be 5 MB or smaller.");
  });

  it("accepts the allowed image and document types and rejects other files", () => {
    expect(enquiryFileError({ size: 1, type: "image/jpeg" })).toBeNull();
    expect(enquiryFileError({ size: 1, type: "image/png" })).toBeNull();
    expect(enquiryFileError({ size: 1, type: "image/webp" })).toBeNull();
    expect(enquiryFileError({ size: 1, type: "application/pdf" })).toBeNull();
    expect(enquiryFileError({ size: 1, type: "text/plain" })).toBe("Choose a JPG, PNG, WebP or PDF file.");
  });

  it("creates a multipart payload with the sample choice, honeypot, and attachment", () => {
    const attachment = new File(["proof"], "artwork.pdf", { type: "application/pdf" });
    const form = enquiryFormData({
      ...emptyEnquiry,
      name: "QA Visitor",
      phone: "+880 1712 345678",
      wants_sample: true,
    }, attachment);

    expect(form.get("name")).toBe("QA Visitor");
    expect(form.get("phone")).toBe("+880 1712 345678");
    expect(form.get("wants_sample")).toBe("1");
    expect(form.get("website")).toBe("");
    expect(form.get("file")).toBeInstanceOf(File);
    expect((form.get("file") as File).name).toBe("artwork.pdf");
  });
});