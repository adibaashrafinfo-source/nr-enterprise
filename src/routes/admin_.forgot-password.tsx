import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/nre/Logo";
import { authApi } from "@/lib/api";
import { noIndexPageHead } from "@/lib/seo";

const HEAD = noIndexPageHead("Forgot password — NR Enterprise Admin", "Request a password reset link for your NR Enterprise workspace account.");

export const Route = createFileRoute("/admin_/forgot-password")({
  head: () => ({ ...HEAD, meta: [...HEAD.meta, { name: "robots", content: "noindex" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await authApi.forgotPassword(email.trim());
      if (result.demo_reset_url) {
        const parsed = new URL(result.demo_reset_url, window.location.origin);
        setResetToken(parsed.searchParams.get("token"));
      }
      setSent(true);
      toast.success("If the account exists, a reset link has been sent.");
    } catch {
      toast.error("Could not request a reset link. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="nr-dotted grid min-h-screen place-items-center bg-muted p-4">
    <section className="w-full max-w-md rounded-2xl border bg-card p-7 shadow-soft sm:p-9">
      <Logo className="mx-auto h-11" />
      <h1 className="mt-6 text-center text-2xl font-bold">Forgot password</h1>
      {!sent ? <>
        <p className="mt-2 text-center text-sm text-muted-foreground">Enter your account email to request a reset link.</p>
        <form onSubmit={(event) => { void submit(event); }} className="mt-6 space-y-4">
          <div className="space-y-1.5"><Label htmlFor="reset-email">Email</Label><Input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? "Sending…" : "Send reset link"}</Button>
        </form>
      </> : <div role="status" className="mt-5 space-y-4 text-center">
        <p className="text-sm text-muted-foreground">If the email matches an account, password reset instructions are on their way.</p>
        {resetToken && <Button asChild variant="outline" className="w-full"><Link to="/admin/reset-password" search={{ token: resetToken }}>Open demo reset link</Link></Button>}
        <Button asChild variant="link"><Link to="/admin/login">Back to sign in</Link></Button>
      </div>}
      {!sent && <p className="mt-5 text-center text-sm"><Link to="/admin/login" className="font-medium text-secondary hover:underline">Back to sign in</Link></p>}
    </section>
  </div>;
}
