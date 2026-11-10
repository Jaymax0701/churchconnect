import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Icon } from "../components/ui/Icon";
import { useAuth } from "../modules/auth/AuthContext";
import { supabase } from "../lib/supabase";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
}

export const PublicLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const { user, profile, signOut, loading, profileError } = useAuth();
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAdminAccess() {
      setIsSuperadmin(false);

      if (!user || loading || profileError || !profile?.is_approved) return;

      const { data, error } = await supabase.rpc("current_user_has_role", {
        required_role: "superadmin",
      });

      if (active) setIsSuperadmin(!error && data === true);
    }

    void checkAdminAccess();
    return () => {
      active = false;
    };
  }, [user?.id, loading, profileError, profile?.is_approved]);

  useEffect(() => {
    if (!accountMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !accountMenuRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAccountMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen]);

  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email || "Member";
  const initials = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? "")
    .join("");

  const accountStatus = loading
    ? "Checking account…"
    : profileError
      ? "Unable to verify account"
      : !profile
        ? "Profile unavailable"
        : profile.is_approved
          ? "Approved member"
          : "Awaiting approval";

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

  const [installHelpOpen, setInstallHelpOpen] = useState(false);

  const handleInstallClick = async () => {
    if (!installPrompt) {
      setInstallHelpOpen(true);
      return;
    }

    try {
      await installPrompt.prompt();
      await installPrompt.userChoice;
      setInstallPrompt(null);
    } catch {
      // Keep installation available through the browser's manual instructions.
      setInstallPrompt(null);
      setInstallHelpOpen(true);
    }
  };

  const installInstructions = (() => {
    const userAgent = window.navigator.userAgent;
    // iPadOS may identify itself as macOS when "Request Desktop Website" is enabled.
    const isIPadOS =
      window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1;
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent) || isIPadOS;
    const isAndroid = /Android/i.test(userAgent);
    const isEdge = /Edg\//i.test(userAgent);

    if (isIOS) {
      return {
        title: "Install on iPhone or iPad",
        steps: [
          "Open ChurchConnect in Safari.",
          "Tap the Share button.",
          'Choose "Add to Home Screen", then tap Add.',
        ],
        note: "If you are using Chrome or another browser on iPhone, open this page in Safari first.",
      };
    }

    if (isAndroid) {
      return {
        title: "Install on Android",
        steps: [
          "Open ChurchConnect in Chrome.",
          "Tap the three-dot menu.",
          'Choose "Install app" or "Add to Home screen".',
        ],
        note: "The wording may vary slightly by Android browser.",
      };
    }

    return {
      title: `Install on this computer`,
      steps: [
        `Open ChurchConnect in ${isEdge ? "Microsoft Edge" : "Google Chrome"}.`,
        "Look for the install icon in the address bar, or open the browser menu.",
        'Choose "Install ChurchConnect" or "Install this site as an app".',
      ],
      note: "If the install option is unavailable, update your browser and reload ChurchConnect.",
    };
  })();

  const handleSignOut = () => {
    setAccountMenuOpen(false);
    setMobileMenuOpen(false);
    void signOut();
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
    <div className="public-layout" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      {/* Top Deep Forest Navigation Header with Modern Frosted Glass */}
      <header
        className="glass-header public-glass-header"
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          className="container public-header-inner"
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
              <div className="public-brand-title" style={{ fontSize: "var(--text-lg)", fontWeight: 700, letterSpacing: "-0.01em", color: "var(--color-white)" }}>
                ChurchConnect
              </div>
              <div className="public-brand-subtitle" style={{ fontSize: "10px", color: "var(--color-soft-sage)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Faith & Community
              </div>
            </div>
          </Link>
          {/* PWA Install Button — visible on desktop and mobile */}
          {!isInstalled && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleInstallClick}
              aria-label="Install ChurchConnect"
              className="public-install-button"
            >
              <Icon name="download" size={16} />
              <span className="install-label">Install App</span>
            </Button>
          )}
          {/* Desktop Navigation */}
          <nav
            style={{ display: "none", alignItems: "center", gap: "var(--space-2)" }}
            className="desktop-nav"
            aria-label="Main navigation"
          >
            <NavLink to="/" style={getNavLinkStyle} end>Home</NavLink>
            {!user && !loading ? (
              <>
                <div style={{ width: "1px", height: "24px", backgroundColor: "rgba(255, 255, 255, 0.15)", margin: "0 var(--space-2)" }} />
                <Link to="/signup" style={{ textDecoration: "none" }}><Button variant="primary" size="sm">Sign Up</Button></Link>
                <Link to="/login" style={{ textDecoration: "none" }}><Button variant="secondary" size="sm">Member Sign In</Button></Link>
              </>
            ) : user ? (
              <div ref={accountMenuRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((open) => !open)}
                  aria-expanded={accountMenuOpen}
                  aria-label={`Account menu for ${displayName}`}
                  className="public-account-trigger"
                  style={{ display: "flex", alignItems: "center", gap: "10px", border: "1px solid rgba(255,255,255,.2)", borderRadius: "999px", padding: "6px 12px", color: "white", background: "rgba(255,255,255,.08)", cursor: "pointer" }}
                >
                  <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--color-soft-sage)", color: "var(--color-deep-forest)", fontWeight: 700 }}>{initials || "M"}</span>
                  <span style={{ textAlign: "left" }}>
                    <strong style={{ display: "block", fontSize: "var(--text-sm)" }}>{displayName}</strong>
                    <small style={{ opacity: .8 }}>{accountStatus}</small>
                  </span>
                  <Icon name="expand_more" size={18} />
                </button>
                {accountMenuOpen && (
                  <div
                    className="public-account-menu" style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", minWidth: 210, padding: 8, background: "var(--color-deep-forest)", border: "1px solid rgba(255,255,255,.18)", borderRadius: "var(--radius-md)", boxShadow: "0 12px 30px rgba(0,0,0,.25)", display: "grid", gap: 4, zIndex: 120 }}
                  >
                    <div style={{ padding: "8px 10px", color: "white", fontSize: "var(--text-xs)", opacity: .75, overflowWrap: "anywhere" }}>{user.email}</div>
                    {profile?.is_approved && <Link to="/portal" onClick={() => setAccountMenuOpen(false)} style={{ ...getNavLinkStyle({ isActive: false }), display: "block" }}>Member Portal</Link>}
                    {isSuperadmin && <Link to="/admin" onClick={() => setAccountMenuOpen(false)} style={{ ...getNavLinkStyle({ isActive: false }), display: "block" }}>Admin Panel</Link>}
                    {profile?.is_approved && <Link to="/portal/settings" onClick={() => setAccountMenuOpen(false)} style={{ ...getNavLinkStyle({ isActive: false }), display: "block" }}>Account Settings</Link>}
                    <button type="button" onClick={handleSignOut} style={{ textAlign: "left", padding: "10px 12px", border: 0, borderRadius: 8, background: "transparent", color: "white", cursor: "pointer" }}>Sign Out</button>
                  </div>
                )}
              </div>
            ) : null}
          </nav>

          {/* Mobile Menu Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
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
            className="mobile-dropdown public-mobile-menu-panel"
          >
            <NavLink to="/" style={getNavLinkStyle} onClick={() => setMobileMenuOpen(false)} end>Home</NavLink>
            {!user && !loading ? <>
              <Link to="/signup" onClick={() => setMobileMenuOpen(false)}><Button variant="primary" size="md" style={{ width: "100%" }}>Sign Up</Button></Link>
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}><Button variant="secondary" size="md" style={{ width: "100%" }}>Member Sign In</Button></Link>
            </> : user ? <>
              <div style={{ padding: "12px", color: "white", borderBottom: "1px solid rgba(255,255,255,.15)" }}>
                <strong>{displayName}</strong>
                <div style={{ fontSize: "var(--text-xs)", opacity: .75 }}>{user.email}</div>
                <div style={{ fontSize: "var(--text-xs)", marginTop: 4 }}>{accountStatus}</div>
              </div>
              {profile?.is_approved && <NavLink to="/portal" style={getNavLinkStyle} onClick={() => setMobileMenuOpen(false)}>Member Portal</NavLink>}
              {isSuperadmin && <NavLink to="/admin" style={getNavLinkStyle} onClick={() => setMobileMenuOpen(false)}>Admin Panel</NavLink>}
              {profile?.is_approved && <NavLink to="/portal/settings" style={getNavLinkStyle} onClick={() => setMobileMenuOpen(false)}>Account Settings</NavLink>}
              <button type="button" onClick={handleSignOut} style={{ textAlign: "left", padding: "12px", border: 0, borderRadius: 8, background: "rgba(255,255,255,.08)", color: "white" }}>Sign Out</button>
            </> : null}
          </div>
        )}
      </header>

      {installHelpOpen && !isInstalled && (
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setInstallHelpOpen(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            display: "grid",
            placeItems: "center",
            padding: 20,
            background: "rgba(0, 0, 0, .62)",
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-help-title"
            style={{
              width: "min(100%, 420px)",
              padding: 24,
              borderRadius: 16,
              background: "var(--bg-page, #fff)",
              color: "var(--color-deep-forest, #18382d)",
              boxShadow: "0 20px 60px rgba(0,0,0,.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 id="install-help-title" style={{ margin: 0, fontSize: 20 }}>{installInstructions.title}</h2>
              <button
                type="button"
                onClick={() => setInstallHelpOpen(false)}
                aria-label="Close installation instructions"
                style={{ border: 0, background: "transparent", color: "inherit", fontSize: 24, cursor: "pointer" }}
              >
                ×
              </button>
            </div>
            <ol style={{ paddingLeft: 22, lineHeight: 1.7 }}>
              {installInstructions.steps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            <p style={{ fontSize: 13, lineHeight: 1.6, opacity: .8 }}>{installInstructions.note}</p>
            <Button variant="primary" size="md" onClick={() => setInstallHelpOpen(false)}>
              Got it
            </Button>
          </section>
        </div>
      )}

      {/* Main Public Page Content */}
      <main style={{ flex: 1, backgroundColor: "var(--bg-page)" }}>
        <Outlet />
      </main>


      {/* Mobile public bottom navigation */}
      <nav className="public-mobile-bottom-nav" aria-label="Public site navigation">
        <NavLink to="/" end className={({ isActive }) => `public-mobile-nav-item${isActive ? " is-active" : ""}`}>
          <Icon name="home" size={21} />
          <span>Home</span>
        </NavLink>
        <a href="/#services" className="public-mobile-nav-item">
          <Icon name="calendar_month" size={21} />
          <span>Services</span>
        </a>
        {user ? (
          <Link to={profile?.is_approved ? "/portal" : "/login"} className="public-mobile-nav-item">
            <Icon name="account_circle" size={21} />
            <span>Member</span>
          </Link>
        ) : (
          <Link to="/login" className="public-mobile-nav-item">
            <Icon name="login" size={21} />
            <span>Sign in</span>
          </Link>
        )}
        <button
          type="button"
          className={`public-mobile-nav-item${mobileMoreOpen ? " is-active" : ""}`}
          aria-expanded={mobileMoreOpen}
          aria-controls="public-mobile-more"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <Icon name={mobileMoreOpen ? "close" : "grid_view"} size={21} />
          <span>More</span>
        </button>
      </nav>

      {mobileMoreOpen && (
        <div className="public-mobile-more-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <section
            id="public-mobile-more"
            className="public-mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More website options"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="public-mobile-more-handle" />
            {user ? (
              <>
                <div className="public-mobile-more-heading">
                  <div><strong>{displayName}</strong><span>{accountStatus}</span></div>
                </div>
                {profile?.is_approved && <Link to="/portal" className="public-mobile-more-link" onClick={() => setMobileMenuOpen(false)}><Icon name="dashboard" size={19} /><span>Member Portal</span><Icon name="chevron_right" size={18} /></Link>}
                {isSuperadmin && <Link to="/admin" className="public-mobile-more-link" onClick={() => setMobileMenuOpen(false)}><Icon name="admin_panel_settings" size={19} /><span>Admin Panel</span><Icon name="chevron_right" size={18} /></Link>}
                {profile?.is_approved && <Link to="/portal/settings" className="public-mobile-more-link" onClick={() => setMobileMenuOpen(false)}><Icon name="settings" size={19} /><span>Account Settings</span><Icon name="chevron_right" size={18} /></Link>}
                <button type="button" className="public-mobile-more-link public-mobile-more-signout" onClick={handleSignOut}><Icon name="logout" size={19} /><span>Sign out</span><Icon name="chevron_right" size={18} /></button>
              </>
            ) : (
              <>
                <Link to="/signup" className="public-mobile-more-link" onClick={() => setMobileMenuOpen(false)}><Icon name="person_add" size={19} /><span>Create an account</span><Icon name="chevron_right" size={18} /></Link>
                <Link to="/login" className="public-mobile-more-link" onClick={() => setMobileMenuOpen(false)}><Icon name="login" size={19} /><span>Member sign in</span><Icon name="chevron_right" size={18} /></Link>
              </>
            )}
          </section>
        </div>
      )}

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
                {user && profile?.is_approved && <li><Link to="/portal" style={{ color: "var(--color-soft-sage)" }}>Member Portal</Link></li>}
                {user && isSuperadmin && <li><Link to="/admin" style={{ color: "var(--color-soft-sage)" }}>Admin Panel</Link></li>}
                {user && profile?.is_approved && <li><Link to="/portal/settings" style={{ color: "var(--color-soft-sage)" }}>Account Settings</Link></li>}
                {!user && !loading && <>
                  <li><Link to="/login" style={{ color: "var(--color-soft-sage)" }}>Member Login</Link></li>
                  <li><Link to="/signup" style={{ color: "var(--color-soft-sage)" }}>Create an Account</Link></li>
                </>}
                {user && profile && !profile.is_approved && <li><Link to="/pending" style={{ color: "var(--color-soft-sage)" }}>Account Status</Link></li>}
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
