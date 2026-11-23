import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/nre/PageHeader";
import { EmptyState } from "@/components/nre/EmptyState";
import { noIndexPageHead } from "@/lib/seo";

export const Route = createFileRoute("/admin/reports")({
  head: () => noIndexPageHead("Reports — NR Enterprise Admin", "Review stock, sales, dues and purchasing reports for NR Enterprise."),
  component: () => (
    <>
      <PageHeader title="Reports" />
      <EmptyState title="Coming soon" description="This screen is built in a later phase." />
    </>
  ),
});
