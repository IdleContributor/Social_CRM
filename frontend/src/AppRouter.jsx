import { useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import { useTheme } from "./ThemeContext.jsx";
import { usePlatformSessions } from "./hooks/usePlatformSessions.js";
import HomePage from "./pages/HomePage.jsx";
import FacebookPage from "./pages/FacebookPage.jsx";
import ThreadsPage from "./pages/ThreadsPage.jsx";
import LinkedInPage from "./pages/LinkedInPage.jsx";
import BroadcastPage from "./pages/BroadcastPage.jsx";
import XPage from "./pages/XPage.jsx";
import InstagramPage from "./pages/InstagramPage.jsx";
import { LogOut, Sun, Moon, Menu } from "lucide-react";

const NAV_PLATFORMS = [
  { id: "facebook",  label: "Facebook",  icon: "f",  bg: "#1877f2" },
  { id: "threads",   label: "Threads",   icon: "@",  bg: "#101010" },
  { id: "instagram", label: "Instagram", icon: "◈",  bg: "linear-gradient(135deg,#f58529,#dd2a7b)" },
  { id: "linkedin",  label: "LinkedIn",  icon: "in", bg: "#0a66c2" },
  { id: "x",         label: "X",         icon: "𝕏",  bg: "#000" },
];

const MOBILE_TABS = [
  { id: "home",      icon: "◉", label: "Home" },
  { id: "facebook",  icon: "f", label: "FB",     bg: "#1877f2" },
  { id: "threads",   icon: "@", label: "Threads", bg: "#101010" },
  { id: "instagram", icon: "◈", label: "IG",      bg: "linear-gradient(135deg,#f58529,#dd2a7b)" },
  { id: "x",         icon: "𝕏", label: "X",       bg: "#000" },
  { id: "broadcast", icon: "✦", label: "All",     bg: "linear-gradient(135deg,#7c3aed,#4f46e5)" },
];

function Sidebar({ view, setView, sessions, signOut, user, collapsed }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <aside className={`sidebar${collapsed ? " sidebar-collapsed" : ""}`}>
      {/* Nav */}
      <nav className="sidebar-nav">
        {/* Overview */}
        <button
          className={`sidebar-item${view === "home" ? " active" : ""}`}
          onClick={() => setView("home")}
          title={collapsed ? "Overview" : undefined}
        >
          <span className="sidebar-item-icon"
            style={view !== "home" ? { background: "var(--surface-2)", color: "var(--text-secondary)" } : {}}>
            ◉
          </span>
          {!collapsed && "Overview"}
        </button>

        {!collapsed && <div className="sidebar-section-label">Platforms</div>}
        {collapsed && <div style={{ height: 12 }} />}

        {NAV_PLATFORMS.map((p) => (
          <button
            key={p.id}
            className={`sidebar-item${view === p.id ? " active" : ""}`}
            onClick={() => setView(p.id)}
            title={collapsed ? p.label : undefined}
          >
            <span className="sidebar-item-icon"
              style={view !== p.id ? { background: p.bg, color: "#fff" } : {}}>
              {p.icon}
            </span>
            {!collapsed && p.label}
            {!collapsed && (
              <span className={`sidebar-item-dot ${sessions[p.id] ? "connected" : "disconnected"}`} />
            )}
          </button>
        ))}

        {!collapsed && <div className="sidebar-section-label">Tools</div>}
        {collapsed && <div style={{ height: 12 }} />}

        <button
          className={`sidebar-item${view === "broadcast" ? " active" : ""}`}
          onClick={() => setView("broadcast")}
          title={collapsed ? "Post to All" : undefined}
        >
          <span className="sidebar-item-icon"
            style={view !== "broadcast" ? { background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "#fff" } : {}}>
            ✦
          </span>
          {!collapsed && "Post to All"}
        </button>
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {/* User avatar — always show, name/email only when expanded */}
        {user && (
          <div style={{
            display: "flex", alignItems: "center",
            gap: collapsed ? 0 : 8,
            padding: collapsed ? "8px 0" : "8px 4px",
            marginBottom: 8,
            justifyContent: collapsed ? "center" : "flex-start",
          }}>
            {user.picture && (
              <img src={user.picture} alt={user.name} title={collapsed ? user.name : undefined}
                style={{ width: 30, height: 30, borderRadius: "50%",
                  border: "1.5px solid var(--app-border)", flexShrink: 0 }} />
            )}
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email}
                </div>
              </div>
            )}
          </div>
        )}

        <button className="btn btn-ghost btn-sm"
          onClick={toggleTheme}
          title={collapsed ? (isDark ? "Light mode" : "Dark mode") : undefined}
          style={{ width: "100%", justifyContent: collapsed ? "center" : "flex-start",
            gap: 8, marginBottom: 4, padding: collapsed ? "8px 0" : undefined }}>
          {isDark ? <Sun size={14} /> : <Moon size={14} />}
          {!collapsed && (isDark ? "Light mode" : "Dark mode")}
        </button>

        <button className="btn btn-ghost btn-sm"
          onClick={signOut}
          title={collapsed ? "Sign out" : undefined}
          style={{ width: "100%", justifyContent: collapsed ? "center" : "flex-start",
            gap: 8, color: "var(--red)", padding: collapsed ? "8px 0" : undefined }}>
          <LogOut size={14} />
          {!collapsed && "Sign out"}
        </button>
      </div>
    </aside>
  );
}

