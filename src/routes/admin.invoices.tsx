import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/invoices")({
  head: () => noIndexPageHead("Invoices — NR Enterprise Admin", "Review NR Enterprise customer invoices, payments and balances."),
  component: () => (
    <>
      <PageHeader title="Invoices" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
