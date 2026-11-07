import React from "react";
import { Card, CardHeader, CardBody } from "../../../components/ui/Card";
import { Badge } from "../../../components/ui/Badge";
import { Icon } from "../../../components/ui/Icon";
import { useAuth } from "../../auth/AuthContext";

export const MemberPortalPage: React.FC = () => {
  const { user, profile } = useAuth();
  const displayName = profile?.full_name?.trim() || user?.email || "Account";
  const email = user?.email || "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "var(--space-4)" }}>
        <div>
          <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, margin: 0 }}>
            Member Dashboard
          </h1>
          <p style={{ margin: "var(--space-1) 0 0" }}>
            Welcome, <strong>{displayName}</strong>
          </p>
        </div>
        <Badge variant="neutral">No membership assigned</Badge>
      </div>

      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
            <Icon name="person" size={18} />
            <span>My Account</span>
          </div>
        </CardHeader>
        <CardBody>
          <div style={{ fontSize: "var(--text-sm)", lineHeight: 1.9 }}>
            <div><strong>Name:</strong> {profile?.full_name || "Not provided"}</div>
            <div><strong>Email:</strong> {email}</div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600 }}>
            <Icon name="church" size={18} />
            <span>My Church & Ministries</span>
          </div>
        </CardHeader>
        <CardBody>
          <div style={{ textAlign: "center", padding: "var(--space-6) var(--space-4)" }}>
            <div style={{ fontSize: "var(--text-lg)", fontWeight: 600, marginBottom: "var(--space-2)" }}>
              You are not linked to a church yet
            </div>
            <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--text-sm)", margin: 0 }}>
              No church, congregation, or ministry membership has been assigned to this account.
              Your dashboard will show membership details and activities here once an administrator links your account.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
