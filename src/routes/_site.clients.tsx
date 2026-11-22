import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/nre/StubPage";

export const Route = createFileRoute("/_site/clients")({
  head: () => ({
    meta: [
      { title: "Clients — NR Enterprise" },
      { name: "description", content: "Brands that trust NR Enterprise for their garment accessories." },
      { property: "og:title", content: "Clients — NR Enterprise" },
      { property: "og:description", content: "Brands that trust NR Enterprise for their garment accessories." },
    ],
  }),
  component: () => <StubPage title="Clients" />,
});
