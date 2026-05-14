import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "./AuthContext.jsx";
import { useTheme } from "./ThemeContext.jsx";
import api from "./api.js";
import { Sun, Moon } from "lucide-react";

const FEATURES = [
  { icon: "✦", text: "Post to 5 platforms simultaneously with one click" },
  { icon: "⏰", text: "Schedule content days or weeks in advance" },
  { icon: "💬", text: "View comments and engagement in one unified feed" },
];

const PLATFORM_ICONS = [
  { label: "Facebook",  bg: "#1877f2",                                          icon: "f"  },
  { label: "Threads",   bg: "#101010",                                          icon: "@"  },
  { label: "Instagram", bg: "linear-gradient(135deg,#f58529,#dd2a7b)",          icon: "◈"  },
  { label: "LinkedIn",  bg: "#0a66c2",                                          icon: "in" },
  { label: "X",         bg: "#000",                                             icon: "𝕏"  },
];

export default function LoginScreen() {
  const { signIn } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [error, setError]   = useState(null);
  const [loading, setLoading] = useState(false);

  const googleLogin = useGoogleLogin({
    onSuccess: async ({ access_token }) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.post("/auth/google/token", { access_token });
        signIn(res.data.token, res.data.user);
      } catch (err) {
        setError(err.response?.data?.error || "Sign-in failed. Please try again.");
      } finally {
        setLoading(false);
      }
    },
    onError: () => {
      setError("Google sign-in was cancelled or failed.");
      setLoading(false);
    },
  });

  const doLogin = () => { setError(null); googleLogin(); };

  return (
    <>
      <style>{`
        .login-root {
          min-height: 100svh;
          background: var(--bg);
          display: flex;
          flex-direction: column;
          font-family: var(--font-sans);
        }
        .login-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px clamp(16px, 5vw, 48px);
          border-bottom: 1.5px solid var(--app-border);
          background: var(--surface);
        }
        .login-nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .login-nav-mark {
          width: 34px; height: 34px;
          background: var(--dark);
          border-radius: 9px;
          display: flex; align-items: center; justify-content: center;
          color: var(--lime); font-size: 17px; font-weight: 700;
        }
        .login-nav-name {
          font-size: 17px; font-weight: 700; color: var(--text-primary);
        }
        .login-nav-actions {
          display: flex; align-items: center; gap: 8px;
        }
        .login-body {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0;
          max-width: 1100px;
          margin: 0 auto;
          width: 100%;
          padding: clamp(32px, 6vw, 80px) clamp(16px, 5vw, 48px);
          align-items: center;
          box-sizing: border-box;
        }
        .login-left {
          display: flex;
          flex-direction: column;
          gap: clamp(24px, 4vw, 40px);
          padding-right: clamp(24px, 5vw, 64px);
        }
        .login-headline {
          font-size: clamp(1.8rem, 4vw, 3.2rem);
          font-weight: 700;
          letter-spacing: -0.03em;
          color: var(--text-primary);
          line-height: 1.1;
          margin: 0;
        }
        .login-pill {
          display: inline-flex; align-items: center; gap: 6px;
          background: var(--lime); color: var(--dark);
          font-size: 12px; font-weight: 700;
          padding: 4px 12px; border-radius: 6px;
          border: 1px solid var(--dark);
          margin-bottom: 14px;
        }
        .login-features { display: flex; flex-direction: column; gap: 14px; }
        .login-feature {
          display: flex; align-items: flex-start; gap: 12px;
        }
        .login-feature-icon {
          width: 30px; height: 30px; flex-shrink: 0;
          background: var(--lime); border: 1.5px solid var(--dark);
          border-radius: 8px; display: flex; align-items: center;
          justify-content: center; font-size: 13px;
        }
        .login-feature-text {
          font-size: 14px; color: var(--text-secondary);
          line-height: 1.6; margin: 0; padding-top: 3px;
        }
        .login-platforms-label {
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--text-muted); margin-bottom: 10px;
        }
        .login-platforms { display: flex; gap: 8px; flex-wrap: wrap; }
        .login-platform-dot {
          width: 38px; height: 38px; border-radius: 10px;
          border: 1.5px solid var(--dark);
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-size: 13px; font-weight: 800;
        }
        .login-card {
          background: var(--surface);
          border: 1.5px solid var(--app-border);
          border-radius: var(--radius-xl);
          padding: clamp(24px, 4vw, 40px) clamp(20px, 3vw, 36px);
          box-shadow: var(--shadow-lg);
          display: flex; flex-direction: column; gap: 24px;
        }
        .login-card-title {
          font-size: clamp(20px, 3vw, 26px);
          font-weight: 700; color: var(--text-primary); margin-bottom: 6px;
        }
        .login-card-sub {
          font-size: 14px; color: var(--text-secondary); line-height: 1.6;
        }
        .login-google-btn {
          display: flex; align-items: center; justify-content: center; gap: 12px;
          padding: 13px 20px; border-radius: var(--radius-md);
          border: 1.5px solid var(--app-border);
          background: var(--surface); color: var(--text-primary);
          font-size: 15px; font-weight: 600; font-family: var(--font-sans);
          cursor: pointer; width: 100%;
          transition: background 0.15s;
        }
        .login-google-btn:hover:not(:disabled) { background: var(--surface-2); }
        .login-google-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .login-divider {
          display: flex; align-items: center; gap: 12px;
        }
        .login-divider-line { flex: 1; height: 1px; background: var(--border-light); }
        .login-divider-text { font-size: 12px; color: var(--text-muted); font-weight: 600; }
        .login-checklist { display: flex; flex-direction: column; gap: 10px; }
        .login-check-item { display: flex; align-items: center; gap: 10px; }
        .login-check-box {
          width: 20px; height: 20px; border-radius: 4px; flex-shrink: 0;
          background: var(--lime); border: 1px solid var(--dark);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px;
        }
        .login-check-text { font-size: 14px; color: var(--text-secondary); }
        .login-error { color: var(--red); font-size: 13px; text-align: center; }

        /* ── Mobile ── */
        @media (max-width: 700px) {
          .login-body {
            grid-template-columns: 1fr;
            padding: 24px 16px 40px;
            gap: 32px;
          }
          .login-left { padding-right: 0; }
          .login-left-platforms { display: none; }
        }
      `}</style>

      <div className="login-root">
        {/* Nav */}
        <nav className="login-nav">
          <div className="login-nav-logo">
            <div className="login-nav-mark">S</div>
            <span className="login-nav-name">Social CRM</span>
          </div>
          <div className="login-nav-actions">
            <button
              onClick={toggleTheme}
              className="btn btn-ghost btn-sm"
              aria-label="Toggle theme"
              style={{ gap: 6 }}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
              {isDark ? "Light" : "Dark"}
            </button>
            <button onClick={doLogin} disabled={loading} className="btn btn-outline btn-sm">
              Sign in
            </button>
          </div>
        </nav>

        {/* Body */}
        <div className="login-body">
          {/* Left — marketing */}
          <div className="login-left">
            <div>
              <div className="login-pill">✦ Social Media Management</div>
              <h1 className="login-headline">One place for all your social content</h1>
            </div>

            <div className="login-features">
              {FEATURES.map((f, i) => (
                <div key={i} className="login-feature">
                  <div className="login-feature-icon">{f.icon}</div>
                  <p className="login-feature-text">{f.text}</p>
                </div>
              ))}
            </div>

            <div className="login-left-platforms">
              <p className="login-platforms-label">Works with</p>
              <div className="login-platforms">
                {PLATFORM_ICONS.map((p) => (
                  <div key={p.label} title={p.label} className="login-platform-dot"
                    style={{ background: p.bg }}>
                    {p.icon}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — sign-in card */}
          <div className="login-card">
            <div>
              <div className="login-card-title">Get started free</div>
              <p className="login-card-sub">
                Connect your social accounts and manage everything from one dashboard.
              </p>
            </div>

            <button onClick={doLogin} disabled={loading} className="login-google-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {loading ? "Signing in…" : "Continue with Google"}
            </button>

            {error && <p className="login-error">{error}</p>}

            <div className="login-divider">
              <div className="login-divider-line" />
              <span className="login-divider-text">What you get</span>
              <div className="login-divider-line" />
            </div>

            <div className="login-checklist">
              {["Post to all platforms at once", "Schedule posts in advance", "View engagement & comments"].map((item) => (
                <div key={item} className="login-check-item">
                  <div className="login-check-box">✓</div>
                  <span className="login-check-text">{item}</span>
                </div>
              ))}
            </div>

          
          </div>
        </div>
      </div>
    </>
  );
}
