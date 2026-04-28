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

export default function XPage({ onBack }) {
  const [accessToken, setAccessToken]   = useState(() => localStorage.getItem("x_token") || null);
  const [profile, setProfile]           = useState(() => lsGet("x_profile"));
  const [tokenValid, setTokenValid]     = useState(null);

  const [postText, setPostText]         = useState("");
  const [posting, setPosting]           = useState(false);
  const [postStatus, setPostStatus]     = useState(null);
  const { postImage, imagePreview, fileInputRef, handleImageChange, removeImage } = useImagePicker();

  const isLoggedIn = !!accessToken && !!profile && tokenValid === true;

  // ── Verify token on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) { setTokenValid(false); return; }
    api.get("/api/x/profile", { params: { token: accessToken } })
      .then((res) => {
        setProfile(res.data);
        lsSet("x_profile", res.data);
        setTokenValid(true);
      })
      .catch(() => clearSession("Session expired. Please log in again."));
  }, []);

  // ── Handle OAuth redirect ──────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("x_token");
    const error  = params.get("x_error");

    if (error) {
      window.history.replaceState({}, "", window.location.pathname);
      alert(`X login failed: ${decodeURIComponent(error)}`);
      return;
    }
    if (token) {
      window.history.replaceState({}, "", window.location.pathname);
      const decoded = decodeURIComponent(token);
      setAccessToken(decoded);
      localStorage.setItem("x_token", decoded);
      fetchProfile(decoded);
    }
  }, []);

  // ── Auth ───────────────────────────────────────────────────────────
  const login = async () => {
    try {
      const res = await api.get("/api/x/auth-url");
      window.location.href = res.data.url;
    } catch {
      alert("Failed to get X auth URL. Is the server running?");
    }
  };

  const fetchProfile = async (token) => {
    try {
      const res = await api.get("/api/x/profile", { params: { token } });
      setProfile(res.data);
      lsSet("x_profile", res.data);
      setTokenValid(true);
    } catch (err) {
      console.error("X profile fetch failed:", err.response?.data || err.message);
      setPostStatus({ type: "error", msg: "Could not load X profile. Try logging in again." });
      setTokenValid(false);
    }
  };

  const clearSession = (msg) => {
    lsRemove("x_token");
    lsRemove("x_profile");
    localStorage.removeItem("x_token");
    setAccessToken(null);
    setProfile(null);
    setTokenValid(false);
    if (msg) setPostStatus({ type: "error", msg });
  };

  const logout = () => {
    if (!window.confirm("Disconnect your X account?")) return;
    clearSession(null);
    setPostStatus(null);
  };

  // ── Create post ────────────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (!postText.trim() && !postImage) { alert("Add some text or an image."); return; }
    if (postText.length > 280) { alert("X posts are limited to 280 characters."); return; }
    setPosting(true);
    setPostStatus(null);
    try {
      const formData = new FormData();
      formData.append("token", accessToken);
      if (postText.trim()) formData.append("text", postText.trim());
      if (postImage) formData.append("image", postImage);
      await api.post("/api/x/create-post", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPostStatus({ type: "success", msg: "Posted to X! 🎉" });
      setPostText("");
      removeImage();
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        clearSession("Session expired. Please log in again.");
        return;
      }
      setPostStatus({
        type: "error",
        msg: err.response?.data?.error || "Failed to post.",
      });
    } finally {
      setPosting(false);
    }
  };

  const displayName = profile?.name || profile?.username || "me";

  if (tokenValid === null) {
    return (
      <div className="app-shell">
        <AppHeader onBack={onBack} logo="𝕏" logoClass="x-logo" title="X (Twitter)" subtitle="Checking session…" />
        <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "40px 0", textAlign: "center" }}>
          Verifying session…
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader onBack={onBack} logo="𝕏" logoClass="x-logo" title="X (Twitter)" subtitle="Post and manage your X presence">
        <StatusLed connected={isLoggedIn} />
        {isLoggedIn && (
          <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={logout}>
            🚪 Logout
          </button>
        )}
      </AppHeader>

      {postStatus?.type === "error" && !isLoggedIn && (
        <div className="status-banner error" style={{ marginBottom: 16 }}>{postStatus.msg}</div>
      )}

      {!isLoggedIn && (
        <div style={{ padding: "60px 20px", textAlign: "center" }}>
          <p style={{ color: "var(--text-muted)", fontSize: 15 }}>
            Please log in from the home page to access X features.
          </p>
        </div>
      )}

      {isLoggedIn && (
        <div className="pages-row">
          <div className="page-chip active x-chip">@{profile?.username || displayName}</div>
        </div>
      )}

      {isLoggedIn && (
        <ComposeCard
          title="✏️ New Post"
          badge={`@${profile?.username || displayName}`}
          placeholder="What's happening?"
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          maxLength={280}
          imagePreview={imagePreview}
          onRemoveImage={removeImage}
          fileInputRef={fileInputRef}
          onImageChange={handleImageChange}
          postImage={postImage}
          status={postStatus}
          actions={
            <button
              className="btn btn-primary btn-lg x-post-btn"
              style={{ marginLeft: "auto" }}
              onClick={handleCreatePost}
              disabled={posting}
            >
              {posting ? "Posting…" : "🚀 Post"}
            </button>
          }
        />
      )}
    </div>
  );
}
