import { useState } from "react";
import { toast } from "sonner";
import { FormDialog } from "@/components/nre/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi, ApiError } from "@/lib/api";

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setError(null);
    }
  };

  const submit = async () => {
    setError(null);
    if (newPassword.length < 8) { setError("Use at least 8 characters for your new password."); return; }
    if (newPassword !== confirmPassword) { setError("The new passwords do not match."); return; }
    setBusy(true);
    try {
      await authApi.changePassword(currentPassword, newPassword);
      toast.success("Password updated.");
      close(false);
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Could not update your password. Try again.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog open={open} onOpenChange={close} title="Change password" description="Use your current password to set a new one."
      onSubmit={() => { void submit(); }} submitLabel="Update password" submitting={busy}>
      <div className="space-y-1.5"><Label htmlFor="current-password">Current password</Label><Input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></div>
      <div className="space-y-1.5"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={8} /></div>
      <div className="space-y-1.5"><Label htmlFor="confirm-password">Confirm new password</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} /></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </FormDialog>
  );
}