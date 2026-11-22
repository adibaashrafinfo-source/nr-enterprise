import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";

export const Route = createFileRoute("/admin/content")({
  head: () => ({ meta: [{ title: "Website content — NR Admin" }] }),
  component: () => (
    <>
      <PageHeader title="Website content" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
