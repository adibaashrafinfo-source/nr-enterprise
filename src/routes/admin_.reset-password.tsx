import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/nre/StubPage";

export const Route = createFileRoute("/admin_/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — NR Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => <StubPage title="Reset password" note="Built in Phase 3." />,
});
