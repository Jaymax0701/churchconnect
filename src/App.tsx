import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import { supabase } from "./lib/supabase";
import { AuthProvider } from "./modules/auth/AuthContext";

export default function App() {
  const [supabaseStatus, setSupabaseStatus] = useState<string>("Checking Supabase connection…");

  useEffect(() => {
    let active = true;

    async function verifyConnection() {
      try {
        const { error } = await supabase.auth.getSession();
        if (!active) return;
        setSupabaseStatus(error ? "Supabase Auth unavailable" : "Supabase connected");
      } catch {
        if (active) setSupabaseStatus("Supabase unreachable");
      }
    }

    void verifyConnection();
    return () => {
      active = false;
    };
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
          <AppRoutes />
          <aside
            aria-label="Application connection status"
            style={{
              position: "fixed",
              bottom: "12px",
              right: "12px",
              zIndex: 9999,
              backgroundColor: "var(--color-white)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-full)",
              boxShadow: "var(--shadow-md)",
              padding: "4px 12px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "11px",
              color: "var(--color-text-secondary)",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                backgroundColor: supabaseStatus === "Supabase connected"
                  ? "var(--color-success-text)"
                  : "var(--color-warning-text)",
              }}
            />
            <span>{supabaseStatus}</span>
          </aside>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}
