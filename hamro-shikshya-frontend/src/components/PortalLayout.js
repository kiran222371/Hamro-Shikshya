import { useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import "../styles/PortalLayout.css";

const getInitials = (name) => {
  const words = String(name || "User")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return words.map((word) => word[0]?.toUpperCase()).join("") || "U";
};

export default function PortalLayout({
  role,
  portalName,
  user,
  navigation = [],
  onLogout,
  headerMeta,
  children,
}) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigationItems = Array.isArray(navigation) ? navigation : [];

  const activeItem = useMemo(() => {
    return (
      navigationItems.find((item) => location.pathname === item.to) ||
      navigationItems.find((item) =>
        location.pathname.startsWith(`${item.to}/`)
      ) ||
      navigationItems[0]
    );
  }, [location.pathname, navigationItems]);

  const displayName = user?.name || `${role || "User"} Account`;
  const displayEmail = user?.email || "No email available";

  return (
    <div className="portal-app-shell">
      <button
        type="button"
        className={`portal-sidebar-backdrop ${
          mobileMenuOpen ? "is-visible" : ""
        }`}
        aria-label="Close navigation menu"
        onClick={() => setMobileMenuOpen(false)}
      />

      <aside className={`portal-sidebar ${mobileMenuOpen ? "is-open" : ""}`}>
        <div className="portal-brand-block">
          <div className="portal-brand-mark">HS</div>
          <div>
            <strong>Hamro Shikshya</strong>
            <span>{portalName || `${role || "User"} Portal`}</span>
          </div>
        </div>

        <div className="portal-account-summary">
          <div className="portal-account-avatar">{getInitials(displayName)}</div>

          <div className="portal-account-copy">
            <strong title={displayName}>{displayName}</strong>
            <span title={displayEmail}>{displayEmail}</span>
          </div>
        </div>

        <nav
          className="portal-navigation"
          aria-label={`${role || "User"} portal`}
        >
          <span className="portal-navigation-label">Workspace</span>

          {navigationItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `portal-nav-link ${isActive ? "is-active" : ""}`
              }
              onClick={() => setMobileMenuOpen(false)}
            >
              <span className="portal-nav-icon" aria-hidden="true">
                {item.icon}
              </span>

              <span className="portal-nav-label">{item.label}</span>
              <span className="portal-nav-indicator" aria-hidden="true" />
            </NavLink>
          ))}
        </nav>

        <div className="portal-sidebar-footer">
          <div className="portal-role-chip">
            <span className="portal-status-dot" />
            {String(role || "user").replace(/^./, (letter) =>
              letter.toUpperCase()
            )}
          </div>

          {typeof onLogout === "function" && (
            <button
              type="button"
              className="portal-logout-button"
              onClick={onLogout}
            >
              <span aria-hidden="true">↪</span>
              Logout
            </button>
          )}
        </div>
      </aside>

      <main className="portal-workspace">
        <header className="portal-workspace-header">
          <div className="portal-workspace-heading">
            <button
              type="button"
              className="portal-mobile-menu-button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen(true)}
            >
              ☰
            </button>

            <div>
              <span className="portal-breadcrumb">
                {portalName || `${role || "User"} Portal`}
              </span>
              <h1>{activeItem?.label || "Dashboard"}</h1>
            </div>
          </div>

          <div className="portal-header-actions">
            {headerMeta && (
              <div className="portal-header-meta">{headerMeta}</div>
            )}

            <NotificationBell />
          </div>
        </header>

        <div className="portal-workspace-content">{children}</div>
      </main>
    </div>
  );
}
