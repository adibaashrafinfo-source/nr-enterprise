import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/purchases")({
  head: () => noIndexPageHead("Purchases — NR Enterprise Admin", "Review supplier purchase orders and pending goods receipts."),
  component: () => (
    <>
      <PageHeader title="Purchases" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
