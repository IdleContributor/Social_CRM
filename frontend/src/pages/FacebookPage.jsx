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

export default function FacebookPage({ onBack }) {
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

  // ── Restore persisted session ──────────────────────────────────────
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

  // ── Load FB SDK ────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const cfg = await api.get("/api/config");
        const appId = cfg.data.appId;
        if (!appId) { console.warn("APP_ID missing"); return; }
        if (window.FB) { setSdkReady(true); return; }
        window.fbAsyncInit = function () {
          window.FB.init({ appId, cookie: true, xfbml: true, version: "v19.0" });
          setSdkReady(true);
        };
        const script = document.createElement("script");
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      } catch (err) {
        console.error("SDK load error:", err);
      }
    };
    init();
  }, []);

  // ── Data fetchers ──────────────────────────────────────────────────
  const fetchPosts = async (pageId, token) => {
    try {
      const res = await api.get(`/api/page-posts?pageId=${pageId}&token=${token}`);
      setPosts(res.data.data || []);
    } catch (err) {
      // FB token expired — clear session
      if (err.response?.data?.error?.code === 190) {
        clearSession();
        setPostStatus({ type: "error", msg: "Facebook session expired. Please log in again." });
      } else {
        console.error("Fetch posts error:", err);
      }
    }
  };

  const fetchScheduledPosts = async (pageId, token) => {
    setScheduledLoading(true);
    try {
      const res = await api.get(`/api/scheduled-posts?pageId=${pageId}&token=${token}`);
      setScheduledPosts(res.data.data || []);
    } catch (err) {
      console.error("Fetch scheduled posts error:", err);
    } finally {
      setScheduledLoading(false);
    }
  };

  const cancelScheduledPost = async (postId) => {
    if (!window.confirm("Cancel this scheduled post?")) return;
    setCancellingId(postId);
    try {
      await api.delete(`/api/scheduled-posts/${postId}?token=${activePage.access_token}`);
      setScheduledPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch (err) {
      alert(err.response?.data?.error?.message || "Failed to cancel post.");
    } finally {
      setCancellingId(null);
    }
  };

  // ── Facebook login / logout ────────────────────────────────────────
  const handleLogin = async (userToken) => {
    try {
      const pagesRes = await api.get(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}`
      );
      const pagesData = pagesRes.data.data || [];
      setPages(pagesData);
      lsSet("fb_pages", pagesData);
      if (pagesData.length === 0) {
        alert("No pages found. Make sure you manage a Facebook Page.");
        return;
      }
      const page = pagesData[0];
      setActivePage(page);
      lsSet("fb_active_page", page);
    } catch (err) {
      console.error("Graph API error:", err);
    }
  };

  const login = () => {
    if (!sdkReady) {
      alert("Facebook SDK is still loading, please wait a moment and try again.");
      return;
    }
    window.FB.login(
      (response) => {
        if (response.authResponse) handleLogin(response.authResponse.accessToken);
        else console.log("User cancelled login");
      },
      { scope: "pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_posts" }
    );
  };

  const clearSession = () => {
    lsRemove("fb_pages");
    lsRemove("fb_active_page");
    setPages([]);
    setActivePage(null);
    setPosts([]);
    setScheduledPosts([]);
    setEngagement({});
  };

  const logout = () => {
    if (!window.confirm("Disconnect your Facebook account?")) return;
    clearSession();
  };

  // ── Engagement ─────────────────────────────────────────────────────
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
        [postId]: { ...prev[postId], loading: false, error: err.response?.data?.error?.message || "Failed to load comments." },
      }));
    }
  }, []);

  const toggleComments = (post) => {
    const token   = activePage?.access_token;
    const postId  = post.id;
    const current = engagement[postId];
    if (current?.open) {
      setEngagement((prev) => ({ ...prev, [postId]: { ...prev[postId], open: false } }));
    } else {
      setEngagement((prev) => ({ ...prev, [postId]: { ...prev[postId], open: true } }));
      if (!current?.comments) fetchComments(postId, token);
    }
  };

  // ── Create post ────────────────────────────────────────────────────
  const handleCreatePost = async () => {
    if (!activePage) { alert("Please log in first."); return; }
    if (!postText.trim() && !postImage) { alert("Add some text or an image."); return; }
    if (scheduleMode) {
      if (!scheduledTime) { alert("Please pick a date and time to schedule."); return; }
      if (new Date(scheduledTime) < new Date(Date.now() + 11 * 60 * 1000)) {
        alert("Scheduled time must be at least 10 minutes from now.");
        return;
      }
    }

    setPosting(true);
    setPostStatus(null);
    try {
      const formData = new FormData();
      formData.append("pageId", activePage.id);
      formData.append("token", activePage.access_token);
      if (postText.trim()) formData.append("message", postText.trim());
      if (postImage) formData.append("image", postImage);
      if (scheduleMode && scheduledTime)
        formData.append("scheduledTime", new Date(scheduledTime).toISOString());

      const res = await api.post("/api/create-post", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.scheduled) {
        const when = new Date(res.data.scheduledTime).toLocaleString();
        setPostStatus({ type: "success", msg: `⏰ Post scheduled for ${when}` });
        fetchScheduledPosts(activePage.id, activePage.access_token);
      } else {
        setPostStatus({ type: "success", msg: "Post published successfully! 🎉" });
        setTimeout(() => fetchPosts(activePage.id, activePage.access_token), 1500);
      }

      setPostText("");
      removeImage();
      setScheduleMode(false);
      setScheduledTime("");
    } catch (err) {
      // FB token expired mid-session
      if (err.response?.data?.error?.code === 190) {
        clearSession();
        setPostStatus({ type: "error", msg: "Facebook session expired. Please log in again." });
        return;
      }
      setPostStatus({ type: "error", msg: err.response?.data?.error?.message || "Failed to publish post." });
    } finally {
      setPosting(false);
    }
  };

  const dtMin = new Date(Date.now() + 11 * 60 * 1000).toISOString().slice(0, 16);
  const dtMax = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <AppHeader onBack={onBack} logo="f" title="Facebook Page CRM" subtitle="Manage posts &amp; engagement">
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
            Please log in from the home page to access Facebook features.
          </p>
        </div>
      )}

      {isLoggedIn && (
        <>
          <div className="section-label">Your Pages</div>
          <div className="pages-row">
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
        </>
      )}

      {isLoggedIn && activePage && (
        <ComposeCard
          title="✏️ Create a Post"
          badge={activePage.name}
          placeholder="What's on your mind?"
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          imagePreview={imagePreview}
          onRemoveImage={removeImage}
          fileInputRef={fileInputRef}
          onImageChange={handleImageChange}
          postImage={postImage}
          status={postStatus}
          actions={
            <>
              <button
                className={`btn btn-schedule${scheduleMode ? " active" : ""}`}
                onClick={() => { setScheduleMode((v) => !v); setScheduledTime(""); }}
              >
                ⏰ {scheduleMode ? "Scheduling On" : "Schedule"}
              </button>
              <button
                className="btn btn-primary btn-lg"
                style={{ marginLeft: "auto" }}
                onClick={handleCreatePost}
                disabled={posting}
              >
                {posting
                  ? (scheduleMode ? "Scheduling…" : "Publishing…")
                  : (scheduleMode ? "⏰ Schedule Post" : "🚀 Post Now")}
              </button>
            </>
          }
          extraRows={
            scheduleMode && (
              <div className="schedule-row">
                <span className="schedule-label">📅 Publish at:</span>
                <input
                  type="datetime-local"
                  className="dt-input"
                  value={scheduledTime}
                  min={dtMin}
                  max={dtMax}
                  onChange={(e) => setScheduledTime(e.target.value)}
                />
                <span className="schedule-hint">10 min – 30 days from now</span>
              </div>
            )
          }
        />
      )}

      {isLoggedIn && activePage && (
        <div className="queue-section">
          <div className="queue-header">
            <span className="queue-title">⏰ Scheduled Posts</span>
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: "auto" }}
              onClick={() => fetchScheduledPosts(activePage.id, activePage.access_token)}
            >
              🔄 Refresh
            </button>
          </div>
          {scheduledLoading && <div className="queue-empty">Loading…</div>}
          {!scheduledLoading && scheduledPosts.length === 0 && (
            <div className="queue-empty">No scheduled posts.</div>
          )}
          {scheduledPosts.map((sp) => {
            const thumb = sp.full_picture || sp.attachments?.data?.[0]?.media?.image?.src;
            const isCancelling = cancellingId === sp.id;
            return (
              <div key={sp.id} className="queue-item">
                <div className="queue-item-body">
                  <div className="queue-time">📅 {new Date(sp.scheduled_publish_time * 1000).toLocaleString()}</div>
                  <div className="queue-msg">
                    {sp.message || <i style={{ color: "var(--text-muted)" }}>(no text)</i>}
                  </div>
                </div>
                {thumb && <img src={thumb} alt="thumb" className="queue-thumb" />}
                <button
                  className="btn btn-danger btn-sm"
                  disabled={isCancelling}
                  onClick={() => cancelScheduledPost(sp.id)}
                >
                  {isCancelling ? "Cancelling…" : "Cancel"}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isLoggedIn && (
        <>
          <div className="feed-header">
            <span className="feed-title">Recent Posts{activePage ? ` — ${activePage.name}` : ""}</span>
            {activePage && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginLeft: "auto" }}
                onClick={() => fetchPosts(activePage.id, activePage.access_token)}
              >
                🔄 Refresh
              </button>
            )}
          </div>
          {posts.length === 0 && (
            <p style={{ color: "var(--text-muted)", fontSize: 14, padding: "12px 0" }}>No posts fetched yet.</p>
          )}
          {posts.map((post) => {
            const likeCount = post.likes?.summary?.total_count ?? null;
            const cmtCount  = post.comments?.summary?.total_count ?? null;
            const eng       = engagement[post.id] || {};
            const postImg   = post.full_picture || post.attachments?.data?.[0]?.media?.image?.src;
            const badges = [];
            if (likeCount !== null) badges.push({ label: `👍 ${likeCount} ${likeCount === 1 ? "Like" : "Likes"}`, className: "likes" });
            if (cmtCount  !== null) badges.push({ label: `💬 ${cmtCount} ${cmtCount === 1 ? "Comment" : "Comments"}`, className: "comments" });
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
        </>
      )}
    </div>
  );
}
