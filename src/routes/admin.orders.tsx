import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Sales orders — NR Admin" }] }),
  component: () => (
    <>
      <PageHeader title="Sales orders" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
