import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/products")({
  head: () => noIndexPageHead("Products — NR Enterprise Admin", "Manage the NR Enterprise product catalogue, variants and website visibility."),
  component: () => (
    <>
      <PageHeader title="Products" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
