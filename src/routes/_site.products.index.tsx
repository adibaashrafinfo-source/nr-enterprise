import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/nre/StubPage";

export const Route = createFileRoute("/_site/products/")({
  head: () => ({
    meta: [
      { title: "Products — NR Enterprise" },
      { name: "description", content: "Labels, tags, stickers, thread, elastic, drawcords and buttons for garments." },
      { property: "og:title", content: "Products — NR Enterprise" },
      { property: "og:description", content: "Labels, tags, stickers, thread, elastic, drawcords and buttons for garments." },
    ],
  }),
  component: () => <StubPage title="Products" />,
});
