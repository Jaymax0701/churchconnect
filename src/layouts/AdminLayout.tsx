import React, { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Icon } from "../components/ui/Icon";
import { Button } from "../components/ui/Button";
import { useAuth } from "../modules/auth/AuthContext";

export const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const displayName = profile?.full_name || user?.email || "Administrator";
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

  const getAdminNavLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    padding: "var(--space-3) var(--space-4)",
    borderRadius: "var(--radius-md)",
    color: isActive ? "var(--color-white)" : "rgba(255, 255, 255, 0.8)",
    backgroundColor: isActive ? "var(--color-forest-green)" : "transparent",
    textDecoration: "none",
    fontWeight: isActive ? 600 : 500,
    fontSize: "var(--text-sm)",
    transition: "all var(--transition-fast)",
  });

  return (
    <div className="admin-shell" style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>
      {/* Admin Sidebar (Deep Forest Desktop) */}
      <aside
        style={{
          width: "260px",
          backgroundColor: "var(--color-deep-forest)",
          color: "var(--color-white)",
          display: "none",
          flexDirection: "column",
          flexShrink: 0,
        }}
        className="admin-sidebar admin-glass-sidebar"
      >
        {/* Sidebar Brand Header */}
        <div
          style={{
            height: "70px",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: "0 var(--space-6)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
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
          <div>
            <div style={{ fontWeight: 700, fontSize: "var(--text-base)", letterSpacing: "-0.01em" }}>ChurchConnect</div>
            <div style={{ fontSize: "10px", color: "var(--color-soft-sage)", textTransform: "uppercase" }}>Administration</div>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav style={{ padding: "var(--space-4) var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-1)", flex: 1 }}>
          <div style={{ padding: "var(--space-2) var(--space-3)", fontSize: "11px", color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Management
          </div>
          <NavLink to="/admin" style={getAdminNavLinkStyle} end>
            <Icon name="dashboard" size={18} /> Dashboard
          </NavLink>
          <NavLink to="/admin/users" style={getAdminNavLinkStyle}>
            <Icon name="group" size={18} /> User Accounts
          </NavLink>
          <a href="#ministries" style={{ ...getAdminNavLinkStyle({ isActive: false }), opacity: 0.9 }}>
            <Icon name="church" size={18} /> Ministries
          </a>
          <a href="#events" style={{ ...getAdminNavLinkStyle({ isActive: false }), opacity: 0.9 }}>
            <Icon name="event" size={18} /> Events & Services
          </a>
          <a href="#permissions" style={{ ...getAdminNavLinkStyle({ isActive: false }), opacity: 0.9 }}>
            <Icon name="shield_person" size={18} /> Permission Matrix
          </a>

          <div style={{ padding: "var(--space-4) var(--space-3) var(--space-2)", fontSize: "11px", color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Navigation
          </div>
          <Link to="/portal" style={{ ...getAdminNavLinkStyle({ isActive: false }), color: "var(--color-soft-sage)" }}>
            <Icon name="account_circle" size={18} /> Member Portal
          </Link>
          <Link to="/" style={{ ...getAdminNavLinkStyle({ isActive: false }), color: "var(--color-soft-sage)" }}>
            <Icon name="language" size={18} /> Public Website
          </Link>
        </nav>

        {/* Sidebar Footer User Info */}
        <div style={{ padding: "var(--space-4)", borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div className="admin-header-actions" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", flexShrink: 0 }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "50%",
                backgroundColor: "var(--color-forest-green)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 600,
                fontSize: "var(--text-sm)",
              }}
            >
              {initials}
            </div>
            <div>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>{displayName}</div>
              <Badge variant="superadmin">SUPERADMIN</Badge>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Admin Content Wrapper */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Admin Top Header */}
        <header
          style={{
            height: "70px",
            backgroundColor: "var(--color-white)",
            borderBottom: "1px solid var(--border-default)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 var(--space-6)",
            position: "sticky",
            top: 0,
            zIndex: 80,
          }}
          className="admin-header admin-glass-header"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", minWidth: 0 }}>
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className="admin-mobile-toggle"
              aria-label="Toggle admin sidebar"
              style={{ padding: "var(--space-2)", color: "var(--color-text-primary)", display: "flex", alignItems: "center" }}
            >
              <Icon name={sidebarOpen ? "close" : "menu"} size={24} />
            </button>
            <div>
              <h1 style={{ fontSize: "var(--text-lg)", fontWeight: 700, margin: 0 }}>
                Church Administration Console
              </h1>
              <div className="admin-header-subtitle" style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                ChurchConnect System Control Center
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <Badge variant="superadmin">SUPERADMIN</Badge>
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
          </div>
        </header>

        {/* Mobile Dropdown Nav */}
        {sidebarOpen && (
          <div
            style={{
              backgroundColor: "var(--color-deep-forest)",
              padding: "var(--space-4)",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-2)",
            }}
            className="admin-mobile-nav admin-glass-mobile-nav"
          >
            <NavLink to="/admin" style={getAdminNavLinkStyle} onClick={() => setSidebarOpen(false)} end>
              <Icon name="dashboard" size={18} /> Dashboard
            </NavLink>
            <NavLink to="/admin/users" style={getAdminNavLinkStyle} onClick={() => setSidebarOpen(false)}>
              <Icon name="group" size={18} /> User Accounts
            </NavLink>
            <Link to="/portal" style={getAdminNavLinkStyle({ isActive: false })} onClick={() => setSidebarOpen(false)}>
              <Icon name="account_circle" size={18} /> Switch to Member Portal
            </Link>
            <Link to="/" style={getAdminNavLinkStyle({ isActive: false })} onClick={() => setSidebarOpen(false)}>
              <Icon name="language" size={18} /> Switch to Public Website
            </Link>
          </div>
        )}

        {/* Content Outlet */}
        <main className="admin-content" style={{ flex: 1, padding: "var(--space-6)", minWidth: 0 }}>
          <Outlet />
        </main>
      </div>

      <style>{`
        @media (min-width: 992px) {
          .admin-sidebar { display: flex !important; }
          .admin-mobile-toggle { display: none !important; }
          .admin-mobile-nav { display: none !important; }
        }
      `}</style>
    </div>
  );
};
