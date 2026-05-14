import { useEffect } from "react";
import api from "../api.js";
import { useFacebookSDK, loginWithThreads, loginWithLinkedIn, loginWithX, loginWithInstagram } from "../hooks/usePlatformLogin.js";
import { lsSet } from "../hooks/useLocalStorage.js";
import { RefreshCw } from "lucide-react";

const PLATFORMS = [
  { id: "facebook",  name: "Facebook",    icon: "f",  bg: "#1877f2",  desc: "Pages, posts & comments" },
  { id: "threads",   name: "Threads",     icon: "@",  bg: "#101010",  desc: "Posts & replies" },
  { id: "instagram", name: "Instagram",   icon: "◈",  bg: "linear-gradient(135deg,#f58529,#dd2a7b)", desc: "Photos & media" },
  { id: "linkedin",  name: "LinkedIn",    icon: "in", bg: "#0a66c2",  desc: "Professional posts" },
  { id: "x",         name: "X (Twitter)", icon: "𝕏",  bg: "#000",     desc: "Tweets & timeline" },
];

export default function HomePage({ user, onNavigate, sessions, onRefresh }) {
  useFacebookSDK();

  useEffect(() => { onRefresh(); }, []);

  const handleFacebookLogin = () => {
    if (!window.FB) {
      alert("Facebook SDK is still loading. Please wait a moment.");
      return;
    }
    window.FB.login(
      (response) => {
        if (!response.authResponse) return;
        api.get(`https://graph.facebook.com/v19.0/me/accounts?access_token=${response.authResponse.accessToken}`)
          .then((res) => {
            const pages = res.data.data || [];
            if (!pages.length) { alert("No Facebook Pages found."); return; }
            lsSet("fb_pages", pages);
            lsSet("fb_active_page", pages[0]);
            onRefresh();
          })
          .catch(console.error);
      },
      { scope: "pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_posts" }
    );
  };

  const loginHandlers = {
    facebook:  handleFacebookLogin,
    threads:   loginWithThreads,
    linkedin:  loginWithLinkedIn,
    x:         loginWithX,
    instagram: loginWithInstagram,
  };

  const connectedCount = PLATFORMS.filter((p) => sessions[p.id]).length;

  return (
    <div className="page-content">

      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
          Good to see you{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
        </h1>
        <p style={{ fontSize: 15, color: "var(--text-muted)" }}>
          {connectedCount === 0
            ? "Connect your first platform to get started."
            : `${connectedCount} platform${connectedCount > 1 ? "s" : ""} connected — ready to post.`}
        </p>
      </div>

      {/* Platforms section */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="section-label-pill">Platforms</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
              Your accounts
            </span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onRefresh} style={{ gap: 6 }}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>

        <div className="overview-grid">
          {PLATFORMS.map((p) => {
            const connected = !!sessions[p.id];
            return (
              <div
                key={p.id}
                className={`platform-status-card${connected ? " connected" : ""}`}
                onClick={() => connected ? onNavigate(p.id) : loginHandlers[p.id]?.()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && (connected ? onNavigate(p.id) : loginHandlers[p.id]?.())}
              >
                <div className="psc-top">
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: p.bg, border: "1.5px solid var(--dark)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 15, fontWeight: 800, flexShrink: 0,
                  }}>
                    {p.icon}
                  </div>
                  <span className={`status-led ${connected ? "led-green" : "led-red"}`}
                    role="status"
                    aria-label={connected ? "Connected" : "Not connected"}
                  />
                </div>
                <div>
                  <div className="psc-name">{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{p.desc}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span className={`psc-status ${connected ? "connected" : "disconnected"}`}>
                    {connected ? "● Connected" : "○ Not connected"}
                  </span>
                  <span className="psc-action">
                    {connected ? "Open →" : "Connect →"}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Broadcast card */}
          <div
            className="platform-status-card connected"
            style={{ borderColor: "var(--dark)", background: "var(--dark)", cursor: "pointer" }}
            onClick={() => onNavigate("broadcast")}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === "Enter" && onNavigate("broadcast")}
          >
            <div className="psc-top">
              <div style={{
                width: 40, height: 40, borderRadius: 10,
                background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                border: "1.5px solid rgba(255,255,255,.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 18, fontWeight: 800,
              }}>
                ✦
              </div>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Post to All</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.5)", marginTop: 2 }}>
                Broadcast to all platforms
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--lime)" }}>
                {connectedCount} platform{connectedCount !== 1 ? "s" : ""} ready
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,.6)" }}>
                Open →
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick tips when nothing connected */}
      {connectedCount === 0 && (
        <div style={{
          background: "var(--surface)",
          border: "1.5px solid var(--app-border)",
          borderRadius: "var(--radius-lg)",
          padding: 28,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span className="section-label-pill">Getting started</span>
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              "Click any platform card above and hit Connect",
              "Authorise access in the popup window",
              "Come back here — the card will turn green",
              "Use Post to All to publish everywhere at once",
            ].map((step, i) => (
              <li key={i} style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
