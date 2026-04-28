import { useEffect, useState } from "react";
import api from "../api.js";
import "../App.css";
import { useImagePicker } from "../hooks/useImagePicker.js";
import { lsGet, lsSet, lsRemove } from "../hooks/useLocalStorage.js";
import AppHeader from "../components/AppHeader.jsx";
import ComposeCard from "../components/ComposeCard.jsx";

function StatusLed({ connected }) {
  return <span className={`status-led ${connected ? "led-green" : "led-red"}`} aria-hidden="true" />;
}

export default function LinkedInPage({ onBack }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("li_token") || null);
  const [profile, setProfile]         = useState(() => lsGet("li_profile"));
  const [tokenValid, setTokenValid]   = useState(null); // null = checking, true/false = result

  const [postText, setPostText]       = useState("");
  const [posting, setPosting]         = useState(false);
  const [postStatus, setPostStatus]   = useState(null);
  const { postImage, imagePreview, fileInputRef, handleImageChange, removeImage } = useImagePicker();

  const isLoggedIn = !!accessToken && !!profile && tokenValid === true;

  // ── Fix 3: Verify stored token is still valid on mount ────────────
  useEffect(() => {
    if (!accessToken) { setTokenValid(false); return; }
    api.get("/api/linkedin/profile", { params: { token: accessToken } })
      .then((res) => {
        if (typeof res.data === "string" || res.data?.status === 401) {
          clearSession("Session expired. Please log in again.");
        } else {
          // Refresh profile in case it changed
          const prof = res.data;
          if (!prof.sub && prof.id) prof.sub = prof.id;
          setProfile(prof);
          lsSet("li_profile", prof);
          setTokenValid(true);
        }
      })
      .catch(() => clearSession("Session expired. Please log in again."));
  }, []);

  // ── Handle OAuth redirect ──────────────────────────────────────────
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const token   = params.get("li_token");
    const liError = params.get("li_error");
    const state   = params.get("state");

    if (liError) {
      window.history.replaceState({}, "", window.location.pathname);
      alert(`LinkedIn login failed: ${decodeURIComponent(liError)}`);
      return;
    }
    if (token && state === "linkedin_oauth") {
      window.history.replaceState({}, "", window.location.pathname);
      const decoded = decodeURIComponent(token);
      setAccessToken(decoded);
      localStorage.setItem("li_token", decoded);
      fetchProfile(decoded);
    }
  }, []);

  // ── Auth ───────────────────────────────────────────────────────────
  const login = async () => {
    try {
      const res = await api.get("/api/linkedin/auth-url");
      window.location.href = res.data.url;
    } catch {
      alert("Failed to get LinkedIn auth URL. Is the server running?");
    }
  };

  const fetchProfile = async (token) => {
    try {
      const res = await api.get("/api/linkedin/profile", { params: { token } });
      if (typeof res.data === "string") {
        setPostStatus({ type: "error", msg: "Profile fetch failed. Try logging in again." });
        setTokenValid(false);
        return;
      }
      const prof = res.data;
      if (!prof.sub && prof.id) prof.sub = prof.id;
      setProfile(prof);
      lsSet("li_profile", prof);
      setTokenValid(true);
    } catch (err) {
      console.error("LinkedIn profile fetch failed:", err.response?.data || err.message);
      setPostStatus({ type: "error", msg: "Could not load LinkedIn profile. Try logging in again." });
      setTokenValid(false);
    }
  };

  const clearSession = (msg) => {
    lsRemove("li_token");
    lsRemove("li_profile");
    localStorage.removeItem("li_token");
    setAccessToken(null);
    setProfile(null);
    setTokenValid(false);
    if (msg) setPostStatus({ type: "error", msg });
  };

  const logout = () => {
    if (!window.confirm("Disconnect your LinkedIn account?")) return;
    clearSession(null);
    setPostStatus(null);
  };

  // ── Create post ────────────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (!postText.trim() && !postImage) { alert("Add some text or an image."); return; }
    setPosting(true);
    setPostStatus(null);
    try {
      const formData = new FormData();
      formData.append("token", accessToken);
      formData.append("authorId", profile?.sub || profile?.id);
      if (postText.trim()) formData.append("text", postText.trim());
      if (postImage) formData.append("image", postImage);
      await api.post("/api/linkedin/create-post", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPostStatus({ type: "success", msg: "Post published on LinkedIn! 🎉" });
      setPostText("");
      removeImage();
    } catch (err) {
      const status = err.response?.status;
      // Token expired mid-session
      if (status === 401 || status === 403) {
        clearSession("Session expired. Please log in again.");
        return;
      }
      setPostStatus({
        type: "error",
        msg: err.response?.data?.message || err.response?.data?.error || "Failed to publish post.",
      });
    } finally {
      setPosting(false);
    }
  };

  const displayName = profile?.name ||
    (profile?.localizedFirstName
      ? `${profile.localizedFirstName} ${profile.localizedLastName || ""}`.trim()
      : profile?.given_name
        ? `${profile.given_name} ${profile.family_name || ""}`.trim()
        : "me");

  // Still verifying token
  if (tokenValid === null) {
    return (
      <div className="app-shell">
        <AppHeader onBack={onBack} logo="in" logoClass="li-logo" title="LinkedIn CRM" subtitle="Checking session…" />
        <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "40px 0", textAlign: "center" }}>
          Verifying session…
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <AppHeader
        onBack={onBack}
        logo="in"
        logoClass="li-logo"
        title="LinkedIn CRM"
        subtitle="Create and publish posts"
      >
        <StatusLed connected={isLoggedIn} />
        {isLoggedIn && (
          <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={logout}>
            🚪 Logout
          </button>
        )}
      </AppHeader>

      {postStatus?.type === "error" && !isLoggedIn && (
        <div className="status-banner error" style={{ marginBottom: 16 }}>
          {postStatus.msg}
        </div>
      )}

      {!isLoggedIn && (
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
            Please log in from the home page to access LinkedIn features.
          </p>
        </div>
      )}

      {isLoggedIn && (
        <div className="pages-row">
          <div className="page-chip active li-chip">{displayName}</div>
        </div>
      )}

      {isLoggedIn && (
        <ComposeCard
          title="✏️ Create a Post"
          badge={displayName}
          placeholder="Share an article, photo, or update…"
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          maxLength={3000}
          imagePreview={imagePreview}
          onRemoveImage={removeImage}
          fileInputRef={fileInputRef}
          onImageChange={handleImageChange}
          postImage={postImage}
          status={postStatus}
          actions={
            <button
              className="btn btn-primary btn-lg li-post-btn"
              style={{ marginLeft: "auto" }}
              onClick={handleCreatePost}
              disabled={posting}
            >
              {posting ? "Publishing…" : "🚀 Post Now"}
            </button>
          }
        />
      )}
    </div>
  );
}
