import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/nre/StubPage";

export const Route = createFileRoute("/_site/products/$categorySlug/$productSlug")({
  head: () => ({ meta: [{ title: "Product — NR Enterprise" }, { name: "description", content: "Garment trim product details and quote request." }, { property: "og:title", content: "Product — NR Enterprise" }, { property: "og:description", content: "Garment trim product details and quote request." }] }),
  component: Product,
});

function Product() {
  const { productSlug } = Route.useParams();
  return <StubPage title={`Product: ${productSlug}`} />;
}
