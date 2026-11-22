import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";

export const Route = createFileRoute("/admin/stock")({
  head: () => ({ meta: [{ title: "Stock — NR Admin" }] }),
  component: () => (
    <>
      <PageHeader title="Stock" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
