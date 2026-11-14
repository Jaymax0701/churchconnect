import React, { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { Badge } from "../components/ui/Badge";
import { Icon } from "../components/ui/Icon";
import { Button } from "../components/ui/Button";
import { useAuth } from "../modules/auth/AuthContext";
import { supabase } from "../lib/supabase";

export const MemberPortalLayout: React.FC = () => {
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileExpanded, setProfileExpanded] = useState(false);
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
  const shortName = displayName.trim().split(/\s+/)[0] || "Member";
  const initials = displayName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");

  const getNavLinkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    color: isActive ? "var(--color-white)" : "rgba(255, 255, 255, 0.82)",
    backgroundColor: isActive ? "var(--color-forest-green)" : "transparent",
    padding: "var(--space-3) var(--space-4)",
    borderRadius: "var(--radius-md)",
    textDecoration: "none",
    fontWeight: isActive ? 600 : 500,
    fontSize: "var(--text-sm)",
    transition: "all var(--transition-fast)",
  });

  const closeMobileSidebar = () => setMobileSidebarOpen(false);

  const sidebarNav = (
    <>
      <div className="portal-sidebar-section-label">Member space</div>
      <NavLink to="/portal" style={getNavLinkStyle} end onClick={closeMobileSidebar}>
        <Icon name="dashboard" size={19} /> Dashboard
      </NavLink>
      <NavLink to="/portal/family" style={getNavLinkStyle} onClick={closeMobileSidebar}>
        <Icon name="family_restroom" size={19} /> Family Management
      </NavLink>
      <NavLink to="/portal/settings" style={getNavLinkStyle} onClick={closeMobileSidebar}>
        <Icon name="settings" size={19} /> Account Settings
      </NavLink>
      {isSuperadmin && (
        <>
          <div className="portal-sidebar-section-label portal-sidebar-secondary-label">Administration</div>
          <Link to="/admin" style={{ ...getNavLinkStyle({ isActive: false }), color: "var(--color-soft-sage)" }} onClick={closeMobileSidebar}>
            <Icon name="admin_panel_settings" size={19} /> Admin View
          </Link>
        </>
      )}
      <div className="portal-sidebar-section-label portal-sidebar-secondary-label">Explore</div>
      <Link to="/" style={{ ...getNavLinkStyle({ isActive: false }), color: "var(--color-soft-sage)" }} onClick={closeMobileSidebar}>
        <Icon name="language" size={19} /> Public Website
      </Link>
    </>
  );

  return (
    <div className="portal-shell" style={{ display: "flex", minHeight: "100vh", backgroundColor: "var(--bg-page)" }}>
      <aside className="portal-sidebar">
        <div className="portal-sidebar-brand">
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", textDecoration: "none", color: "var(--color-white)" }}>
            <span className="portal-brand-icon"><Icon name="church" size={20} color="var(--color-white)" /></span>
            <span>
              <strong style={{ display: "block", fontSize: "var(--text-base)" }}>ChurchConnect</strong>
              <small>Member Portal</small>
            </span>
          </Link>
        </div>

        <nav className="portal-sidebar-nav" aria-label="Member portal navigation">
          {sidebarNav}
        </nav>

        <div className="portal-sidebar-footer">
          <button
            type="button"
            className="portal-profile-toggle"
            aria-expanded={profileExpanded}
            onClick={() => setProfileExpanded((expanded) => !expanded)}
            title="Click to view your full account name"
          >
            <span className="portal-avatar">{initials}</span>
            <span className="portal-profile-short-name">{shortName}</span>
            <Icon name={profileExpanded ? "chevron_up" : "chevron_down"} size={17} />
          </button>
          {profileExpanded && (
            <div className="portal-profile-expanded">
              <strong>{displayName}</strong>
              {user?.email && <span>{user.email}</span>}
              <Badge variant="approved">Approved Member</Badge>
              <button type="button" onClick={() => void signOut()}>
                <Icon name="logout" size={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="portal-main-column" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <header className="portal-topbar">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", minWidth: 0 }}>
            <button
              type="button"
              className="portal-mobile-sidebar-toggle"
              aria-label="Open member portal navigation"
              aria-expanded={mobileSidebarOpen}
              onClick={() => setMobileSidebarOpen((open) => !open)}
            >
              <Icon name={mobileSidebarOpen ? "close" : "menu"} size={22} />
            </button>
            <div>
              <strong className="portal-topbar-title">Member Portal</strong>
              <span className="portal-topbar-subtitle">Your ChurchConnect space</span>
            </div>
          </div>
          <div className="portal-topbar-actions">
            <span className="portal-topbar-name" title={displayName}>{shortName}</span>
            <span className="portal-avatar portal-topbar-avatar" title={displayName}>{initials}</span>
            <Button className="portal-desktop-signout" variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
          </div>
        </header>

        {mobileSidebarOpen && (
          <div className="portal-mobile-sidebar">
            {sidebarNav}
            <div className="portal-mobile-sidebar-account">
              <strong>{displayName}</strong>
              {user?.email && <span>{user.email}</span>}
              <Badge variant="approved">Approved Member</Badge>
              <Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button>
            </div>
          </div>
        )}

        <main className="portal-main-content" style={{ flex: 1, padding: "var(--space-6) 0 var(--space-12)" }}>
          <div className="container">
            <Outlet />
          </div>
        </main>
      </div>

      <nav className="portal-mobile-nav" aria-label="Member portal navigation">
        <NavLink to="/portal" end className={({ isActive }) => `portal-mobile-nav-item${isActive ? " is-active" : ""}`}>
          <Icon name="dashboard" size={21} /><span>Home</span>
        </NavLink>
        <NavLink to="/portal/family" className={({ isActive }) => `portal-mobile-nav-item${isActive ? " is-active" : ""}`}>
          <Icon name="family_restroom" size={21} /><span>Family</span>
        </NavLink>
        <NavLink to="/portal/settings" className={({ isActive }) => `portal-mobile-nav-item${isActive ? " is-active" : ""}`}>
          <Icon name="account_circle" size={21} /><span>Profile</span>
        </NavLink>
        <button
          type="button"
          className={`portal-mobile-nav-item${mobileMoreOpen ? " is-active" : ""}`}
          aria-expanded={mobileMoreOpen}
          aria-controls="portal-mobile-more"
          onClick={() => setMobileMoreOpen((open) => !open)}
        >
          <Icon name={mobileMoreOpen ? "close" : "grid_view"} size={21} /><span>More</span>
        </button>
      </nav>

      {mobileMoreOpen && (
        <div className="portal-mobile-more-backdrop" onClick={() => setMobileMoreOpen(false)}>
          <section id="portal-mobile-more" className="portal-mobile-more-sheet" role="dialog" aria-modal="true" aria-label="More member portal options" onClick={(event) => event.stopPropagation()}>
            <div className="portal-mobile-more-handle" />
            <div className="portal-mobile-more-heading">
              <div><strong>{displayName}</strong><span>Member account</span></div>
              <Badge variant="approved">Approved</Badge>
            </div>
            {isSuperadmin && (
              <Link to="/admin" className="portal-mobile-more-link" onClick={() => setMobileMoreOpen(false)}>
                <Icon name="admin_panel_settings" size={19} /><span>Admin View</span><Icon name="chevron_right" size={18} />
              </Link>
            )}
            <Link to="/" className="portal-mobile-more-link" onClick={() => setMobileMoreOpen(false)}>
              <Icon name="language" size={19} /><span>Public Website</span><Icon name="chevron_right" size={18} />
            </Link>
            <button type="button" className="portal-mobile-more-link portal-mobile-more-signout" onClick={() => { setMobileMoreOpen(false); void signOut(); }}>
              <Icon name="logout" size={19} /><span>Sign out</span><Icon name="chevron_right" size={18} />
            </button>
          </section>
        </div>
      )}

      <style>{`
        .portal-sidebar {
          width: 252px;
          flex: 0 0 252px;
          background: var(--color-deep-forest);
          color: var(--color-white);
          display: none;
          flex-direction: column;
          min-height: 100vh;
        }
        .portal-sidebar-brand {
          min-height: 70px;
          display: flex;
          align-items: center;
          padding: 0 var(--space-5);
          border-bottom: 1px solid rgba(255,255,255,.1);
        }
        .portal-brand-icon {
          width: 34px;
          height: 34px;
          border-radius: var(--radius-md);
          background: var(--color-forest-green);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .portal-sidebar-brand small {
          display: block;
          margin-top: 2px;
          color: var(--color-soft-sage);
          font-size: 10px;
          letter-spacing: .07em;
          text-transform: uppercase;
        }
        .portal-sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          padding: var(--space-4) var(--space-3);
          flex: 1;
        }
        .portal-sidebar-section-label {
          padding: var(--space-2) var(--space-3);
          color: rgba(255,255,255,.42);
          font-size: 10px;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .portal-sidebar-secondary-label { padding-top: var(--space-5); }
        .portal-sidebar-footer {
          padding: var(--space-4);
          border-top: 1px solid rgba(255,255,255,.1);
        }
        .portal-profile-toggle {
          display: flex;
          align-items: center;
          width: 100%;
          gap: var(--space-3);
          padding: var(--space-2);
          border: 0;
          border-radius: var(--radius-md);
          color: white;
          background: transparent;
          text-align: left;
          cursor: pointer;
        }
        .portal-profile-toggle:hover { background: rgba(255,255,255,.08); }
        .portal-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          flex: 0 0 36px;
          background: var(--color-forest-green);
          color: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: var(--text-sm);
          font-weight: 700;
        }
        .portal-profile-short-name {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: var(--text-sm);
          font-weight: 600;
        }
        .portal-profile-expanded {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-2) 0;
          overflow-wrap: anywhere;
          font-size: var(--text-xs);
          color: rgba(255,255,255,.8);
        }
        .portal-profile-expanded strong { color: white; font-size: var(--text-sm); }
        .portal-profile-expanded button {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) 0;
          border: 0;
          background: transparent;
          color: white;
          text-align: left;
          cursor: pointer;
        }
        .portal-topbar {
          min-height: 70px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-4);
          padding: 0 var(--space-6);
          background: white;
          border-bottom: 1px solid var(--border-default);
          position: sticky;
          top: 0;
          z-index: 80;
        }
        .portal-topbar-title { display: block; color: var(--color-deep-forest); font-size: var(--text-base); }
        .portal-topbar-subtitle { display: block; color: var(--color-text-secondary); font-size: var(--text-xs); }
        .portal-topbar-actions { display: flex; align-items: center; gap: var(--space-3); }
        .portal-topbar-name { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--text-sm); font-weight: 600; }
        .portal-topbar-avatar { width: 32px; height: 32px; flex-basis: 32px; }
        .portal-mobile-sidebar-toggle {
          display: none;
          align-items: center;
          justify-content: center;
          border: 0;
          background: transparent;
          color: var(--color-text-primary);
          padding: var(--space-2);
          cursor: pointer;
        }
        .portal-mobile-sidebar { display: none; }
        @media (min-width: 992px) {
          .portal-sidebar { display: flex; }
          .portal-mobile-nav, .portal-mobile-more-backdrop, .portal-mobile-sidebar-toggle, .portal-mobile-sidebar { display: none !important; }
        }
        @media (max-width: 991px) {
          .portal-mobile-sidebar-toggle { display: inline-flex; }
          .portal-mobile-sidebar {
            display: flex;
            flex-direction: column;
            gap: var(--space-1);
            padding: var(--space-3);
            background: var(--color-deep-forest);
            color: white;
          }
          .portal-mobile-sidebar-account {
            display: flex;
            flex-direction: column;
            gap: var(--space-2);
            padding: var(--space-3);
            margin-top: var(--space-2);
            border-top: 1px solid rgba(255,255,255,.14);
            color: white;
            font-size: var(--text-xs);
          }
          .portal-mobile-sidebar-account strong { font-size: var(--text-sm); }
        }
        @media (max-width: 480px) {
          .portal-topbar { min-height: 60px; padding: 0 var(--space-3); }
          .portal-topbar-subtitle { display: none; }
          .portal-topbar-name { max-width: 90px; }
          .portal-desktop-signout { display: none; }
        }
      `}</style>
    </div>
  );
};
