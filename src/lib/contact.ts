export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;
export const waHref = (whatsapp: string | null | undefined, text?: string) =>
  whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}` : null;
