import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/enquiries")({
  head: () => noIndexPageHead("Enquiries — NR Enterprise Admin", "Review and follow up on NR Enterprise quote and sample enquiries."),
  component: () => (
    <>
      <PageHeader title="Enquiries" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
