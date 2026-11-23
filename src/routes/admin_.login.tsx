import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/nre/Logo";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { USE_MOCK } from "@/config/flags";
import { noIndexPageHead } from "@/lib/seo";

const HEAD = noIndexPageHead("Sign in — NR Enterprise Admin", "Sign in to manage NR Enterprise products, stock, customers and enquiries.");

export const Route = createFileRoute("/admin_/login")({
  head: () => ({ ...HEAD, meta: [...HEAD.meta, { name: "robots", content: "noindex" }] }),
  component: Login,
});

// Minimal login so the admin guard can be tried in Phase 0; polished in Phase 3.
function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="nr-dotted grid min-h-screen place-items-center bg-muted p-4">
      <form className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-8 shadow-soft"
        onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          try { await login(email, password); await navigate({ to: "/admin" }); }
          catch (err) { toast.error(err instanceof ApiError ? err.message : "Login failed"); }
          finally { setBusy(false); }
        }}>
        <Logo className="mx-auto h-12" />
        <h1 className="text-center text-xl font-bold">Admin login</h1>
        <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input id="password" type={show ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
            <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Logging in…" : "Log in"}</Button>
        <Link to="/admin/forgot-password" className="block text-center text-sm text-secondary hover:underline">Forgot password?</Link>
        {USE_MOCK && <p className="rounded-xl bg-yellow-soft p-3 text-xs">Demo: admin@nre.test / manager@nre.test / staff@nre.test / pending@nre.test, password <b>password123</b></p>}
      </form>
    </div>
  );
}
