import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";

export const Route = createFileRoute("/admin/customers")({
  head: () => ({ meta: [{ title: "Customers — NR Admin" }] }),
  component: () => (
    <>
      <PageHeader title="Customers" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
