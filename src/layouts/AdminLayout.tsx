import React, { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Icon } from "../components/ui/Icon";
import { Button } from "../components/ui/Button";
import { useAuth } from "../modules/auth/AuthContext";

export const AdminLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarCollapsed, setDesktopSidebarCollapsed] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const { user, profile, signOut } = useAuth();
  const displayName = profile?.full_name || user?.email || "Administrator";
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

  const getAdminNavLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: desktopSidebarCollapsed ? 0 : "var(--space-3)",
    justifyContent: desktopSidebarCollapsed ? "center" : "flex-start",
    padding: desktopSidebarCollapsed ? "var(--space-3)" : "var(--space-3) var(--space-4)",
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
          width: desktopSidebarCollapsed ? "76px" : "260px",
          transition: "width 180ms ease",
          backgroundColor: "var(--color-deep-forest)",
          color: "var(--color-white)",
          display: "none",
          flexDirection: "column",
          flexShrink: 0,
        }}
        className={`admin-sidebar admin-glass-sidebar${desktopSidebarCollapsed ? " is-collapsed" : ""}`}
      >
        {/* Sidebar Brand Header */}
        <div
          style={{
            height: "70px",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-2)",
            padding: desktopSidebarCollapsed ? 0 : "0 var(--space-6)",
            justifyContent: desktopSidebarCollapsed ? "center" : "flex-start",
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
          {!desktopSidebarCollapsed && <div>
            <div style={{ fontWeight: 700, fontSize: "var(--text-base)", letterSpacing: "-0.01em" }}>ChurchConnect</div>
            <div style={{ fontSize: "10px", color: "var(--color-soft-sage)", textTransform: "uppercase" }}>Administration</div>
          </div>}
          <button type="button" onClick={() => setDesktopSidebarCollapsed((collapsed) => !collapsed)} aria-label={desktopSidebarCollapsed ? "Expand admin sidebar" : "Collapse admin sidebar"} title={desktopSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} className="admin-sidebar-collapse-toggle">
            <Icon name={desktopSidebarCollapsed ? "chevron_right" : "chevron_left"} size={18} />
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <nav style={{ padding: "var(--space-4) var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-1)", flex: 1 }}>
          {!desktopSidebarCollapsed && <div style={{ padding: "var(--space-2) var(--space-3)", fontSize: "11px", color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Management</div>}
          <NavLink to="/admin" style={getAdminNavLinkStyle} end>
            <Icon name="dashboard" size={18} /> {!desktopSidebarCollapsed && <span>Dashboard</span>}
          </NavLink>
          <NavLink to="/admin/users" style={getAdminNavLinkStyle}>
            <Icon name="group" size={18} /> {!desktopSidebarCollapsed && <span>User Accounts</span>}
          </NavLink>
          <a href="#ministries" style={{ ...getAdminNavLinkStyle({ isActive: false }), opacity: 0.9 }}>
            <Icon name="church" size={18} /> {!desktopSidebarCollapsed && <span>Ministries</span>}
          </a>
          <a href="#events" style={{ ...getAdminNavLinkStyle({ isActive: false }), opacity: 0.9 }}>
            <Icon name="event" size={18} /> {!desktopSidebarCollapsed && <span>Events & Services</span>}
          </a>
          <a href="#permissions" style={{ ...getAdminNavLinkStyle({ isActive: false }), opacity: 0.9 }}>
            <Icon name="shield_person" size={18} /> {!desktopSidebarCollapsed && <span>Permission Matrix</span>}
          </a>

          {!desktopSidebarCollapsed && <div style={{ padding: "var(--space-4) var(--space-3) var(--space-2)", fontSize: "11px", color: "rgba(255, 255, 255, 0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Navigation</div>}
          <Link to="/portal" title="Member Portal" style={{ ...getAdminNavLinkStyle({ isActive: false }), color: "var(--color-soft-sage)" }}>
            <Icon name="account_circle" size={18} /> {!desktopSidebarCollapsed && <span>Member Portal</span>}
          </Link>
          <Link to="/" title="Public Website" style={{ ...getAdminNavLinkStyle({ isActive: false }), color: "var(--color-soft-sage)" }}>
            <Icon name="language" size={18} /> {!desktopSidebarCollapsed && <span>Public Website</span>}
          </Link>
        </nav>

        {/* Sidebar Footer User Info */}
        <div style={{ padding: desktopSidebarCollapsed ? "var(--space-3)" : "var(--space-4)", borderTop: "1px solid rgba(255, 255, 255, 0.1)" }}>
          <div className="admin-header-actions" style={{ display: "flex", alignItems: "center", gap: desktopSidebarCollapsed ? 0 : "var(--space-3)", flexShrink: 0, justifyContent: desktopSidebarCollapsed ? "center" : "flex-start" }}>
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
            {!desktopSidebarCollapsed && <div>
              <div style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>{displayName}</div>
              <Badge variant="superadmin">SUPERADMIN</Badge>
            </div>}
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
              <Icon name="dashboard" size={18} /> {!desktopSidebarCollapsed && <span>Dashboard</span>}
            </NavLink>
            <NavLink to="/admin/users" style={getAdminNavLinkStyle} onClick={() => setSidebarOpen(false)}>
              <Icon name="group" size={18} /> {!desktopSidebarCollapsed && <span>User Accounts</span>}
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


      {/* Mobile admin bottom navigation */}
      <nav className="admin-mobile-bottom-nav" aria-label="Administration navigation">
        <NavLink to="/admin" end className={({ isActive }) => `admin-mobile-nav-item${isActive ? " is-active" : ""}`}>
          <Icon name="dashboard" size={21} /><span>Dashboard</span>
        </NavLink>
        <NavLink to="/admin/users" className={({ isActive }) => `admin-mobile-nav-item${isActive ? " is-active" : ""}`}>
          <Icon name="group" size={21} /><span>Users</span>
        </NavLink>
        <button type="button" className={`admin-mobile-nav-item${mobileMoreOpen ? " is-active" : ""}`} aria-expanded={mobileMoreOpen} aria-controls="admin-mobile-more" onClick={() => setMobileMoreOpen((open) => !open)}>
          <Icon name={mobileMoreOpen ? "close" : "grid_view"} size={21} /><span>More</span>
        </button>
      </nav>

      {mobileMoreOpen && (
        <div className="admin-mobile-more-backdrop" onClick={() => setMobileMoreOpen(false)}>
          <section id="admin-mobile-more" className="admin-mobile-more-sheet" role="dialog" aria-modal="true" aria-label="More administration options" onClick={(event) => event.stopPropagation()}>
            <div className="admin-mobile-more-handle" />
            <div className="admin-mobile-more-heading"><strong>Administration</strong><span>Manage ChurchConnect</span></div>
            <a href="#ministries" className="admin-mobile-more-link" onClick={() => setMobileMoreOpen(false)}><Icon name="church" size={19} /><span>Ministries</span><Icon name="chevron_right" size={18} /></a>
            <a href="#events" className="admin-mobile-more-link" onClick={() => setMobileMoreOpen(false)}><Icon name="event" size={19} /><span>Events & Services</span><Icon name="chevron_right" size={18} /></a>
            <a href="#permissions" className="admin-mobile-more-link" onClick={() => setMobileMoreOpen(false)}><Icon name="shield_person" size={19} /><span>Permission Matrix</span><Icon name="chevron_right" size={18} /></a>
            <Link to="/portal" className="admin-mobile-more-link" onClick={() => setMobileMoreOpen(false)}><Icon name="account_circle" size={19} /><span>Member Portal</span><Icon name="chevron_right" size={18} /></Link>
            <Link to="/" className="admin-mobile-more-link" onClick={() => setMobileMoreOpen(false)}><Icon name="language" size={19} /><span>Public Website</span><Icon name="chevron_right" size={18} /></Link>
            <button type="button" className="admin-mobile-more-link admin-mobile-more-signout" onClick={() => { setMobileMoreOpen(false); void signOut(); }}><Icon name="logout" size={19} /><span>Sign out</span><Icon name="chevron_right" size={18} /></button>
          </section>
        </div>
      )}

      <style>{`
        @media (min-width: 992px) {
          .admin-sidebar { display: flex !important; }
          .admin-sidebar-collapse-toggle { margin-left: auto; border: 1px solid rgba(255,255,255,.18); color: white; background: rgba(255,255,255,.08); border-radius: 8px; width: 30px; height: 30px; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
          .admin-sidebar.is-collapsed nav { padding-left: 8px !important; padding-right: 8px !important; }
          .admin-sidebar.is-collapsed nav a { justify-content: center; padding-left: 8px !important; padding-right: 8px !important; }
          .admin-sidebar.is-collapsed .admin-sidebar-collapse-toggle { margin-left: 0; }
          .admin-mobile-toggle { display: none !important; }
          .admin-mobile-nav { display: none !important; }
        }
      `}</style>
    </div>
  );
};
