import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "./AuthContext.jsx";
import api from "./api.js";
import ThemeToggle from "./components/ThemeToggle.jsx";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(false);

  // ── Animated cycling words ─────────────────────────────────────────
  const [titleNumber, setTitleNumber] = useState(0);
  const titles = useMemo(
    () => [
      "effortlessly",
      "seamlessly",
      "smarter",
      "faster",
      "better",
      "efficiently",
      "intelligently",
      "centrally",
      "smoothly",
      "professionally",
    ],
    []
  );

  useEffect(() => {
    const id = setTimeout(() => {
      setTitleNumber((n) => (n === titles.length - 1 ? 0 : n + 1));
    }, 2000);
    return () => clearTimeout(id);
  }, [titleNumber, titles]);

  // ── Google OAuth via access token ──────────────────────────────────
  // useGoogleLogin gives us a JS trigger — we build our own button.
  // On success it returns an access_token which we send to /auth/google/token.
  // The backend fetches Google userinfo and issues our app JWT.
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

  return (
    <div
      style={{
        background: "var(--bg)",
        height: "100svh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 16px",
        overflow: "hidden",
      }}
    >
      <ThemeToggle />
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}
      >
        {/* Headline */}
        <h1
          style={{
            fontSize: "clamp(2.2rem, 6.5vw, 4rem)",
            fontWeight: 700,
            letterSpacing: "-0.03em",
            textAlign: "center",
            color: "var(--text-primary)",
            lineHeight: 1.1,
            margin: 0,
          }}
        >
          Manage your social media
        </h1>

        {/* Animated word */}
        <div
          style={{
            position: "relative",
            height: "clamp(2.6rem, 7vw, 4.2rem)",
            width: "100%",
            display: "flex",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {titles.map((title, index) => (
            <motion.span
              key={index}
              style={{
                position: "absolute",
                fontWeight: 700,
                fontSize: "clamp(2.2rem, 6.5vw, 4rem)",
                letterSpacing: "-0.03em",
                color: "var(--blue)",
                lineHeight: 1.1,
              }}
              initial={{ opacity: 0, y: -60 }}
              transition={{ type: "spring", stiffness: 50 }}
              animate={
                titleNumber === index
                  ? { y: 0, opacity: 1 }
                  : { y: titleNumber > index ? -60 : 60, opacity: 0 }
              }
            >
              {title}
            </motion.span>
          ))}
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: "clamp(0.9rem, 1.8vw, 1.05rem)",
            color: "var(--text-secondary)",
            textAlign: "center",
            lineHeight: 1.65,
            maxWidth: 520,
            margin: 0,
          }}
        >
          Schedule posts, manage content, and streamline your social media
          workflow across Facebook, Threads, LinkedIn, and more — without
          switching between multiple platforms.
        </p>

        {/* Sign-in button */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => { setError(null); googleLogin(); }}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 28px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "#fff",
              color: "#3c4043",
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "inherit",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.6 : 1,
              boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
              transition: "box-shadow 0.15s, opacity 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.50)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.35)"; }}
          >
            {/* Google G logo */}
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? "Signing in…" : "Sign in to view"}
          </button>

          {error && (
            <p style={{ color: "var(--red)", fontSize: 13, margin: 0 }}>{error}</p>
          )}

          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0, textAlign: "center" }}>
            We only request your name and email.
          </p>
        </div>

      </div>
    </div>
  );
}
