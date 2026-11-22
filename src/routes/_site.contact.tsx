import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/nre/StubPage";

export const Route = createFileRoute("/_site/contact")({
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
