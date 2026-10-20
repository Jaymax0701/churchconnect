import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { Icon } from "../../../components/ui/Icon";

export const NotFoundPage: React.FC = () => {
  return (
    <div
      style={{
        minHeight: "calc(100vh - 70px - 200px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-12) var(--space-4)",
      }}
    >
      <div style={{ maxWidth: "480px", width: "100%", textAlign: "center" }}>
        <Card>
          <CardBody style={{ padding: "var(--space-10) var(--space-6)" }}>
            <div style={{ marginBottom: "var(--space-3)", display: "flex", justifyContent: "center" }}>
              <Icon name="travel_explore" size={56} color="var(--color-forest-green)" />
            </div>
            <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: 700, margin: "0 0 var(--space-2)" }}>
              Page Not Found
            </h1>
            <p style={{ fontSize: "var(--text-base)", marginBottom: "var(--space-6)" }}>
              The page you are looking for may have moved, been renamed, or does not exist.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-3)" }}>
              <Link to="/">
                <Button variant="primary">Return Home</Button>
              </Link>
              <Link to="/portal">
                <Button variant="secondary">Member Portal</Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
