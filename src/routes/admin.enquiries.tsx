import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";

export const Route = createFileRoute("/admin/enquiries")({
  head: () => ({ meta: [{ title: "Enquiries — NR Admin" }] }),
  component: () => (
    <>
      <PageHeader title="Enquiries" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
