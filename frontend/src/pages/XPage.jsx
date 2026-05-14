import { useEffect, useState } from "react";
import api from "../api.js";
import "../App.css";
import { useImagePicker } from "../hooks/useImagePicker.js";
import { lsGet, lsSet, lsRemove } from "../hooks/useLocalStorage.js";
import ComposeCard from "../components/ComposeCard.jsx";
import { loginWithX } from "../hooks/usePlatformLogin.js";
import { Send } from "lucide-react";

export default function XPage() {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("x_token") || null);
  const [profile, setProfile]         = useState(() => lsGet("x_profile"));
  const [tokenValid, setTokenValid]   = useState(null);
  const [postText, setPostText]       = useState("");
  const [posting, setPosting]         = useState(false);
  const [postStatus, setPostStatus]   = useState(null);
  const { postImage, imagePreview, fileInputRef, handleImageChange, removeImage } = useImagePicker();

  const isLoggedIn = !!accessToken && !!profile && tokenValid === true;

  useEffect(() => {
    if (!accessToken) { setTokenValid(false); return; }
    api.get("/api/x/profile", { params: { token: accessToken } })
      .then((res) => { setProfile(res.data); lsSet("x_profile", res.data); setTokenValid(true); })
      .catch(() => clearSession("Session expired. Please reconnect."));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("x_token");
    const error  = params.get("x_error");
    if (error) {
      window.history.replaceState({}, "", window.location.pathname);
      setPostStatus({ type: "error", msg: `X login failed: ${decodeURIComponent(error)}` });
      return;
    }
    if (token) {
      window.history.replaceState({}, "", window.location.pathname);
      const decoded = decodeURIComponent(token);
      setAccessToken(decoded);
      localStorage.setItem("x_token", decoded);
      api.get("/api/x/profile", { params: { token: decoded } })
        .then((res) => { setProfile(res.data); lsSet("x_profile", res.data); setTokenValid(true); })
        .catch(() => setTokenValid(false));
    }
  }, []);

  const clearSession = (msg) => {
    lsRemove("x_token"); lsRemove("x_profile");
    localStorage.removeItem("x_token");
    setAccessToken(null); setProfile(null); setTokenValid(false);
    if (msg) setPostStatus({ type: "error", msg });
  };

  const logout = () => {
    if (!window.confirm("Disconnect your X account?")) return;
    clearSession(null); setPostStatus(null);
  };

  const handleCreatePost = async () => {
    if (!postText.trim() && !postImage) { alert("Add some text or an image."); return; }
    if (postText.length > 280) { alert("X posts are limited to 280 characters."); return; }
    setPosting(true); setPostStatus(null);
    try {
      const fd = new FormData();
      fd.append("token", accessToken);
      if (postText.trim()) fd.append("text", postText.trim());
      if (postImage) fd.append("image", postImage);
      await api.post("/api/x/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPostStatus({ type: "success", msg: "Posted to X." });
      setPostText(""); removeImage();
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) { clearSession("Session expired."); return; }
      setPostStatus({ type: "error", msg: err.response?.data?.error || "Failed to post." });
    } finally { setPosting(false); }
  };

  const displayName = profile?.name || profile?.username || "me";

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
          <div className="connect-prompt-icon" style={{ background: "#000" }}>𝕏</div>
          <h2>Connect X</h2>
          <p>Link your X account to post tweets and manage your timeline.</p>
          <button className="btn btn-primary btn-lg" onClick={loginWithX}>
            Connect X
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div className="page-chip active" style={{ background: "#000", borderColor: "#000" }}>
          @{profile?.username || displayName}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout} style={{ color: "var(--red)" }}>
          Disconnect
        </button>
      </div>

      {postStatus && <div className={`status-banner ${postStatus.type}`} style={{ marginBottom: 20 }}>{postStatus.msg}</div>}

      <ComposeCard
        title="New Post"
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
        status={null}
        actions={
          <button className="btn btn-primary btn-lg" style={{ marginLeft: "auto", gap: 6 }}
            onClick={handleCreatePost} disabled={posting}>
            <Send size={14} />
            {posting ? "Posting…" : "Post"}
          </button>
        }
      />
    </div>
  );
}
