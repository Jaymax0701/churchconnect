import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

export const PublicLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);

  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Detect whether ChurchConnect is already installed.
    const standaloneQuery = window.matchMedia(
      "(display-mode: standalone)"
    );

    const checkInstalled = () => {
      const isStandalone =
        standaloneQuery.matches ||
        (window.navigator as Navigator & { standalone?: boolean })
          .standalone === true;

      setIsInstalled(isStandalone);
    };

    // Listen for the browser's PWA installation event.
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    // Update the UI after successful installation.
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    };

    checkInstalled();

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );
    window.addEventListener("appinstalled", handleAppInstalled);
    standaloneQuery.addEventListener("change", checkInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneQuery.removeEventListener("change", checkInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;

    await installPrompt.prompt();

    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
    } else {
      // The user can try again if the browser permits it.
      setInstallPrompt(null);
    }
  };


  const getNavLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    color: isActive ? "var(--color-soft-sage)" : "rgba(255, 255, 255, 0.85)",
    textDecoration: "none",
    fontWeight: isActive ? 600 : 500,
    fontSize: "var(--text-sm)",
    padding: "var(--space-2) var(--space-3)",
    borderRadius: "var(--radius-md)",
    backgroundColor: isActive ? "rgba(255, 255, 255, 0.1)" : "transparent",
    transition: "color var(--transition-fast), background-color var(--transition-fast)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Top Deep Forest Navigation Header with Modern Frosted Glass */}
      <header
        className="glass-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "70px",
          }}
        >
          {/* Brand Logo */}
          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              color: "var(--color-white)",
              textDecoration: "none",
            }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--radius-md)",
                backgroundColor: "var(--color-forest-green)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid var(--color-sage-green)",
              }}
              aria-hidden="true"
            >
              <Icon name="church" size={22} color="var(--color-white)" />
            </div>
            <div>
              <div style={{ fontSize: "var(--text-lg)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--color-white)" }}>
                ChurchConnect
              </div>
              <div style={{ fontSize: "10px", color: "var(--color-soft-sage)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Faith & Community
              </div>
            </div>
          </Link>
          {/* PWA Install Button — visible on desktop and mobile */}
          {!isInstalled && installPrompt && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleInstallClick}
            >
              <Icon name="download" size={16} />
              Install
            </Button>
          )}
          {/* Desktop Navigation */}
          <nav
            style={{ display: "none", alignItems: "center", gap: "var(--space-2)" }}
            className="desktop-nav"
          >
            <NavLink to="/" style={getNavLinkStyle} end>Home</NavLink>
            <NavLink to="/portal" style={getNavLinkStyle}>Member Portal</NavLink>
            <NavLink to="/admin" style={getNavLinkStyle}>Admin Panel</NavLink>
            <div style={{ width: "1px", height: "24px", backgroundColor: "rgba(255, 255, 255, 0.15)", margin: "0 var(--space-2)" }} />
            <Link to="/login">
              <Button variant="secondary" size="sm">
                Member Sign In
              </Button>
            </Link>

          </nav>

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
            className="mobile-menu-btn"
            style={{
              color: "var(--color-white)",
              padding: "var(--space-2)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <Icon name={mobileMenuOpen ? "close" : "menu"} size={26} />
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div
            style={{
              backgroundColor: "var(--color-deep-forest)",
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              padding: "var(--space-4)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
            className="mobile-dropdown"
          >
            <NavLink to="/" style={getNavLinkStyle} onClick={() => setMobileMenuOpen(false)} end>Home</NavLink>
            <NavLink to="/portal" style={getNavLinkStyle} onClick={() => setMobileMenuOpen(false)}>Member Portal</NavLink>
            <NavLink to="/admin" style={getNavLinkStyle} onClick={() => setMobileMenuOpen(false)}>Admin Panel</NavLink>
            <div style={{ height: "1px", backgroundColor: "rgba(255, 255, 255, 0.15)", margin: "var(--space-2) 0" }} />
            <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="secondary" size="md" style={{ width: "100%" }}>
                Member Sign In
              </Button>
            </Link>
          </div>
        )}
      </header>

      {/* Main Public Page Content */}
      <main style={{ flex: 1, backgroundColor: "var(--bg-page)" }}>
        <Outlet />
      </main>

      {/* Deep Forest Footer */}
      <footer
        style={{
          backgroundColor: "var(--color-deep-forest)",
          color: "rgba(255, 255, 255, 0.8)",
          borderTop: "1px solid rgba(255, 255, 255, 0.1)",
          padding: "var(--space-10) 0 var(--space-6)",
        }}
      >
        <div className="container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "var(--space-8)",
              marginBottom: "var(--space-8)",
            }}
          >
            <div>
              <div style={{ color: "var(--color-white)", fontSize: "var(--text-lg)", fontWeight: 700, marginBottom: "var(--space-2)" }}>
                ChurchConnect
              </div>
              <p style={{ color: "rgba(255, 255, 255, 0.7)", fontSize: "var(--text-sm)", lineHeight: 1.6 }}>
                A welcoming Christian community dedicated to worship, discipleship, and Christ-centered service in our neighborhood and beyond.
              </p>
            </div>

            <div>
              <div style={{ color: "var(--color-white)", fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-3)" }}>
                Service Times
              </div>
              <ul style={{ listStyle: "none", fontSize: "var(--text-sm)", color: "rgba(255, 255, 255, 0.7)", lineHeight: 1.8 }}>
                <li><strong>Sunday Morning:</strong> 9:00 AM & 11:15 AM</li>
                <li><strong>Sunday School:</strong> 10:15 AM</li>
                <li><strong>Wednesday Prayer:</strong> 7:00 PM</li>
                <li><strong>Youth Fellowship:</strong> Fridays 6:30 PM</li>
              </ul>
            </div>

            <div>
              <div style={{ color: "var(--color-white)", fontSize: "var(--text-base)", fontWeight: 600, marginBottom: "var(--space-3)" }}>
                Quick Links
              </div>
              <ul style={{ listStyle: "none", fontSize: "var(--text-sm)", lineHeight: 2 }}>
                <li><Link to="/portal" style={{ color: "var(--color-soft-sage)" }}>Member Portal</Link></li>
                <li><Link to="/admin" style={{ color: "var(--color-soft-sage)" }}>Admin Dashboard</Link></li>
                <li><Link to="/login" style={{ color: "var(--color-soft-sage)" }}>Member Login</Link></li>
              </ul>
            </div>
          </div>

          <div
            style={{
              borderTop: "1px solid rgba(255, 255, 255, 0.1)",
              paddingTop: "var(--space-6)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "var(--space-4)",
              fontSize: "var(--text-xs)",
              color: "rgba(255, 255, 255, 0.5)",
            }}
          >
            <div>&copy; 2026 ChurchConnect. All rights reserved.</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "var(--color-sage-green)" }} />
              <span>Milestone 1 Prototype — Verified Architecture Shell</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Responsive media query helper */}
      <style>{`
        @media (min-width: 768px) {
          .desktop-nav { display: flex !important; }
          .mobile-menu-btn { display: none !important; }
          .mobile-dropdown { display: none !important; }
        }
      `}</style>
    </div>
  );
};
