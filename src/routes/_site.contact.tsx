import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/nre/StubPage";

interface ContactSearch { product?: string; sample?: number }

export const Route = createFileRoute("/_site/contact")({
  validateSearch: (s: Record<string, unknown>): ContactSearch => {
    const out: ContactSearch = {};
    if (typeof s["product"] === "string" && s["product"]) out.product = s["product"];
    if (Number(s["sample"]) === 1) out.sample = 1;
    return out;
  },
  head: () => ({
    meta: [
      { title: "Contact & Request a Quote — NR Enterprise" },
      { name: "description", content: "Request a quote for labels, tags and trims. Call or WhatsApp NR Enterprise." },
      { property: "og:title", content: "Contact & Request a Quote — NR Enterprise" },
      { property: "og:description", content: "Request a quote for labels, tags and trims. Call or WhatsApp NR Enterprise." },
    ],
  }),
  component: () => <StubPage title="Contact & Request a Quote" />,
});
