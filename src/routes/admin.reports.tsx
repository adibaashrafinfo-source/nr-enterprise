import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";

export const Route = createFileRoute("/admin/reports")({
  head: () => ({ meta: [{ title: "Reports — NR Admin" }] }),
  component: () => (
    <>
      <PageHeader title="Reports" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
