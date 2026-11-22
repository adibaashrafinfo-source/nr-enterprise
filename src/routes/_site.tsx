import { Outlet, createFileRoute } from "@tanstack/react-router";
import { PublicLayout } from "@/components/layouts/PublicLayout";

export const Route = createFileRoute("/_site")({
  component: () => <PublicLayout><Outlet /></PublicLayout>,
});
