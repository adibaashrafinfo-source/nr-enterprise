import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/nre/StubPage";

export const Route = createFileRoute("/_site/about")({
  head: () => ({
    meta: [
      { title: "About NR Enterprise" },
      { name: "description", content: "Who we are: garments trims and accessories from Dhaka, Bangladesh." },
      { property: "og:title", content: "About NR Enterprise" },
      { property: "og:description", content: "Who we are: garments trims and accessories from Dhaka, Bangladesh." },
    ],
  }),
  component: () => <StubPage title="About" />,
});
