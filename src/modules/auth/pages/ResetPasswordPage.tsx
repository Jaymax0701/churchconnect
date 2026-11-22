import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardBody } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import { Input } from "../../../components/ui/Input";
import { Alert } from "../../../components/ui/Alert";
import { Turnstile } from "../../../components/ui/Turnstile";
import { supabase } from "../../../lib/supabase";

export const ResetPasswordPage = ({ mode }: { mode: "request" | "update" }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== "update") return;

    let active = true;
    const hasRecoveryCallback =
      new URLSearchParams(window.location.search).has("code") ||
      new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "PASSWORD_RECOVERY") setRecoveryReady(true);
    });

    // The recovery event can fire before this page mounts because the app
    // initializes Supabase auth before rendering its routes. In that case,
    // detect the recovery callback in the URL and verify that it produced a session.
    if (hasRecoveryCallback) {
      void supabase.auth.getSession().then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) {
          setError("Your password-reset link could not be verified. Please request a new link.");
          return;
        }
        if (data.session) setRecoveryReady(true);
        else setError("Your password-reset link is invalid or has expired. Please request a new link.");
      });
    }

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [mode]);

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!captchaToken) {
      setError("Please complete the security check before requesting a password-reset link.");
      return;
    }

    setSubmitting(true);
    const { error: requestError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/reset-password`,
      captchaToken,
    });
    setSubmitting(false);
    setCaptchaToken("");
    setCaptchaResetKey((current) => current + 1);

    if (requestError) setError(requestError.message);
    else setMessage("If an account exists for that email, a password-reset link has been sent.");
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null); setMessage(null);
    if (password.length < 8) { setError("Use a password with at least 8 characters."); return; }
    if (password !== confirmPassword) { setError("The passwords do not match."); return; }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) setError(updateError.message);
    else { setMessage("Your password has been updated. You can now sign in."); window.setTimeout(() => navigate("/login", { replace: true }), 1200); }
  }

  return <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: "var(--space-8) var(--space-4)" }}>
    <Card><CardBody style={{ width: "min(420px, calc(100vw - 48px))", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div><h1 style={{ fontSize: "var(--text-2xl)", margin: 0 }}>{mode === "request" ? "Reset your password" : "Choose a new password"}</h1>
        <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)" }}>{mode === "request" ? "We will email you a secure password-reset link." : "Set a new password for your ChurchConnect account."}</p></div>
      {error && <Alert variant="danger" title="Unable to continue">{error}</Alert>}
      {message && <Alert variant="success" title="Password reset">{message}</Alert>}
      {mode === "request" ? <form onSubmit={(event) => void handleRequest(event)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Input id="reset-email" label="Email address" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
        <Turnstile
          action="password_reset"
          resetKey={captchaResetKey}
          onToken={setCaptchaToken}
          onError={() => setCaptchaToken("")}
          onExpire={() => setCaptchaToken("")}
        />
        <Button type="submit" isLoading={submitting} disabled={submitting}>Send reset link</Button>
      </form> : recoveryReady ? <form onSubmit={(event) => void handleUpdate(event)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <Input id="new-password" label="New password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required autoComplete="new-password" />
        <Input id="confirm-new-password" label="Confirm new password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required autoComplete="new-password" />
        <Button type="submit" isLoading={submitting} disabled={submitting}>Update password</Button>
      </form> : <Alert variant="info" title="Open your password-reset email">Use the latest reset link sent to your inbox. If it has expired, request a new one.</Alert>}
      <div style={{ textAlign: "center" }}><Link to="/login" style={{ color: "var(--color-forest-green)", fontSize: "var(--text-sm)" }}>Back to sign in</Link></div>
    </CardBody></Card>
  </main>;
};
