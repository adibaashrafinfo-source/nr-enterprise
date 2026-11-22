import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";

export const Route = createFileRoute("/admin/purchases")({
  head: () => ({ meta: [{ title: "Purchases — NR Admin" }] }),
  component: () => (
    <>
      <PageHeader title="Purchases" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
