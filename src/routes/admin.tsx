import { Link, Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Logo } from "@/components/nre/Logo";
import { LoadingSkeleton } from "@/components/nre/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { canAccessAdminPath } from "@/lib/admin-access";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ name: "robots", content: "noindex" }] }),
  component: AdminGuard,
});

function AdminGuard() {
  const { user, role, loading, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useEffect(() => { if (!loading && !user) void navigate({ to: "/admin/login" }); }, [loading, user, navigate]);

  if (loading || !user) return <div className="p-8"><LoadingSkeleton /></div>;
  if (!role) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted p-4">
        <div className="max-w-sm rounded-2xl border bg-card p-8 text-center shadow-soft">
          <Logo variant="mark" className="mx-auto mb-4 size-14" />
          <h1 className="text-xl font-bold">Waiting for approval</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your account is created. An admin needs to give you a role before you can use the panel.</p>
          <Button variant="outline" className="mt-6" onClick={() => void logout()}>Log out</Button>
        </div>
      </div>
    );
  }
  if (!canAccessAdminPath(pathname, role)) {
    return <div className="grid min-h-[60vh] place-items-center p-6"><div className="max-w-md text-center"><h1 className="text-2xl font-bold">Access restricted</h1><p className="mt-2 text-sm text-muted-foreground">Your account does not have access to this section.</p><Button asChild className="mt-5"><Link to="/admin">Back to dashboard</Link></Button></div></div>;
  }
  return <AdminLayout><Outlet /></AdminLayout>;
}
