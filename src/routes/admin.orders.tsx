import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/orders")({
  head: () => noIndexPageHead("Sales orders — NR Enterprise Admin", "Review customer quotations and sales orders in the NR Enterprise workspace."),
  component: () => (
    <>
      <PageHeader title="Sales orders" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
