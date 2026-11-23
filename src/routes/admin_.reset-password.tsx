import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/nre/Logo";
import { ApiError, authApi } from "@/lib/api";
import { noIndexPageHead } from "@/lib/seo";

const HEAD = noIndexPageHead("Reset password — NR Enterprise Admin", "Set a new password for your NR Enterprise workspace account.");

export const Route = createFileRoute("/admin_/reset-password")({
  validateSearch: (search: Record<string, unknown>) => ({ token: typeof search["token"] === "string" ? search["token"] : "" }),
  head: () => ({ ...HEAD, meta: [...HEAD.meta, { name: "robots", content: "noindex" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Use at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("The passwords do not match."); return; }
    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      setComplete(true);
      toast.success("Password reset. Sign in with your new password.");
      await navigate({ to: "/admin/login", replace: true });
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "This reset link is invalid or expired.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="nr-dotted grid min-h-screen place-items-center bg-muted p-4">
    <section className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-soft sm:p-9">
      <Logo className="mx-auto h-11" />
      <h1 className="mt-6 text-center text-2xl font-bold">Reset password</h1>
      {complete ? <div role="status" className="mt-5 text-center"><p className="text-sm text-muted-foreground">Your password has been updated.</p><Button asChild className="mt-4"><Link to="/admin/login">Go to sign in</Link></Button></div>
        : !token ? <div className="mt-5 text-center"><p role="alert" className="text-sm text-muted-foreground">This link is missing its reset token.</p><Button asChild variant="outline" className="mt-4"><Link to="/admin/forgot-password">Request another link</Link></Button></div>
          : <form onSubmit={(event) => { void submit(event); }} className="mt-6 space-y-4">
            <div className="space-y-1.5"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? "Updating…" : "Set new password"}</Button>
            <p className="text-center text-sm"><Link to="/admin/login" className="font-medium text-secondary hover:underline">Back to sign in</Link></p>
          </form>}
    </section>
  </div>;
}
