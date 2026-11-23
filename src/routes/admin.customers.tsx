import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/customers")({
  head: () => noIndexPageHead("Customers — NR Enterprise Admin", "Review customer records and balances in the NR Enterprise workspace."),
  component: () => (
    <>
      <PageHeader title="Customers" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
