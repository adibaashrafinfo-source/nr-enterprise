import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/stock")({
  head: () => noIndexPageHead("Stock — NR Enterprise Admin", "Review NR Enterprise inventory balances, stock levels and movements."),
  component: () => (
    <>
      <PageHeader title="Stock" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
