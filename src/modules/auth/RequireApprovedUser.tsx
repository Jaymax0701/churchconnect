import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { useAuth } from "./AuthContext";

function AccessLoading() {
  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: "var(--space-8)" }}>
      <p role="status">Checking your account…</p>
    </main>
  );
}

export function RequireApprovedUser() {
  const { user, profile, loading, profileError } = useAuth();
  const location = useLocation();

  if (loading) return <AccessLoading />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  if (profileError) {
    return (
      <main className="container" style={{ paddingTop: "var(--space-10)" }}>
        <Alert variant="danger" title="Unable to verify your account">
          We could not securely load your account profile. Please try signing out and back in. If this continues, contact your ChurchConnect administrator.
        </Alert>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="container" style={{ paddingTop: "var(--space-10)" }}>
        <Alert variant="danger" title="Account profile unavailable">
          Your authentication account exists, but its ChurchConnect profile could not be found. Please contact an administrator.
        </Alert>
      </main>
    );
  }

  if (!profile.is_approved) return <Navigate to="/pending" replace />;

  return <Outlet />;
}
