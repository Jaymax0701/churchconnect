import React, { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import { Icon } from "../components/ui/Icon";

export const MemberPortalLayout: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
            <NavLink to="/admin" style={getNavLinkStyle}>
              <Icon name="admin_panel_settings" size={18} /> Admin View
            </NavLink>
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
                Sarah Miller
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
              title="Demo Member"
            >
              SM
            </div>

            {/* Mobile Hamburger */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="portal-mobile-btn"
              aria-label="Toggle portal menu"
              style={{ padding: "var(--space-2)", color: "var(--color-text-primary)", display: "flex", alignItems: "center" }}
            >
              <Icon name={mobileMenuOpen ? "close" : "menu"} size={24} />
            </button>
          </div>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div
            style={{
              padding: "var(--space-4)",
              backgroundColor: "var(--color-white)",
              borderTop: "1px solid var(--border-default)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
            className="portal-mobile-dropdown"
          >
            <div style={{ paddingBottom: "var(--space-2)", borderBottom: "1px solid var(--border-default)" }}>
              <div style={{ fontWeight: 600 }}>Sarah Miller</div>
              <Badge variant="approved">Approved Member (Demo)</Badge>
            </div>
            <NavLink to="/portal" style={getNavLinkStyle} onClick={() => setMobileMenuOpen(false)} end>
              <Icon name="dashboard" size={18} /> Dashboard
            </NavLink>
            <NavLink to="/admin" style={getNavLinkStyle} onClick={() => setMobileMenuOpen(false)}>
              <Icon name="admin_panel_settings" size={18} /> Admin View
            </NavLink>
            <Link to="/" style={{ padding: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-forest-green)", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Icon name="arrow_back" size={16} /> Return to Public Website
            </Link>
          </div>
        )}
      </header>

      {/* Global Demo Notice for Member Portal */}
      <div className="container" style={{ paddingTop: "var(--space-4)" }}>
        <Alert variant="info" title="Development Demo Mode">
          Viewing preview member interface. Real authentication and Supabase database authorization will be connected in Milestone 3.
        </Alert>
      </div>

      {/* Main Content View */}
      <main style={{ flex: 1, padding: "var(--space-6) 0 var(--space-12)" }}>
        <div className="container">
          <Outlet />
        </div>
      </main>

      <style>{`
        @media (min-width: 768px) {
          .portal-desktop-nav { display: flex !important; }
          .portal-user-meta { display: block !important; }
          .portal-mobile-btn { display: none !important; }
          .portal-mobile-dropdown { display: none !important; }
        }
      `}</style>
    </div>
  );
};
