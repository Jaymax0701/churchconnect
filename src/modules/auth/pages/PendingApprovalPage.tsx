import { Link } from "react-router-dom";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { useAuth } from "../AuthContext";

export const PendingApprovalPage = () => {
  const { profile, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
  }

  return (
    <div style={{ minHeight: "65vh", display: "grid", placeItems: "center", padding: "var(--space-8) var(--space-4)" }}>
      <div style={{ width: "100%", maxWidth: "520px" }}>
        <Card>
          <CardBody style={{ padding: "var(--space-8)" }}>
            <div style={{ textAlign: "center", marginBottom: "var(--space-6)" }}>
              <div style={{ fontSize: "40px", marginBottom: "var(--space-3)" }} aria-hidden="true">⏳</div>
              <h1 style={{ fontSize: "var(--text-2xl)", marginBottom: "var(--space-2)" }}>Account awaiting approval</h1>
              <p>Your email is verified, but a ChurchConnect administrator must approve your account before you can access the member portal.</p>
            </div>
            <Alert variant="info" title="What happens next?">
              Your registration is recorded. Please wait for your church administrator to review and approve your account.
            </Alert>
            {profile?.full_name && (
              <p style={{ marginTop: "var(--space-4)", fontSize: "var(--text-sm)", textAlign: "center" }}>
                Signed in as <strong>{profile.full_name}</strong>
              </p>
            )}
            <div style={{ display: "flex", justifyContent: "center", gap: "var(--space-3)", marginTop: "var(--space-6)", flexWrap: "wrap" }}>
              <Button variant="secondary" onClick={handleSignOut}>Sign out</Button>
              <Link to="/" style={{ alignSelf: "center", fontSize: "var(--text-sm)" }}>Return to public website</Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
