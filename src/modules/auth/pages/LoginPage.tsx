import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Alert } from "../../../components/ui/Alert";
import { Icon } from "../../../components/ui/Icon";

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();

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
                Sign-in is coming soon
              </h1>
              <p style={{ fontSize: "var(--text-sm)", margin: 0 }}>
                ChurchConnect member accounts are not available in this preview yet.
              </p>
            </div>

            <Alert variant="warning" style={{ marginBottom: "var(--space-6)" }}>
              <strong>Preview environment:</strong> Sign-in and password verification are not connected. Do not enter real account credentials here. Live Supabase Auth will be implemented as part of the authentication milestone.
            </Alert>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigate("/portal")}
                style={{ width: "100%" }}
              >
                Preview Member Portal
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => navigate("/admin")}
                style={{ width: "100%" }}
              >
                Preview Admin Panel
              </Button>
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
