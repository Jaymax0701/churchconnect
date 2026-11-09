import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Alert } from "../../../components/ui/Alert";
import { Icon } from "../../../components/ui/Icon";
import { Input } from "../../../components/ui/Input";
import { useAuth } from "../AuthContext";
import { supabase } from "../../../lib/supabase";

export const SignUpPage = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!authLoading && user) return <Navigate to="/portal" replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim() },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      });
      if (signUpError) throw signUpError;
      if (data.session) {
        navigate("/pending", { replace: true });
        return;
      }
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ minHeight: "calc(100vh - 70px - 200px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-10) var(--space-4)" }}>
      <div style={{ width: "100%", maxWidth: "480px" }}>
        <Card><CardBody style={{ padding: "var(--space-8)" }}>
          <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
            <div style={{ width: "48px", height: "48px", borderRadius: "var(--radius-lg)", background: "var(--color-forest-green)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "var(--space-3)" }}>
              <Icon name="person_add" size={26} color="var(--color-white)" />
            </div>
            <h1 style={{ fontSize: "var(--text-2xl)", margin: "0 0 var(--space-1)" }}>Create your account</h1>
            <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-secondary)" }}>Join your church community on ChurchConnect.</p>
          </div>
          {submitted ? <Alert variant="success" title="Check your email to verify your account">
            We have sent a verification link if this email is eligible for registration. After verifying, your account will wait for administrator approval before member access is enabled.
          </Alert> : <>
            {error && <Alert variant="danger" title="Registration unsuccessful">{error}</Alert>}
            <form onSubmit={(event) => void handleSubmit(event)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginTop: "var(--space-4)" }}>
              <Input id="signup-name" label="Full name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Enter your full name" required />
              <Input id="signup-email" label="Email address" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
              <Input id="signup-password" label="Password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} hint="At least 8 characters." required minLength={8} />
              <Input id="signup-confirm-password" label="Confirm password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} />
              <Button type="submit" size="lg" isLoading={submitting} disabled={submitting || authLoading} style={{ width: "100%" }}>Create account</Button>
            </form>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", lineHeight: 1.6, marginTop: "var(--space-4)" }}>
              Registration does not automatically grant member access. Verify your email first; a ChurchConnect Superadmin must then approve your account. Roles and congregation membership are assigned separately.
            </p>
          </>}
          <p style={{ textAlign: "center", fontSize: "var(--text-sm)", margin: "var(--space-5) 0 0" }}>
            Already have an account? <Link to="/login" style={{ color: "var(--color-forest-green)", fontWeight: 700 }}>Sign in</Link>
          </p>
        </CardBody></Card>
        <p style={{ textAlign: "center", marginTop: "var(--space-4)" }}><Link to="/" style={{ color: "var(--color-forest-green)", fontSize: "var(--text-sm)", textDecoration: "none" }}>Return to Public Website</Link></p>
      </div>
    </main>
  );
};
