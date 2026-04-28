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

export default function InstagramPage({ onBack }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("ig_token") || null);
  const [igAccount, setIgAccount]     = useState(() => lsGet("ig_account")); // { igId, username, name, ... }
  const [tokenValid, setTokenValid]   = useState(null);

  const [postCaption, setPostCaption] = useState("");
  const [posting, setPosting]         = useState(false);
  const [postStatus, setPostStatus]   = useState(null);
  const { postImage, imagePreview, fileInputRef, handleImageChange, removeImage } = useImagePicker();

  // Recent media feed
  const [media, setMedia]           = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  const isLoggedIn = !!accessToken && !!igAccount && tokenValid === true;

  // ── Verify token on mount ──────────────────────────────────────────
  useEffect(() => {
    if (!accessToken || !igAccount) { setTokenValid(false); return; }
    api.get("/api/instagram/profile", { params: { token: accessToken, igId: igAccount.igId } })
      .then((res) => {
        setIgAccount((prev) => ({ ...prev, ...res.data }));
        lsSet("ig_account", { ...igAccount, ...res.data });
        setTokenValid(true);
      })
      .catch(() => clearSession("Session expired. Please log in again."));
  }, []);

  // ── Handle OAuth redirect ──────────────────────────────────────────
  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const token   = params.get("ig_token");
    const igError = params.get("ig_error");
    const state   = params.get("state");

    if (igError) {
      window.history.replaceState({}, "", window.location.pathname);
      alert(`Instagram login failed: ${decodeURIComponent(igError)}`);
      return;
    }
    if (token && state === "instagram_oauth") {
      window.history.replaceState({}, "", window.location.pathname);
      const decoded = decodeURIComponent(token);
      setAccessToken(decoded);
      localStorage.setItem("ig_token", decoded);
      fetchAccounts(decoded);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) fetchMedia();
  }, [isLoggedIn]);

  // ── Auth ───────────────────────────────────────────────────────────
  const login = async () => {
    try {
      const res = await api.get("/api/instagram/auth-url");
      window.location.href = res.data.url;
    } catch {
      alert("Failed to get Instagram auth URL. Is the server running?");
    }
  };

  const fetchAccounts = async (token) => {
    try {
      const res = await api.get("/api/instagram/accounts", { params: { token } });
      const accounts = res.data.accounts || [];
      if (accounts.length === 0) {
        setPostStatus({
          type: "error",
          msg: res.data.warning || "No Instagram Business/Creator account found. Connect your Instagram to a Facebook Page first.",
        });
        setTokenValid(false);
        return;
      }
      const account = accounts[0];
      setIgAccount(account);
      lsSet("ig_account", account);
      setTokenValid(true);
    } catch (err) {
      console.error("IG accounts fetch failed:", err.response?.data || err.message);
      setPostStatus({ type: "error", msg: "Could not load Instagram accounts." });
      setTokenValid(false);
    }
  };

  const fetchMedia = async () => {
    setMediaLoading(true);
    try {
      const res = await api.get("/api/instagram/media", {
        params: { token: accessToken, igId: igAccount.igId },
      });
      setMedia(res.data.data || []);
    } catch (err) {
      console.error("IG media fetch failed:", err.response?.data || err.message);
    } finally {
      setMediaLoading(false);
    }
  };

  const clearSession = (msg) => {
    lsRemove("ig_token");
    lsRemove("ig_account");
    localStorage.removeItem("ig_token");
    setAccessToken(null);
    setIgAccount(null);
    setTokenValid(false);
    setMedia([]);
    if (msg) setPostStatus({ type: "error", msg });
  };

  const logout = () => {
    if (!window.confirm("Disconnect your Instagram account?")) return;
    clearSession(null);
    setPostStatus(null);
  };

  // ── Create post ────────────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (!postImage) { alert("Instagram requires an image to post."); return; }
    setPosting(true);
    setPostStatus(null);
    try {
      const formData = new FormData();
      formData.append("token", accessToken);
      formData.append("igId", igAccount.igId);
      if (postCaption.trim()) formData.append("caption", postCaption.trim());
      formData.append("image", postImage);
      await api.post("/api/instagram/create-post", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPostStatus({ type: "success", msg: "Posted to Instagram! 🎉" });
      setPostCaption("");
      removeImage();
      setTimeout(() => fetchMedia(), 2000);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        clearSession("Session expired. Please log in again.");
        return;
      }
      setPostStatus({
        type: "error",
        msg: err.response?.data?.error?.message || err.response?.data?.error || "Failed to post.",
      });
    } finally {
      setPosting(false);
    }
  };

  const displayName = igAccount?.username
    ? `@${igAccount.username}`
    : igAccount?.name || "Instagram";

  if (tokenValid === null) {
    return (
      <div className="app-shell">
        <AppHeader onBack={onBack} logo="◈" logoClass="ig-logo" title="Instagram" subtitle="Checking session…" />
        <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "40px 0", textAlign: "center" }}>
          Verifying session…
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <AppHeader onBack={onBack} logo="◈" logoClass="ig-logo" title="Instagram" subtitle="Publish to your Instagram account">
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
            Please log in from the home page to access Instagram features.
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 8 }}>
            Requires an Instagram Business or Creator account connected to a Facebook Page.
          </p>
        </div>
      )}

      {isLoggedIn && (
        <div className="pages-row">
          <div className="page-chip active ig-chip">{displayName}</div>
          {igAccount?.followers_count != null && (
            <div className="page-chip">{igAccount.followers_count.toLocaleString()} followers</div>
          )}
        </div>
      )}

      {isLoggedIn && (
        <ComposeCard
          title="📸 New Post"
          badge={displayName}
          placeholder="Write a caption… (optional)"
          value={postCaption}
          onChange={(e) => setPostCaption(e.target.value)}
          maxLength={2200}
          imagePreview={imagePreview}
          onRemoveImage={removeImage}
          fileInputRef={fileInputRef}
          onImageChange={handleImageChange}
          postImage={postImage}
          status={postStatus}
          actions={
            <button
              className="btn btn-primary btn-lg ig-post-btn"
              style={{ marginLeft: "auto" }}
              onClick={handleCreatePost}
              disabled={posting || !postImage}
            >
              {posting ? "Publishing…" : "🚀 Post"}
            </button>
          }
        />
      )}

      {/* Recent media grid */}
      {isLoggedIn && (
        <>
          <div className="feed-header">
            <span className="feed-title">Recent Posts</span>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={fetchMedia}>
              🔄 Refresh
            </button>
          </div>

          {mediaLoading && (
            <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading posts…</p>
          )}

          {!mediaLoading && media.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 14, padding: "12px 0" }}>No posts yet.</p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 24 }}>
            {media.map((item) => (
              <div key={item.id} style={{ position: "relative", aspectRatio: "1", borderRadius: 10, overflow: "hidden", background: "var(--surface-2)" }}>
                {(item.media_url || item.thumbnail_url) && (
                  <img
                    src={item.media_url || item.thumbnail_url}
                    alt={item.caption || "post"}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                )}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "linear-gradient(transparent, rgba(0,0,0,.7))",
                  padding: "16px 8px 6px",
                  display: "flex", gap: 10,
                }}>
                  {item.like_count != null && (
                    <span style={{ color: "#fff", fontSize: 11, fontWeight: 600 }}>❤️ {item.like_count}</span>
                  )}
                  {item.comments_count != null && (
                    <span style={{ color: "#fff", fontSize: 11, fontWeight: 600 }}>💬 {item.comments_count}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
