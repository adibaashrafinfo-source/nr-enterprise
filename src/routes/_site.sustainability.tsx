import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/nre/StubPage";

export const Route = createFileRoute("/_site/sustainability")({
  head: () => ({
    meta: [
      { title: "Sustainability — NR Enterprise" },
      { name: "description", content: "Reduce, reuse, recycle and recover across our trims and accessories." },
      { property: "og:title", content: "Sustainability — NR Enterprise" },
      { property: "og:description", content: "Reduce, reuse, recycle and recover across our trims and accessories." },
    ],
  }),
  component: () => <StubPage title="Sustainability" />,
});
