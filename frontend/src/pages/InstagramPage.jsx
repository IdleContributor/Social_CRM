import { useEffect, useState } from "react";
import api from "../api.js";
import "../App.css";
import { useImagePicker } from "../hooks/useImagePicker.js";
import { lsGet, lsSet, lsRemove } from "../hooks/useLocalStorage.js";
import ComposeCard from "../components/ComposeCard.jsx";
import { loginWithInstagram } from "../hooks/usePlatformLogin.js";
import { RefreshCw, Send } from "lucide-react";

export default function InstagramPage() {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("ig_token") || null);
  const [igAccount, setIgAccount]     = useState(() => lsGet("ig_account"));
  const [tokenValid, setTokenValid]   = useState(null);
  const [postCaption, setPostCaption] = useState("");
  const [posting, setPosting]         = useState(false);
  const [postStatus, setPostStatus]   = useState(null);
  const { postImage, imagePreview, fileInputRef, handleImageChange, removeImage } = useImagePicker();
  const [media, setMedia]             = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);

  const isLoggedIn = !!accessToken && !!igAccount && tokenValid === true;

  useEffect(() => {
    if (!accessToken || !igAccount) { setTokenValid(false); return; }
    api.get("/api/instagram/profile", { params: { token: accessToken, igId: igAccount.igId } })
      .then((res) => {
        setIgAccount((prev) => ({ ...prev, ...res.data }));
        lsSet("ig_account", { ...igAccount, ...res.data });
        setTokenValid(true);
      })
      .catch(() => clearSession("Session expired. Please reconnect."));
  }, []);

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const token   = params.get("ig_token");
    const igError = params.get("ig_error");
    const state   = params.get("state");
    if (igError) {
      window.history.replaceState({}, "", window.location.pathname);
      setPostStatus({ type: "error", msg: `Instagram login failed: ${decodeURIComponent(igError)}` });
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

  useEffect(() => { if (isLoggedIn) fetchMedia(); }, [isLoggedIn]);

  const fetchAccounts = async (token) => {
    try {
      const res = await api.get("/api/instagram/accounts", { params: { token } });
      const accounts = res.data.accounts || [];
      if (!accounts.length) {
        setPostStatus({ type: "error", msg: res.data.warning || "No Instagram Business/Creator account found." });
        setTokenValid(false); return;
      }
      setIgAccount(accounts[0]); lsSet("ig_account", accounts[0]); setTokenValid(true);
    } catch { setTokenValid(false); }
  };

  const fetchMedia = async () => {
    setMediaLoading(true);
    try {
      const res = await api.get("/api/instagram/media", { params: { token: accessToken, igId: igAccount.igId } });
      setMedia(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setMediaLoading(false); }
  };

  const clearSession = (msg) => {
    lsRemove("ig_token"); lsRemove("ig_account");
    localStorage.removeItem("ig_token");
    setAccessToken(null); setIgAccount(null); setTokenValid(false); setMedia([]);
    if (msg) setPostStatus({ type: "error", msg });
  };

  const logout = () => {
    if (!window.confirm("Disconnect your Instagram account?")) return;
    clearSession(null); setPostStatus(null);
  };

  const handleCreatePost = async () => {
    if (!postImage) { alert("Instagram requires an image to post."); return; }
    setPosting(true); setPostStatus(null);
    try {
      const fd = new FormData();
      fd.append("token", accessToken);
      fd.append("igId", igAccount.igId);
      if (postCaption.trim()) fd.append("caption", postCaption.trim());
      fd.append("image", postImage);
      await api.post("/api/instagram/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPostStatus({ type: "success", msg: "Posted to Instagram." });
      setPostCaption(""); removeImage();
      setTimeout(() => fetchMedia(), 2000);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) { clearSession("Session expired."); return; }
      setPostStatus({ type: "error", msg: err.response?.data?.error?.message || err.response?.data?.error || "Failed to post." });
    } finally { setPosting(false); }
  };

  const displayName = igAccount?.username ? `@${igAccount.username}` : igAccount?.name || "Instagram";

  if (tokenValid === null) {
    return (
      <div className="page-content">
        <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "60px 0", textAlign: "center" }}>
          Verifying session…
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="page-content">
        {postStatus && <div className={`status-banner ${postStatus.type}`} style={{ marginBottom: 20 }}>{postStatus.msg}</div>}
        <div className="connect-prompt">
          <div className="connect-prompt-icon" style={{ background: "linear-gradient(135deg,#f58529,#dd2a7b)" }}>◈</div>
          <h2>Connect Instagram</h2>
          <p>Requires an Instagram Business or Creator account connected to a Facebook Page.</p>
          <button className="btn btn-primary btn-lg" onClick={loginWithInstagram}>
            Connect Instagram
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className="page-chip active" style={{ background: "linear-gradient(135deg,#f58529,#dd2a7b)", borderColor: "#dd2a7b" }}>
            {displayName}
          </div>
          {igAccount?.followers_count != null && (
            <div className="page-chip">{igAccount.followers_count.toLocaleString()} followers</div>
          )}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout} style={{ color: "var(--red)" }}>
          Disconnect
        </button>
      </div>

      {postStatus && <div className={`status-banner ${postStatus.type}`} style={{ marginBottom: 20 }}>{postStatus.msg}</div>}

      <ComposeCard
        title="New Post"
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
        status={null}
        actions={
          <button className="btn btn-primary btn-lg" style={{ marginLeft: "auto", gap: 6 }}
            onClick={handleCreatePost} disabled={posting || !postImage}>
            <Send size={14} />
            {posting ? "Publishing…" : "Post"}
          </button>
        }
      />

      {/* Media grid */}
      <div className="feed-header">
        <span className="feed-title">Recent Posts</span>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", gap: 6 }} onClick={fetchMedia}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {mediaLoading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>}
      {!mediaLoading && media.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No posts yet.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
        {media.map((item) => (
          <div key={item.id} style={{
            position: "relative", aspectRatio: "1",
            borderRadius: "var(--radius-md)", overflow: "hidden",
            background: "var(--surface-2)", border: "1.5px solid var(--border-light)",
          }}>
            {(item.media_url || item.thumbnail_url) && (
              <img src={item.media_url || item.thumbnail_url} alt={item.caption || "post"}
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            )}
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "linear-gradient(transparent, rgba(0,0,0,.7))",
              padding: "20px 8px 8px", display: "flex", gap: 10,
            }}>
              {item.like_count != null && (
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 600 }}>♥ {item.like_count}</span>
              )}
              {item.comments_count != null && (
                <span style={{ color: "#fff", fontSize: 11, fontWeight: 600 }}>💬 {item.comments_count}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