function MobileTabBar({ view, setView }) {
  return (
    <nav className="mobile-tabbar">
      {MOBILE_TABS.map((t) => (
        <button
          key={t.id}
          className={`mobile-tab${view === t.id ? " active" : ""}`}
          onClick={() => setView(t.id)}
        >
          <span className="mobile-tab-icon"
            style={view !== t.id && t.bg ? { background: t.bg, color: "#fff" } : {}}>
            {t.icon}
          </span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export default function AppRouter() {
  const { user, signOut } = useAuth();
  const { sessions, refresh } = usePlatformSessions();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("li_token") && params.get("state") === "linkedin_oauth") return "linkedin";
    if (params.get("li_error"))  return "linkedin";
    if (params.get("code"))      return "threads";
    if (params.get("x_token"))   return "x";
    if (params.get("x_error"))   return "x";
    if (params.get("ig_token") && params.get("state") === "instagram_oauth") return "instagram";
    if (params.get("ig_error"))  return "instagram";
    return "home";
  });

  const handleNavigate = (v) => {
    setView(v);
    refresh();
  };

  const PAGE_TITLES = {
    home: "Overview", facebook: "Facebook", threads: "Threads",
    instagram: "Instagram", linkedin: "LinkedIn", x: "X (Twitter)", broadcast: "Post to All",
  };

  return (
    <div className="app-shell-outer">
      {/* Sidebar — collapses on desktop, hidden on mobile */}
      <Sidebar
        view={view}
        setView={handleNavigate}
        sessions={sessions}
        signOut={signOut}
        user={user}
        collapsed={sidebarCollapsed}
      />

      {/* Main content */}
      <div className="main-content">
        {/* Topbar */}
        <header className="topbar">
          {/* Hamburger — toggles sidebar collapse on desktop, no-op on mobile */}
          <button
            className="btn btn-ghost btn-icon"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            style={{ flexShrink: 0 }}
          >
            <Menu size={20} />
          </button>

          <span className="topbar-title">{PAGE_TITLES[view] || "Social CRM"}</span>

          <div className="topbar-user">
            {user?.picture && (
              <img src={user.picture} alt={user.name} className="topbar-avatar" />
            )}
            <div className="topbar-user-text">
              <div className="topbar-name">{user?.name}</div>
              <div className="topbar-email">{user?.email}</div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={signOut}
              title="Sign out"
              style={{ gap: 6, color: "var(--red)", flexShrink: 0 }}
            >
              <LogOut size={14} />
              <span className="topbar-signout-label">Sign out</span>
            </button>
          </div>
        </header>

        {/* Page panels */}
        <div className="page-panels">
          {view === "home"      && <HomePage user={user} onNavigate={handleNavigate} sessions={sessions} onRefresh={refresh} />}
          {view === "facebook"  && <FacebookPage />}
          {view === "threads"   && <ThreadsPage />}
          {view === "linkedin"  && <LinkedInPage />}
          {view === "broadcast" && <BroadcastPage />}
          {view === "x"         && <XPage />}
          {view === "instagram" && <InstagramPage />}
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileTabBar view={view} setView={handleNavigate} />
    </div>
  );
}
