import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { supabase } from "../../../lib/supabase";

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) setRecoveryReady(true);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) setRecoveryReady(true);
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Your password must contain at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The password confirmation does not match.");
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSuccess(true);
    window.setTimeout(() => navigate("/login", { replace: true }), 1800);
  }

  return (
    <div style={{ minHeight: "calc(100vh - 70px - 200px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-10) var(--space-4)" }}>
      <div style={{ maxWidth: "440px", width: "100%" }}>
        <Card>
          <CardBody style={{ padding: "var(--space-8)" }}>
            <h1 style={{ fontSize: "var(--text-2xl)", margin: "0 0 var(--space-2)" }}>Set a new password</h1>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", marginTop: 0 }}>Choose a new password for your ChurchConnect account.</p>
            {error && <Alert variant="danger" title="Password update failed">{error}</Alert>}
            {success && <Alert variant="success" title="Password updated">Your password has been changed. Redirecting you to sign in…</Alert>}
            {!success && (recoveryReady ? (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginTop: "var(--space-5)" }}>
                <Input id="new-password" label="New password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
                <Input id="confirm-new-password" label="Confirm new password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} />
                <Button type="submit" size="lg" isLoading={submitting} disabled={submitting} style={{ width: "100%" }}>Update password</Button>
              </form>
            ) : (
              <Alert variant="info" title="Open your password reset email">Use the password reset link sent to your email address. If the link has expired, ask an administrator to send a new reset email.</Alert>
            ))}
            <p style={{ textAlign: "center", marginTop: "var(--space-5)", fontSize: "var(--text-sm)" }}><Link to="/login">Return to sign in</Link></p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
