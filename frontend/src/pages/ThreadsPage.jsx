import { useEffect, useState, useCallback } from "react";
import api from "../api.js";
import "../App.css";
import { useImagePicker } from "../hooks/useImagePicker.js";
import { lsGet, lsSet, lsRemove } from "../hooks/useLocalStorage.js";
import ComposeCard from "../components/ComposeCard.jsx";
import PostCard from "../components/PostCard.jsx";
import { loginWithThreads } from "../hooks/usePlatformLogin.js";
import { RefreshCw, Send } from "lucide-react";

export default function ThreadsPage() {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem("threads_token") || null);
  const [profile, setProfile]         = useState(() => lsGet("threads_profile"));
  const [tokenValid, setTokenValid]   = useState(null);
  const [posts, setPosts]             = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postText, setPostText]       = useState("");
  const [posting, setPosting]         = useState(false);
  const [postStatus, setPostStatus]   = useState(null);
  const { postImage, imagePreview, fileInputRef, handleImageChange, removeImage } = useImagePicker();
  const [replies, setReplies]         = useState({});

  const isLoggedIn = !!accessToken && !!profile && tokenValid === true;

  useEffect(() => {
    if (!accessToken) { setTokenValid(false); return; }
    api.get("/api/threads/profile", { params: { token: accessToken } })
      .then((res) => { setProfile(res.data); lsSet("threads_profile", res.data); setTokenValid(true); })
      .catch(() => clearSession("Session expired. Please reconnect."));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) { window.history.replaceState({}, "", window.location.pathname); exchangeCode(code); }
  }, []);

  useEffect(() => { if (isLoggedIn) fetchPosts(); }, [isLoggedIn]);

  const exchangeCode = async (code) => {
    try {
      const res = await api.post("/api/threads/exchange-token", { code });
      const token = res.data.access_token;
      setAccessToken(token);
      localStorage.setItem("threads_token", token);
      const profileRes = await api.get("/api/threads/profile", { params: { token } });
      setProfile(profileRes.data);
      lsSet("threads_profile", profileRes.data);
      setTokenValid(true);
    } catch (err) {
      console.error("Token exchange failed:", err);
      setTokenValid(false);
    }
  };

  const clearSession = (msg) => {
    lsRemove("threads_token"); lsRemove("threads_profile");
    localStorage.removeItem("threads_token");
    setAccessToken(null); setProfile(null); setTokenValid(false);
    setPosts([]); setReplies({});
    if (msg) setPostStatus({ type: "error", msg });
  };

  const logout = () => {
    if (!window.confirm("Disconnect your Threads account?")) return;
    clearSession(null);
  };

  const fetchPosts = async () => {
    setPostsLoading(true);
    try {
      const res = await api.get("/api/threads/posts", { params: { token: accessToken } });
      setPosts(res.data.data || []);
    } catch (err) {
      if (err.response?.status === 401) clearSession("Session expired.");
    } finally { setPostsLoading(false); }
  };

  const handleCreatePost = async () => {
    if (!postText.trim() && !postImage) { alert("Add some text or an image."); return; }
    setPosting(true); setPostStatus(null);
    try {
      const fd = new FormData();
      fd.append("token", accessToken);
      if (postText.trim()) fd.append("text", postText.trim());
      if (postImage) fd.append("image", postImage);
      await api.post("/api/threads/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setPostStatus({ type: "success", msg: "Thread published." });
      setPostText(""); removeImage();
      setTimeout(() => fetchPosts(), 1500);
    } catch (err) {
      if (err.response?.status === 401) { clearSession("Session expired."); return; }
      setPostStatus({ type: "error", msg: err.response?.data?.error?.message || "Failed to publish." });
    } finally { setPosting(false); }
  };

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
    } catch {
      setReplies((prev) => ({ ...prev, [mediaId]: { ...prev[mediaId], loading: false, error: "Failed to load replies." } }));
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

  /* ── Checking session ── */
  if (tokenValid === null) {
    return (
      <div className="page-content">
        <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "60px 0", textAlign: "center" }}>
          Verifying session…
        </div>
      </div>
    );
  }

  /* ── Not connected ── */
  if (!isLoggedIn) {
    return (
      <div className="page-content">
        {postStatus && <div className={`status-banner ${postStatus.type}`} style={{ marginBottom: 20 }}>{postStatus.msg}</div>}
        <div className="connect-prompt">
          <div className="connect-prompt-icon" style={{ background: "#101010" }}>@</div>
          <h2>Connect Threads</h2>
          <p>Link your Threads account to publish posts and manage replies.</p>
          <button className="btn btn-primary btn-lg" onClick={loginWithThreads}>
            Connect Threads
          </button>
        </div>
      </div>
    );
  }

  /* ── Connected ── */
  return (
    <div className="page-content">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div className="page-chip active" style={{ background: "#101010", borderColor: "#101010" }}>
          @{profile?.username || profile?.name || "me"}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout} style={{ color: "var(--red)" }}>
          Disconnect
        </button>
      </div>

      {postStatus && <div className={`status-banner ${postStatus.type}`} style={{ marginBottom: 20 }}>{postStatus.msg}</div>}

      <ComposeCard
        title="New Thread"
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
        status={null}
        actions={
          <button className="btn btn-primary btn-lg" style={{ marginLeft: "auto", gap: 6 }}
            onClick={handleCreatePost} disabled={posting}>
            <Send size={14} />
            {posting ? "Publishing…" : "Post Thread"}
          </button>
        }
      />

      <div className="feed-header">
        <span className="feed-title">Your Threads</span>
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", gap: 6 }} onClick={fetchPosts}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {postsLoading && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Loading…</p>}
      {!postsLoading && posts.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No threads yet.</p>}

      {posts.map((post) => {
        const eng        = replies[post.id] || {};
        const replyCount = post.replies?.summary?.total_count ?? null;
        const badges     = replyCount !== null
          ? [{ label: `${replyCount} ${replyCount === 1 ? "Reply" : "Replies"}`, className: "comments" }]
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
            renderItem={(r, i) => (
              <div key={i} className="cmt-item">
                <div className="cmt-avatar">{(r.username || "?").slice(0, 2).toUpperCase()}</div>
                <div className="cmt-bubble">
                  <div className="cmt-name">@{r.username}</div>
                  <div className="cmt-text">{r.text}</div>
                  <div className="cmt-time">{new Date(r.timestamp).toLocaleString()}</div>
                </div>
              </div>
            )}
          />
        );
      })}
    </div>
  );
}
