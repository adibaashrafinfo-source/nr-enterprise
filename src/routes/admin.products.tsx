import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CatalogueNav, useCatalogueAccess } from "@/components/catalogue/shared";

export const Route = createFileRoute("/admin/products")({ component: CatalogueLayout });

function CatalogueLayout() {
  const { canEdit } = useCatalogueAccess();
  return (<><CatalogueNav canEdit={canEdit} /><Outlet /></>);
}
