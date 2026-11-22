import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/nre/StubPage";

export const Route = createFileRoute("/_site/capabilities")({
  head: () => ({
    meta: [
      { title: "Capabilities — NR Enterprise" },
      { name: "description", content: "How NR Enterprise designs, produces and delivers garment trims." },
      { property: "og:title", content: "Capabilities — NR Enterprise" },
      { property: "og:description", content: "How NR Enterprise designs, produces and delivers garment trims." },
    ],
  }),
  component: () => <StubPage title="Capabilities" />,
});
