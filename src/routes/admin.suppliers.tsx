import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";

export const Route = createFileRoute("/admin/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — NR Admin" }] }),
  component: () => (
    <>
      <PageHeader title="Suppliers" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
