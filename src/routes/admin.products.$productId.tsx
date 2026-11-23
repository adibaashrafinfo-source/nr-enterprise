import { createFileRoute } from "@tanstack/react-router";
import { ProductEditor } from "@/components/catalogue/ProductEditor";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/products/$productId")({
  head: () => noIndexPageHead("Edit product — NR Enterprise Admin", "Edit product details, photos, specifications and variants."),
  component: EditProduct,
});

function EditProduct() {
  const { productId } = Route.useParams();
  return <ProductEditor key={productId} productId={Number(productId)} />;
}
