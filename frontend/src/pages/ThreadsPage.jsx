import { useEffect, useState, useCallback } from "react";
import api from "../api.js";
import "../App.css";
import { useImagePicker } from "../hooks/useImagePicker.js";
import { lsGet, lsSet, lsRemove } from "../hooks/useLocalStorage.js";
import AppHeader from "../components/AppHeader.jsx";
import ComposeCard from "../components/ComposeCard.jsx";
import PostCard from "../components/PostCard.jsx";

function StatusLed({ connected }) {
  return <span className={`status-led ${connected ? "led-green" : "led-red"}`} aria-hidden="true" />;
}

export default function ThreadsPage({ onBack }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("threads_token") || null);
  const [profile, setProfile]         = useState(() => lsGet("threads_profile"));
  const [tokenValid, setTokenValid]   = useState(null); // null = checking

  const [posts, setPosts]               = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postText, setPostText]         = useState("");
  const [posting, setPosting]           = useState(false);
  const [postStatus, setPostStatus]     = useState(null);
  const { postImage, imagePreview, fileInputRef, handleImageChange, removeImage } = useImagePicker();

  const [replies, setReplies] = useState({});

  const isLoggedIn = !!accessToken && !!profile && tokenValid === true;

  // ── Fix 3: Verify stored token on mount ───────────────────────────
  useEffect(() => {
    if (!accessToken) { setTokenValid(false); return; }
    api.get("/api/threads/profile", { params: { token: accessToken } })
      .then((res) => {
        setProfile(res.data);
        lsSet("threads_profile", res.data);
        setTokenValid(true);
      })
      .catch(() => clearSession("Session expired. Please log in again."));
  }, []);

  // ── Handle OAuth redirect ──────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.history.replaceState({}, "", window.location.pathname);
      exchangeCode(code);
    }
  }, []);

  useEffect(() => { if (isLoggedIn) fetchPosts(); }, [isLoggedIn]);

  // ── Auth ───────────────────────────────────────────────────────────
  const login = async () => {
    try {
      const res = await api.get("/api/threads/auth-url");
      window.location.href = res.data.url;
    } catch {
      alert("Failed to get Threads auth URL. Is the server running?");
    }
  };

  const exchangeCode = async (code) => {
    try {
      const res = await api.post("/api/threads/exchange-token", { code });
      const token = res.data.access_token;
      setAccessToken(token);
      localStorage.setItem("threads_token", token);
      // Fetch profile immediately after exchange
      const profileRes = await api.get("/api/threads/profile", { params: { token } });
      setProfile(profileRes.data);
      lsSet("threads_profile", profileRes.data);
      setTokenValid(true);
    } catch (err) {
      console.error("Token exchange failed:", err);
      alert("Threads login failed. Check server logs.");
      setTokenValid(false);
    }
  };

  const clearSession = (msg) => {
    lsRemove("threads_token");
    lsRemove("threads_profile");
    localStorage.removeItem("threads_token");
    setAccessToken(null);
    setProfile(null);
    setTokenValid(false);
    setPosts([]);
    setReplies({});
    if (msg) setPostStatus({ type: "error", msg });
  };

  const logout = () => {
    if (!window.confirm("Disconnect your Threads account?")) return;
    clearSession(null);
  };

  // ── Posts ──────────────────────────────────────────────────────────
  const fetchPosts = async () => {
    setPostsLoading(true);
    try {
      const res = await api.get("/api/threads/posts", { params: { token: accessToken } });
      setPosts(res.data.data || []);
    } catch (err) {
      if (err.response?.status === 401) clearSession("Session expired. Please log in again.");
      else console.error("Fetch posts failed:", err);
    } finally {
      setPostsLoading(false);
    }
  };

  const handleCreatePost = async () => {
    if (!postText.trim() && !postImage) { alert("Add some text or an image."); return; }
    setPosting(true);
    setPostStatus(null);
    try {
      const formData = new FormData();
      formData.append("token", accessToken);
      if (postText.trim()) formData.append("text", postText.trim());
      if (postImage) formData.append("image", postImage);
      await api.post("/api/threads/create-post", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setPostStatus({ type: "success", msg: "Thread published! 🎉" });
      setPostText("");
      removeImage();
      setTimeout(() => fetchPosts(), 1500);
    } catch (err) {
      if (err.response?.status === 401) { clearSession("Session expired. Please log in again."); return; }
      setPostStatus({ type: "error", msg: err.response?.data?.error?.message || "Failed to publish thread." });
    } finally {
      setPosting(false);
    }
  };

  // ── Replies ────────────────────────────────────────────────────────
  const fetchReplies = useCallback(async (mediaId, after = null) => {
    setReplies((prev) => ({ ...prev, [mediaId]: { ...prev[mediaId], loading: true, error: null } }));
    try {
      const params = { token: accessToken, mediaId };
      if (after) params.after = after;
      const res = await api.get("/api/threads/replies", { params });
      const newReplies = res.data.data || [];
      const nextCursor = res.data.paging?.cursors?.after || null;
      const hasNext    = !!res.data.paging?.next;
      setReplies((prev) => ({
        ...prev,
        [mediaId]: {
          ...prev[mediaId],
          replies: after ? [...(prev[mediaId]?.replies || []), ...newReplies] : newReplies,
          nextCursor: hasNext ? nextCursor : null,
          loading: false,
        },
      }));
    } catch (err) {
      setReplies((prev) => ({
        ...prev,
        [mediaId]: { ...prev[mediaId], loading: false, error: err.response?.data?.error?.message || "Failed to load replies." },
      }));
    }
  }, [accessToken]);

  const toggleReplies = (post) => {
    const id = post.id;
    const current = replies[id];
    if (current?.open) {
      setReplies((prev) => ({ ...prev, [id]: { ...prev[id], open: false } }));
    } else {
      setReplies((prev) => ({ ...prev, [id]: { ...prev[id], open: true } }));
      if (!current?.replies) fetchReplies(id);
    }
  };

  if (tokenValid === null) {
    return (
      <div className="app-shell">
        <AppHeader onBack={onBack} logo="@" logoClass="threads-logo" title="Threads CRM" subtitle="Checking session…" />
        <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "40px 0", textAlign: "center" }}>
          Verifying session…
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <AppHeader onBack={onBack} logo="@" logoClass="threads-logo" title="Threads CRM" subtitle="Manage posts &amp; replies">
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
            Please log in from the home page to access Threads features.
          </p>
        </div>
      )}

      {isLoggedIn && profile && (
        <div className="pages-row">
          <div className="page-chip active">@{profile.username || profile.name || "me"}</div>
        </div>
      )}

      {isLoggedIn && (
        <ComposeCard
          title="✏️ New Thread"
          badge={profile ? `@${profile.username || profile.name}` : ""}
          placeholder="Start a thread…"
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          maxLength={500}
          imagePreview={imagePreview}
          onRemoveImage={removeImage}
          fileInputRef={fileInputRef}
          onImageChange={handleImageChange}
          postImage={postImage}
          status={postStatus}
          actions={
            <button
              className="btn btn-primary btn-lg threads-post-btn"
              style={{ marginLeft: "auto" }}
              onClick={handleCreatePost}
              disabled={posting}
            >
              {posting ? "Publishing…" : "🚀 Post Thread"}
            </button>
          }
        />
      )}

      {isLoggedIn && (
        <>
          <div className="feed-header">
            <span className="feed-title">Your Threads</span>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={fetchPosts}>
              🔄 Refresh
            </button>
          </div>
          {postsLoading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading threads…</p>}
          {!postsLoading && posts.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 14, padding: "12px 0" }}>No threads yet.</p>
          )}
          {posts.map((post) => {
            const eng        = replies[post.id] || {};
            const replyCount = post.replies?.summary?.total_count ?? null;
            const badges     = replyCount !== null
              ? [{ label: `💬 ${replyCount} ${replyCount === 1 ? "Reply" : "Replies"}`, className: "comments" }]
              : [];
            return (
              <PostCard
                key={post.id}
                timestamp={post.timestamp}
                text={post.text}
                imageUrl={post.media_url}
                engagementBadges={badges}
                toggleLabel="Replies"
                isOpen={!!eng.open}
                onToggle={() => toggleReplies(post)}
                showToggle={replyCount > 0}
                items={eng.replies}
                itemLoading={eng.loading}
                itemError={eng.error}
                emptyLabel="No replies yet."
                loadingLabel="Loading replies…"
                nextCursor={eng.nextCursor}
                onLoadMore={() => fetchReplies(post.id, eng.nextCursor)}
                renderItem={(r, i) => {
                  const initials = (r.username || "?").slice(0, 2).toUpperCase();
                  return (
                    <div key={i} className="cmt-item">
                      <div className="cmt-avatar">{initials}</div>
                      <div className="cmt-bubble">
                        <div className="cmt-name">@{r.username}</div>
                        <div className="cmt-text">{r.text}</div>
                        <div className="cmt-time">{new Date(r.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                  );
                }}
              />
            );
          })}
        </>
      )}
    </div>
  );
}
