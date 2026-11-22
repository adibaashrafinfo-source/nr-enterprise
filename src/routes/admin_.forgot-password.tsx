import { createFileRoute } from "@tanstack/react-router";
import { StubPage } from "@/components/nre/StubPage";

export const Route = createFileRoute("/admin_/forgot-password")({
  head: () => ({ meta: [{ title: "Forgot password — NR Admin" }, { name: "robots", content: "noindex" }] }),
  component: () => <StubPage title="Forgot password" note="Built in Phase 3." />,
});
