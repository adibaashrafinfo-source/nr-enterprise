import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/nre/StubPage";

export const Route = createFileRoute("/_site/products/$categorySlug/")({
  head: () => ({ meta: [{ title: "Product category — NR Enterprise" }, { name: "description", content: "Browse garment trims and accessories by category." }, { property: "og:title", content: "Product category — NR Enterprise" }, { property: "og:description", content: "Browse garment trims and accessories by category." }] }),
  component: Category,
});

function Category() {
  const { categorySlug } = Route.useParams();
  return <StubPage title={`Category: ${categorySlug}`} />;
}
