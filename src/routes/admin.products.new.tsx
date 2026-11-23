import { createFileRoute, Navigate } from "@tanstack/react-router";
import { ProductEditor } from "@/components/catalogue/ProductEditor";
import { useCatalogueAccess } from "@/components/catalogue/shared";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/products/new")({
  head: () => noIndexPageHead("New product — NR Enterprise Admin", "Add a new product to the NR Enterprise catalogue."),
  component: NewProduct,
});

function NewProduct() {
  const { canEdit, ready } = useCatalogueAccess();
  if (ready && !canEdit) return <Navigate to="/admin/products" />;
  return <ProductEditor />;
}
