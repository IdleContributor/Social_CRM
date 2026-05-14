import { useEffect, useState, useCallback } from "react";
import api from "../api.js";
import "../App.css";
import { useImagePicker } from "../hooks/useImagePicker.js";
import { lsGet, lsSet, lsRemove } from "../hooks/useLocalStorage.js";
import ComposeCard from "../components/ComposeCard.jsx";
import PostCard from "../components/PostCard.jsx";
import { RefreshCw, Clock, Send } from "lucide-react";

export default function FacebookPage() {
  const [pages, setPages]           = useState([]);
  const [posts, setPosts]           = useState([]);
  const [sdkReady, setSdkReady]     = useState(false);
  const [activePage, setActivePage] = useState(null);

  const [postText, setPostText]     = useState("");
  const [posting, setPosting]       = useState(false);
  const [postStatus, setPostStatus] = useState(null);
  const { postImage, imagePreview, fileInputRef, handleImageChange, removeImage } = useImagePicker();

  const [scheduleMode, setScheduleMode]   = useState(false);
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduledPosts, setScheduledPosts]     = useState([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [cancellingId, setCancellingId]         = useState(null);
  const [engagement, setEngagement] = useState({});

  const isLoggedIn = pages.length > 0;

  useEffect(() => {
    const savedPages = lsGet("fb_pages");
    const savedPage  = lsGet("fb_active_page");
    if (savedPages) setPages(savedPages);
    if (savedPage)  setActivePage(savedPage);
  }, []);

  useEffect(() => {
    if (activePage) {
      fetchPosts(activePage.id, activePage.access_token);
      fetchScheduledPosts(activePage.id, activePage.access_token);
    }
  }, [activePage]);

  useEffect(() => {
    const init = async () => {
      try {
        const cfg = await api.get("/api/config");
        const appId = cfg.data.appId;
        if (!appId) return;
        if (window.FB) { setSdkReady(true); return; }
        window.fbAsyncInit = function () {
          window.FB.init({ appId, cookie: true, xfbml: true, version: "v19.0" });
          setSdkReady(true);
        };
        const script = document.createElement("script");
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.async = true; script.defer = true;
        document.body.appendChild(script);
      } catch (err) { console.error("SDK load error:", err); }
    };
    init();
  }, []);

  const fetchPosts = async (pageId, token) => {
    try {
      const res = await api.get(`/api/page-posts?pageId=${pageId}&token=${token}`);
      setPosts(res.data.data || []);
    } catch (err) {
      if (err.response?.data?.error?.code === 190) {
        clearSession();
        setPostStatus({ type: "error", msg: "Facebook session expired. Please reconnect." });
      }
    }
  };

  const fetchScheduledPosts = async (pageId, token) => {
    setScheduledLoading(true);
    try {
      const res = await api.get(`/api/scheduled-posts?pageId=${pageId}&token=${token}`);
      setScheduledPosts(res.data.data || []);
    } catch (err) { console.error(err); }
    finally { setScheduledLoading(false); }
  };

  const cancelScheduledPost = async (postId) => {
    if (!window.confirm("Cancel this scheduled post?")) return;
    setCancellingId(postId);
    try {
      await api.delete(`/api/scheduled-posts/${postId}?token=${activePage.access_token}`);
      setScheduledPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) { alert(err.response?.data?.error?.message || "Failed to cancel."); }
    finally { setCancellingId(null); }
  };

  const handleLogin = async (userToken) => {
    try {
      const res = await api.get(`https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}`);
      const pagesData = res.data.data || [];
      setPages(pagesData);
      lsSet("fb_pages", pagesData);
      if (!pagesData.length) { alert("No Facebook Pages found."); return; }
      setActivePage(pagesData[0]);
      lsSet("fb_active_page", pagesData[0]);
    } catch (err) { console.error(err); }
  };

  const login = () => {
    if (!sdkReady) { alert("Facebook SDK is still loading."); return; }
    window.FB.login(
      (r) => { if (r.authResponse) handleLogin(r.authResponse.accessToken); },
      { scope: "pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_posts" }
    );
  };

  const clearSession = () => {
    lsRemove("fb_pages"); lsRemove("fb_active_page");
    setPages([]); setActivePage(null); setPosts([]); setScheduledPosts([]); setEngagement({});
  };

  const logout = () => {
    if (!window.confirm("Disconnect your Facebook account?")) return;
    clearSession();
  };

  const fetchComments = useCallback(async (postId, token, after = null) => {
    setEngagement((prev) => ({ ...prev, [postId]: { ...prev[postId], loading: true, error: null } }));
    try {
      const params = { postId, token };
      if (after) params.after = after;
      const res = await api.get("/api/post-comments", { params });
      const newComments = res.data.data || [];
      const nextCursor  = res.data.paging?.cursors?.after || null;
      const hasNext     = !!res.data.paging?.next;
      setEngagement((prev) => ({
        ...prev,
        [postId]: {
          ...prev[postId],
          comments: after ? [...(prev[postId]?.comments || []), ...newComments] : newComments,
          nextCursor: hasNext ? nextCursor : null,
          loading: false,
        },
      }));
    } catch (err) {
      setEngagement((prev) => ({
        ...prev,
        [postId]: { ...prev[postId], loading: false, error: "Failed to load comments." },
      }));
    }
  }, []);

  const toggleComments = (post) => {
    const token = activePage?.access_token;
    const postId = post.id;
    const current = engagement[postId];
    if (current?.open) {
      setEngagement((prev) => ({ ...prev, [postId]: { ...prev[postId], open: false } }));
    } else {
      setEngagement((prev) => ({ ...prev, [postId]: { ...prev[postId], open: true } }));
      if (!current?.comments) fetchComments(postId, token);
    }
  };

  const handleCreatePost = async () => {
    if (!activePage) { alert("Please log in first."); return; }
    if (!postText.trim() && !postImage) { alert("Add some text or an image."); return; }
    if (scheduleMode && !scheduledTime) { alert("Pick a date and time to schedule."); return; }
    if (scheduleMode && new Date(scheduledTime) < new Date(Date.now() + 11 * 60 * 1000)) {
      alert("Scheduled time must be at least 10 minutes from now."); return;
    }
    setPosting(true); setPostStatus(null);
    try {
      const fd = new FormData();
      fd.append("pageId", activePage.id);
      fd.append("token", activePage.access_token);
      if (postText.trim()) fd.append("message", postText.trim());
      if (postImage) fd.append("image", postImage);
      if (scheduleMode && scheduledTime) fd.append("scheduledTime", new Date(scheduledTime).toISOString());
      const res = await api.post("/api/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } });
      if (res.data.scheduled) {
        setPostStatus({ type: "success", msg: `Scheduled for ${new Date(res.data.scheduledTime).toLocaleString()}` });
        fetchScheduledPosts(activePage.id, activePage.access_token);
      } else {
        setPostStatus({ type: "success", msg: "Post published successfully." });
        setTimeout(() => fetchPosts(activePage.id, activePage.access_token), 1500);
      }
      setPostText(""); removeImage(); setScheduleMode(false); setScheduledTime("");
    } catch (err) {
      if (err.response?.data?.error?.code === 190) { clearSession(); setPostStatus({ type: "error", msg: "Session expired." }); return; }
      setPostStatus({ type: "error", msg: err.response?.data?.error?.message || "Failed to publish." });
    } finally { setPosting(false); }
  };

  const dtMin = new Date(Date.now() + 11 * 60 * 1000).toISOString().slice(0, 16);
  const dtMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  /* ── Not connected ── */
  if (!isLoggedIn) {
    return (
      <div className="page-content">
        {postStatus && <div className={`status-banner ${postStatus.type}`} style={{ marginBottom: 20 }}>{postStatus.msg}</div>}
        <div className="connect-prompt">
          <div className="connect-prompt-icon" style={{ background: "#1877f2" }}>f</div>
          <h2>Connect Facebook</h2>
          <p>Link your Facebook Pages to schedule posts, view engagement, and manage comments.</p>
          <button className="btn btn-primary btn-lg" onClick={login} disabled={!sdkReady}>
            {sdkReady ? "Connect Facebook" : "Loading SDK…"}
          </button>
        </div>
      </div>
    );
  }

  /* ── Connected ── */
  return (
    <div className="page-content">
      {/* Page selector + logout */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div className="pages-row" style={{ marginBottom: 0 }}>
          {pages.map((p) => (
            <button
              key={p.id}
              className={`page-chip${activePage?.id === p.id ? " active" : ""}`}
              onClick={() => { setActivePage(p); lsSet("fb_active_page", p); }}
            >
              {p.name}
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-sm" onClick={logout} style={{ color: "var(--red)", flexShrink: 0 }}>
          Disconnect
        </button>
      </div>

      {postStatus && <div className={`status-banner ${postStatus.type}`} style={{ marginBottom: 20 }}>{postStatus.msg}</div>}

      {/* Compose */}
      {activePage && (
        <ComposeCard
          title="New Post"
          badge={activePage.name}
          placeholder="What's on your mind?"
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          imagePreview={imagePreview}
          onRemoveImage={removeImage}
          fileInputRef={fileInputRef}
          onImageChange={handleImageChange}
          postImage={postImage}
          status={null}
          actions={
            <>
              <button
                className={`btn btn-sm${scheduleMode ? " btn-primary" : " btn-outline"}`}
                onClick={() => { setScheduleMode((v) => !v); setScheduledTime(""); }}
                style={{ gap: 6 }}
              >
                <Clock size={13} />
                {scheduleMode ? "Scheduling on" : "Schedule"}
              </button>
              <button
                className="btn btn-primary btn-lg"
                style={{ marginLeft: "auto", gap: 6 }}
                onClick={handleCreatePost}
                disabled={posting}
              >
                <Send size={14} />
                {posting ? (scheduleMode ? "Scheduling…" : "Publishing…") : (scheduleMode ? "Schedule" : "Post Now")}
              </button>
            </>
          }
          extraRows={
            scheduleMode && (
              <div className="schedule-row">
                <span className="schedule-label">Publish at</span>
                <input type="datetime-local" className="dt-input" value={scheduledTime}
                  min={dtMin} max={dtMax} onChange={(e) => setScheduledTime(e.target.value)} />
                <span className="schedule-hint">10 min – 30 days from now</span>
              </div>
            )
          }
        />
      )}

      {/* Scheduled queue */}
      {activePage && (
        <div className="queue-section">
          <div className="queue-header">
            <span className="queue-title">Scheduled Posts</span>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", gap: 6 }}
              onClick={() => fetchScheduledPosts(activePage.id, activePage.access_token)}>
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {scheduledLoading && <div className="queue-empty">Loading…</div>}
          {!scheduledLoading && scheduledPosts.length === 0 && <div className="queue-empty">No scheduled posts.</div>}
          {scheduledPosts.map((sp) => {
            const thumb = sp.full_picture || sp.attachments?.data?.[0]?.media?.image?.src;
            return (
              <div key={sp.id} className="queue-item">
                <div className="queue-item-body">
                  <div className="queue-time">{new Date(sp.scheduled_publish_time * 1000).toLocaleString()}</div>
                  <div className="queue-msg">{sp.message || <i style={{ color: "var(--text-muted)" }}>(no text)</i>}</div>
                </div>
                {thumb && <img src={thumb} alt="thumb" className="queue-thumb" />}
                <button className="btn btn-danger btn-sm" disabled={cancellingId === sp.id}
                  onClick={() => cancelScheduledPost(sp.id)}>
                  {cancellingId === sp.id ? "Cancelling…" : "Cancel"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Feed */}
      <div className="feed-header">
        <span className="feed-title">Recent Posts{activePage ? ` — ${activePage.name}` : ""}</span>
        {activePage && (
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", gap: 6 }}
            onClick={() => fetchPosts(activePage.id, activePage.access_token)}>
            <RefreshCw size={12} /> Refresh
          </button>
        )}
      </div>
      {posts.length === 0 && <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No posts yet.</p>}
      {posts.map((post) => {
        const likeCount = post.likes?.summary?.total_count ?? null;
        const cmtCount  = post.comments?.summary?.total_count ?? null;
        const eng       = engagement[post.id] || {};
        const postImg   = post.full_picture || post.attachments?.data?.[0]?.media?.image?.src;
        const badges = [];
        if (likeCount !== null) badges.push({ label: `${likeCount} Like${likeCount !== 1 ? "s" : ""}`, className: "likes" });
        if (cmtCount  !== null) badges.push({ label: `${cmtCount} Comment${cmtCount !== 1 ? "s" : ""}`, className: "comments" });
        return (
          <PostCard
            key={post.id}
            timestamp={post.created_time}
            text={post.message}
            imageUrl={postImg}
            engagementBadges={badges}
            toggleLabel="Comments"
            isOpen={!!eng.open}
            onToggle={() => toggleComments(post)}
            showToggle={cmtCount > 0}
            items={eng.comments}
            itemLoading={eng.loading}
            itemError={eng.error}
            emptyLabel="No comments yet."
            loadingLabel="Loading comments…"
            nextCursor={eng.nextCursor}
            onLoadMore={() => fetchComments(post.id, activePage.access_token, eng.nextCursor)}
            renderItem={(c, i) => {
              const initials = (c.from?.name || "?").split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={i} className="cmt-item">
                  <div className="cmt-avatar">{initials}</div>
                  <div className="cmt-bubble">
                    <div className="cmt-name">{c.from?.name || "Unknown"}</div>
                    <div className="cmt-text">{c.message}</div>
                    <div className="cmt-time">{new Date(c.created_time).toLocaleString()}</div>
                  </div>
                </div>
              );
            }}
          />
        );
      })}
    </div>
  );
}
