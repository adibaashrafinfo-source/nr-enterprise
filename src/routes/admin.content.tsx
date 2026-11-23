import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/content")({
  head: () => noIndexPageHead("Website content — NR Enterprise Admin", "Manage public-facing NR Enterprise client and website content."),
  component: () => (
    <>
      <PageHeader title="Website content" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
