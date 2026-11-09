import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";
import { Input } from "../../../components/ui/Input";
import { supabase } from "../../../lib/supabase";

export const SignUpPage = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/pending`,
      },
    });
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      navigate("/pending", { replace: true });
      return;
    }
    setSuccess(true);
  }

  return (
    <div style={{ minHeight: "calc(100vh - 70px - 200px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "var(--space-10) var(--space-4)" }}>
      <div style={{ maxWidth: "480px", width: "100%" }}>
        <Card>
          <CardBody style={{ padding: "var(--space-8)" }}>
            <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "var(--radius-lg)", backgroundColor: "var(--color-forest-green)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "var(--space-3)" }}>
                <Icon name="person_add" size={26} color="var(--color-white)" />
              </div>
              <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: "0 0 var(--space-1)" }}>Create your account</h1>
              <p style={{ fontSize: "var(--text-sm)", margin: 0, color: "var(--color-text-secondary)" }}>Join your church community on ChurchConnect.</p>
            </div>

            {error && <Alert variant="danger" title="Registration unsuccessful" style={{ marginBottom: "var(--space-4)" }}>{error}</Alert>}
            {success ? (
              <Alert variant="success" title="Check your email">
                Your registration has been received. Follow the email verification link to verify your address. After verification, your account will remain pending until an administrator approves it.
              </Alert>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <Input id="full-name" label="Full name" autoComplete="name" placeholder="Enter your full name" value={fullName} onChange={(event) => setFullName(event.target.value)} required maxLength={120} />
                <Input id="signup-email" label="Email address" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required />
                <Input id="signup-password" label="Password" type="password" autoComplete="new-password" hint="Use at least 8 characters." value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
                <Input id="confirm-password" label="Confirm password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} />
                <Button type="submit" size="lg" isLoading={submitting} disabled={submitting} style={{ width: "100%" }}>Create account</Button>
              </form>
            )}

            <p style={{ fontSize: "var(--text-xs)", lineHeight: 1.6, color: "var(--color-text-secondary)", marginTop: "var(--space-5)", textAlign: "center" }}>
              Registration does not grant immediate portal access. Email verification and administrator approval are required.
            </p>
          </CardBody>
        </Card>
        <div style={{ textAlign: "center", marginTop: "var(--space-4)" }}>
          <Link to="/login" style={{ fontSize: "var(--text-sm)", color: "var(--color-forest-green)", textDecoration: "none" }}>Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  );
};
