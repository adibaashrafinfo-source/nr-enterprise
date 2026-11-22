import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";

export const Route = createFileRoute("/admin/settings")({
  head: () => ({ meta: [{ title: "Settings & users — NR Admin" }] }),
  component: () => (
    <>
      <PageHeader title="Settings & users" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
