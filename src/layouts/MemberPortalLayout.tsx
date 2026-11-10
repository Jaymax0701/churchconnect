import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Icon } from "../components/ui/Icon";
import { Button } from "../components/ui/Button";
import { useAuth } from "../modules/auth/AuthContext";
import { supabase } from "../lib/supabase";

export const MemberPortalLayout: React.FC = () => {
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const [isSuperadmin, setIsSuperadmin] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAdminAccess() {
      if (!user) {
        setIsSuperadmin(false);
        return;
      }

      const { data, error } = await supabase.rpc("current_user_has_role", {
        required_role: "superadmin",
      });

      if (active) setIsSuperadmin(!error && data === true);
    }

    void checkAdminAccess();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const displayName = profile?.full_name || user?.email || "Member";
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

  const getNavLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    color: isActive ? "var(--color-forest-green)" : "var(--color-text-secondary)",
    backgroundColor: isActive ? "var(--color-soft-sage)" : "transparent",
    padding: "var(--space-2) var(--space-4)",
    borderRadius: "var(--radius-md)",
    textDecoration: "none",
    fontWeight: isActive ? 600 : 500,
    fontSize: "var(--text-sm)",
    transition: "all var(--transition-fast)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>
      {/* Top Portal Header */}
      <header
        style={{
          backgroundColor: "var(--color-white)",
          borderBottom: "1px solid var(--border-default)",
          position: "sticky",
          top: 0,
          zIndex: 90,
        }}
      >
        <div
          className="container"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "64px",
          }}
        >
          {/* Logo & Portal Identity */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <Link
              to="/"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-2)",
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "var(--color-forest-green)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="church" size={20} color="var(--color-white)" />
              </div>
              <span style={{ fontSize: "var(--text-base)", fontWeight: 700, color: "var(--color-deep-forest)" }}>
                ChurchConnect
              </span>
            </Link>
            <Badge variant="admin">Member Portal</Badge>
          </div>

          {/* Desktop Navigation */}
          <nav style={{ display: "none", alignItems: "center", gap: "var(--space-1)" }} className="portal-desktop-nav">
            <NavLink to="/portal" style={getNavLinkStyle} end>
              <Icon name="dashboard" size={18} /> Dashboard
            </NavLink>
            <NavLink to="/portal/family" style={getNavLinkStyle}>
              <Icon name="family_restroom" size={18} /> Family Management
            </NavLink>
            <NavLink to="/portal/settings" style={getNavLinkStyle}>
              <Icon name="settings" size={18} /> Account Settings
            </NavLink>
            {isSuperadmin && (
              <NavLink to="/admin" style={getNavLinkStyle}>
                <Icon name="admin_panel_settings" size={18} /> Admin View
              </NavLink>
            )}
            <div style={{ width: "1px", height: "20px", backgroundColor: "var(--color-border)", margin: "0 var(--space-2)" }} />
            <Link
              to="/"
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-secondary)",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Icon name="arrow_back" size={15} /> Public Site
            </Link>
          </nav>

          {/* User Status / Avatar Mock */}
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <div style={{ textAlign: "right", display: "none" }} className="portal-user-meta">
              <div style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: "var(--color-text-primary)" }}>
                {displayName}
              </div>
              <Badge variant="approved">Approved Member</Badge>
            </div>

            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "var(--color-soft-sage)",
                color: "var(--color-forest-green)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
                border: "2px solid var(--color-border)",
              }}
              title={displayName}
            >
              {initials}
            </div>

            <Button className="portal-desktop-signout" variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="portal-main-content" style={{ flex: 1, padding: "var(--space-6) 0 var(--space-12)" }}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="portal-mobile-nav" aria-label="Member portal navigation">
        <NavLink to="/portal" end className={({ isActive }) => `portal-mobile-nav-item${isActive ? " is-active" : ""}`}>
          <Icon name="dashboard" size={21} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/portal/family" className={({ isActive }) => `portal-mobile-nav-item${isActive ? " is-active" : ""}`}>
          <Icon name="family_restroom" size={21} />
          <span>Family</span>
        </NavLink>
        <NavLink to="/portal/settings" className={({ isActive }) => `portal-mobile-nav-item${isActive ? " is-active" : ""}`}>
          <Icon name="account_circle" size={21} />
          <span>Profile</span>
        </NavLink>
        <button
          type="button"
          className={`portal-mobile-nav-item${mobileMoreOpen ? " is-active" : ""}`}
          aria-expanded={mobileMoreOpen}
          aria-controls="portal-mobile-more"
          onClick={() => setMobileMoreOpen((open) => !open)}
        >
          <Icon name={mobileMoreOpen ? "close" : "grid_view"} size={21} />
          <span>More</span>
        </button>
      </nav>

      {mobileMoreOpen && (
        <div className="portal-mobile-more-backdrop" onClick={() => setMobileMoreOpen(false)}>
          <section
            id="portal-mobile-more"
            className="portal-mobile-more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="More member portal options"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="portal-mobile-more-handle" />
            <div className="portal-mobile-more-heading">
              <div>
                <strong>{displayName}</strong>
                <span>Member account</span>
              </div>
              <Badge variant="approved">Approved</Badge>
            </div>
            {isSuperadmin && (
              <Link to="/admin" className="portal-mobile-more-link" onClick={() => setMobileMoreOpen(false)}>
                <Icon name="admin_panel_settings" size={19} />
                <span>Admin View</span>
                <Icon name="chevron_right" size={18} />
              </Link>
            )}
            <Link to="/" className="portal-mobile-more-link" onClick={() => setMobileMoreOpen(false)}>
              <Icon name="language" size={19} />
              <span>Public Website</span>
              <Icon name="chevron_right" size={18} />
            </Link>
            <button
              type="button"
              className="portal-mobile-more-link portal-mobile-more-signout"
              onClick={() => {
                setMobileMoreOpen(false);
                void signOut();
              }}
            >
              <Icon name="logout" size={19} />
              <span>Sign out</span>
              <Icon name="chevron_right" size={18} />
            </button>
          </section>
        </div>
      )}

      <style>{`
        @media (min-width: 768px) {
          .portal-desktop-nav { display: flex !important; }
          .portal-user-meta { display: block !important; }
          .portal-mobile-nav,
          .portal-mobile-more-backdrop { display: none !important; }
        }
      `}</style>
    </div>
  );
};
