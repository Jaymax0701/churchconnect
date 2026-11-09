import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Alert } from "../../../components/ui/Alert";
import { Icon } from "../../../components/ui/Icon";
import { Input } from "../../../components/ui/Input";
import { useAuth } from "../AuthContext";

interface LoginLocationState {
  from?: {
    pathname?: string;
  };
}

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requestedPath = (location.state as LoginLocationState | null)?.from?.pathname;
  const destination = requestedPath?.startsWith("/") ? requestedPath : "/portal";

  if (!authLoading && user) {
    return <Navigate to={destination} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const result = await signIn(email, password);

    setSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }

    navigate(destination, { replace: true });
  }

  return (
    <div
      style={{
        minHeight: "calc(100vh - 70px - 200px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-10) var(--space-4)",
      }}
    >
      <div style={{ maxWidth: "440px", width: "100%" }}>
        <Card>
          <CardBody style={{ padding: "var(--space-8)" }}>
            <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "var(--radius-lg)",
                  backgroundColor: "var(--color-forest-green)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "var(--space-3)",
                }}
              >
                <Icon name="church" size={28} color="var(--color-white)" />
              </div>
              <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: "0 0 var(--space-1)" }}>
                Welcome back
              </h1>
              <p style={{ fontSize: "var(--text-sm)", margin: 0 }}>
                Sign in to your ChurchConnect account.
              </p>
            </div>

            {error && (
              <Alert variant="danger" title="Sign-in unsuccessful" style={{ marginBottom: "var(--space-5)" }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <Input
                id="email"
                label="Email address"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <Input
                id="password"
                label="Password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <Button type="submit" size="lg" isLoading={submitting} disabled={submitting || authLoading} style={{ width: "100%" }}>
                Sign in
              </Button>
            </form>

            <div style={{ marginTop: "var(--space-5)", textAlign: "center", fontSize: "var(--text-sm)" }}>
              <span style={{ color: "var(--color-text-secondary)" }}>New to ChurchConnect? </span>
              <Link to="/signup" style={{ color: "var(--color-forest-green)", fontWeight: 700, textDecoration: "none" }}>
                Create an account
              </Link>
            </div>
            <div style={{ marginTop: "var(--space-3)", textAlign: "center" }}>
              <Link to="/forgot-password" style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-xs)", textDecoration: "none" }}>
                Forgot your password?
              </Link>
            </div>
          </CardBody>
        </Card>

        <div style={{ textAlign: "center", marginTop: "var(--space-4)" }}>
          <Link to="/" style={{ fontSize: "var(--text-sm)", color: "var(--color-forest-green)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Icon name="arrow_back" size={16} /> Return to Public Website
          </Link>
        </div>
      </div>
    </div>
  );
};
