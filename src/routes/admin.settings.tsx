import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/settings")({
  head: () => noIndexPageHead("Settings and users — NR Enterprise Admin", "Manage NR Enterprise workspace settings, numbering and user access."),
  component: () => (
    <>
      <PageHeader title="Settings & users" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
