import { useEffect, useState } from "react";
import api from "../api.js";
import "../App.css";
import { useImagePicker } from "../hooks/useImagePicker.js";
import { lsGet, lsSet, lsRemove } from "../hooks/useLocalStorage.js";
import ComposeCard from "../components/ComposeCard.jsx";
import { loginWithLinkedIn } from "../hooks/usePlatformLogin.js";
import { Send } from "lucide-react";

export default function LinkedInPage() {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("li_token") || null);
  const [profile, setProfile]         = useState(() => lsGet("li_profile"));
  const [tokenValid, setTokenValid]   = useState(null);
  const [postText, setPostText]       = useState("");
  const [posting, setPosting]         = useState(false);
  const [postStatus, setPostStatus]   = useState(null);
  const { postImage, imagePreview, fileInputRef, handleImageChange, removeImage } = useImagePicker();

  const isLoggedIn = !!accessToken && !!profile && tokenValid === true;

  useEffect(() => {
    if (!accessToken) { setTokenValid(false); return; }
    api.get("/api/linkedin/profile", { params: { token: accessToken } })
      .then((res) => {
        if (typeof res.data === "string" || res.data?.status === 401) {
          clearSession("Session expired. Please reconnect.");
        } else {
          const prof = res.data;
          if (!prof.sub && prof.id) prof.sub = prof.id;
          setProfile(prof); lsSet("li_profile", prof); setTokenValid(true);
        }
      })
      .catch(() => clearSession("Session expired. Please reconnect."));
  }, []);

  useEffect(() => {
    const params  = new URLSearchParams(window.location.search);
    const token   = params.get("li_token");
    const liError = params.get("li_error");
    const state   = params.get("state");
    if (liError) {
      window.history.replaceState({}, "", window.location.pathname);
      setPostStatus({ type: "error", msg: `LinkedIn login failed: ${decodeURIComponent(liError)}` });
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

  const fetchProfile = async (token) => {
    try {
      const res = await api.get("/api/linkedin/profile", { params: { token } });
      if (typeof res.data === "string") { setTokenValid(false); return; }
      const prof = res.data;
      if (!prof.sub && prof.id) prof.sub = prof.id;
      setProfile(prof); lsSet("li_profile", prof); setTokenValid(true);
    } catch { setTokenValid(false); }
  };

  const clearSession = (msg) => {
    lsRemove("li_token"); lsRemove("li_profile");
    localStorage.removeItem("li_token");
    setAccessToken(null); setProfile(null); setTokenValid(false);
    if (msg) setPostStatus({ type: "error", msg });
  };

  const logout = () => {
    if (!window.confirm("Disconnect your LinkedIn account?")) return;
    clearSession(null); setPostStatus(null);
  };

  const handleCreatePost = async () => {
    if (!postText.trim() && !postImage) { alert("Add some text or an image."); return; }
    setPosting(true); setPostStatus(null);
    try {
      const fd = new FormData();
      fd.append("token", accessToken);
      fd.append("authorId", profile?.sub || profile?.id);
      if (postText.trim()) fd.append("text", postText.trim());
      if (postImage) fd.append("image", postImage);
      await api.post("/api/linkedin/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPostStatus({ type: "success", msg: "Post published on LinkedIn." });
      setPostText(""); removeImage();
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) { clearSession("Session expired."); return; }
      setPostStatus({ type: "error", msg: err.response?.data?.message || err.response?.data?.error || "Failed to publish." });
    } finally { setPosting(false); }
  };

  const displayName = profile?.name ||
    (profile?.localizedFirstName ? `${profile.localizedFirstName} ${profile.localizedLastName || ""}`.trim()
      : profile?.given_name ? `${profile.given_name} ${profile.family_name || ""}`.trim() : "me");

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
          <div className="connect-prompt-icon" style={{ background: "#0a66c2" }}>in</div>
          <h2>Connect LinkedIn</h2>
          <p>Link your LinkedIn profile to publish posts and grow your professional network.</p>
          <button className="btn btn-primary btn-lg" onClick={loginWithLinkedIn}>
            Connect LinkedIn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div className="page-chip active" style={{ background: "#0a66c2", borderColor: "#0a66c2" }}>
          {displayName}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout} style={{ color: "var(--red)" }}>
          Disconnect
        </button>
      </div>

      {postStatus && <div className={`status-banner ${postStatus.type}`} style={{ marginBottom: 20 }}>{postStatus.msg}</div>}

      <ComposeCard
        title="New Post"
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
        status={null}
        actions={
          <button className="btn btn-primary btn-lg" style={{ marginLeft: "auto", gap: 6 }}
            onClick={handleCreatePost} disabled={posting}>
            <Send size={14} />
            {posting ? "Publishing…" : "Post Now"}
          </button>
        }
      />
    </div>
  );
}
