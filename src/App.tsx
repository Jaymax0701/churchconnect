import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { AppRoutes } from "./routes/AppRoutes";
import { supabase } from "./lib/supabase";
import { AuthProvider, useAuth } from "./modules/auth/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";

function AppLoadingScreen() {
  return (
    <main className="app-loading-screen" role="status" aria-live="polite" aria-label="Loading ChurchConnect">
      <div className="app-loading-glow app-loading-glow-one" />
      <div className="app-loading-glow app-loading-glow-two" />
      <section className="app-loading-glass">
        <div className="app-loading-mark" aria-hidden="true">CC</div>
        <p className="app-loading-eyebrow">FAITH · COMMUNITY · MINISTRY</p>
        <h1>ChurchConnect</h1>
        <div className="app-loading-spinner" aria-hidden="true"><span /></div>
        <p className="app-loading-message">Preparing your space…</p>
      </section>
      <p className="app-loading-footer">A place to connect, grow and serve together.</p>
    </main>
  );
}

function AppContent() {
  const { loading: authLoading } = useAuth();
  const [pageAssetsReady, setPageAssetsReady] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<string>("Checking Supabase connection…");

  useEffect(() => {
    let active = true;
    let timeoutId = 0;

    const pageLoad = document.readyState === "complete"
      ? Promise.resolve()
      : new Promise<void>((resolve) => window.addEventListener("load", () => resolve(), { once: true }));
    const fontsLoad = document.fonts?.ready ?? Promise.resolve();

    // Do not leave the app behind a loader indefinitely if a remote font provider is unavailable.
    const readiness = Promise.race([
      Promise.all([pageLoad, fontsLoad]),
      new Promise<void>((resolve) => {
        timeoutId = window.setTimeout(resolve, 10000);
      }),
    ]);

    void readiness.then(() => {
      if (active) setPageAssetsReady(true);
      window.clearTimeout(timeoutId);
    });

    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, []);

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

  if (authLoading || !pageAssetsReady) return <AppLoadingScreen />;

  return (
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
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
