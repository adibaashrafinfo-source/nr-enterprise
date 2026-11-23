import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/suppliers")({
  head: () => noIndexPageHead("Suppliers — NR Enterprise Admin", "Review supplier contacts and account balances in the NR Enterprise workspace."),
  component: () => (
    <>
      <PageHeader title="Suppliers" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
