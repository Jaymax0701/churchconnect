import { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Alert } from "../../../components/ui/Alert";
import { Button } from "../../../components/ui/Button";
import { Card, CardBody } from "../../../components/ui/Card";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../../lib/supabase";

export const FamilyInvitationAcceptPage = () => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptedFamily, setAcceptedFamily] = useState<string | null>(null);

  const isValidToken = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);

  async function acceptInvitation() {
    if (!isValidToken || !user || !profile?.is_approved) return;
    setSubmitting(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("accept_family_invitation", {
      p_token: token,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const result = data as { family_name?: string; status?: string } | null;
    setAcceptedFamily(result?.family_name ?? "your household");
  }

  return (
    <main className="container" style={{ minHeight: "60vh", display: "grid", placeItems: "center", paddingTop: "var(--space-10)", paddingBottom: "var(--space-10)" }}>
      <div style={{ width: "100%", maxWidth: 560 }}>
        <Card>
          <CardBody style={{ padding: "var(--space-8)" }}>
            <h1 style={{ marginTop: 0, fontSize: "var(--text-2xl)" }}>Join a household</h1>
            {!isValidToken ? (
              <Alert variant="danger" title="Invitation link is invalid">
                This invitation link is incomplete or malformed. Ask the Family Leader to generate a new invitation.
              </Alert>
            ) : acceptedFamily ? (
              <>
                <Alert variant="success" title="Invitation accepted">
                  You have joined {acceptedFamily}. Your individual account remains yours; no password has been shared.
                </Alert>
                <Button onClick={() => navigate("/portal/family", { replace: true })}>Open Family Management</Button>
              </>
            ) : loading ? (
              <p role="status">Checking your ChurchConnect account…</p>
            ) : !user ? (
              <>
                <p style={{ color: "var(--color-text-secondary)" }}>
                  Sign in with the email address that received this invitation. If you are new to ChurchConnect, create your own account first, verify your email, and complete the required church approval.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Link to="/login" state={{ from: { pathname: location.pathname + location.search } }}>
                    <Button>Sign in to accept</Button>
                  </Link>
                  <Link to="/signup">
                    <Button variant="secondary">Create my account</Button>
                  </Link>
                </div>
                <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", marginTop: "var(--space-4)" }}>
                  Keep this invitation link. After account verification and approval, return to this same link to accept it.
                </p>
              </>
            ) : !profile?.is_approved ? (
              <Alert variant="warning" title="Account approval required">
                Your ChurchConnect account must be approved before you can join this household. Complete any required safeguarding review, then return to this invitation link.
              </Alert>
            ) : (
              <>
                <p style={{ color: "var(--color-text-secondary)" }}>
                  You are signed in as <strong>{user.email}</strong>. Accepting will add your own account to the invited household. Your membership is linked to this verified email and cannot be accepted on someone else's behalf.
                </p>
                {error && <Alert variant="danger" title="Unable to accept invitation">{error}</Alert>}
                <Button onClick={() => void acceptInvitation()} isLoading={submitting} disabled={submitting}>
                  Accept household invitation
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </main>
  );
};
