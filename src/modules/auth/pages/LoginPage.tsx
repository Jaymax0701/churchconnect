import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Input } from "../../../components/ui/Input";
import { Alert } from "../../../components/ui/Alert";
import { Icon } from "../../../components/ui/Icon";

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setDemoMessage(
        "Demonstration Form: Credentials were validated client-side. Live Supabase Auth sessions will be implemented in Milestone 3."
      );
    }, 600);
  };

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
                Sign In to ChurchConnect
              </h1>
              <p style={{ fontSize: "var(--text-sm)", margin: 0 }}>
                Access your member roster, cell groups, and church community.
              </p>
            </div>

            <Alert variant="info" style={{ marginBottom: "var(--space-6)" }}>
              <strong>Milestone 1 Preview:</strong> Live authentication and password verification will be connected to Supabase Auth in Milestone 3.
            </Alert>

            {demoMessage && (
              <Alert variant="success" style={{ marginBottom: "var(--space-6)" }}>
                {demoMessage}
              </Alert>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <Input
                label="Email Address"
                id="login-email"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Input
                label="Password"
                id="login-password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <Button type="submit" variant="primary" size="lg" isLoading={isLoading} style={{ width: "100%", marginTop: "var(--space-2)" }}>
                Sign In
              </Button>
            </form>

            <div style={{ marginTop: "var(--space-6)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--border-default)", textAlign: "center" }}>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", marginBottom: "var(--space-3)" }}>
                Quick Experience Navigation:
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-2)" }}>
                <Button variant="secondary" size="sm" onClick={() => navigate("/portal")}>
                  Preview Member Portal
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate("/admin")}>
                  Preview Admin Panel
                </Button>
              </div>
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
