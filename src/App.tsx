import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import { supabase } from "./lib/supabase";

export default function App() {
  const [supabaseStatus, setSupabaseStatus] = useState<string>("Verifying Supabase connection...");

  useEffect(() => {
    async function verifyConnection() {
      try {
        const { error } = await supabase.auth.getSession();
        if (error) {
          setSupabaseStatus(`Supabase Auth check: ${error.message}`);
        } else {
          setSupabaseStatus("Supabase Connected (Anon Key)");
        }
      } catch (err) {
        setSupabaseStatus(
          `Supabase status: ${err instanceof Error ? err.message : "Offline or Unreachable"}`
        );
      }
    }

    void verifyConnection();
  }, []);

  return (
    <BrowserRouter>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <AppRoutes />

        {/* Development Connection Diagnostic Bar (Milestone 1 Scope) */}
        <aside
          aria-label="Development environment status"
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
            pointerEvents: "auto",
          }}
        >
          <span
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              backgroundColor: supabaseStatus.includes("Connected")
                ? "var(--color-forest-green)"
                : "var(--color-warning-text)",
            }}
          />
          <span>{supabaseStatus}</span>
        </aside>
      </div>
    </BrowserRouter>
  );
}
