import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { Alert } from "../../components/ui/Alert";
import { useAuth } from "./AuthContext";
import { supabase } from "../../lib/supabase";

export function RequireSuperadmin() {
  const { user } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function verifyRole() {
      if (!user) {
        setAllowed(false);
        return;
      }

      setAllowed(null);
      setError(null);

      const { data, error: rpcError } = await supabase.rpc("current_user_has_role", {
        required_role: "superadmin",
      });

      if (!active) return;

      if (rpcError) {
        setAllowed(false);
        setError("Administrator authorization is not configured yet. Apply the reviewed authorization SQL before accessing the admin console.");
        return;
      }

      setAllowed(data === true);
    }

    void verifyRole();
    return () => {
      active = false;
    };
  }, [user?.id]);

  if (allowed === null && !error) {
    return (
      <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", padding: "var(--space-8)" }}>
        <p role="status">Verifying administrator access…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container" style={{ paddingTop: "var(--space-10)" }}>
        <Alert variant="warning" title="Administrator access is not ready">
          {error}
        </Alert>
      </main>
    );
  }

  if (!allowed) return <Navigate to="/portal" replace />;
  return <Outlet />;
}
