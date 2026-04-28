import { useState, useEffect } from "react";
import api from "../api.js";
import "../App.css";
import { useImagePicker } from "../hooks/useImagePicker.js";
import { lsGet } from "../hooks/useLocalStorage.js";
import AppHeader from "../components/AppHeader.jsx";

// ── All supported platforms ────────────────────────────────────────────
const ALL_PLATFORMS = [
  {
    id: "facebook",
    label: "Facebook",
    icon: "f",
    color: "#1877f2",
    gradient: "linear-gradient(135deg, #1877f2 0%, #0f5ecf 100%)",
  },
  {
    id: "threads",
    label: "Threads",
    icon: "@",
    color: "#101010",
    gradient: "linear-gradient(135deg, #1a1a1a 0%, #3a3a3a 100%)",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: "in",
    color: "#0a66c2",
    gradient: "linear-gradient(135deg, #0a66c2 0%, #004182 100%)",
  },
  {
    id: "x",
    label: "X",
    icon: "𝕏",
    color: "#000000",
    gradient: "linear-gradient(135deg, #000 0%, #14171a 100%)",
  },
  {
    id: "instagram",
    label: "Instagram",
    icon: "◈",
    color: "#dd2a7b",
    gradient: "linear-gradient(135deg, #f58529 0%, #dd2a7b 50%, #8134af 100%)",
  },
];

// ── Read all sessions from localStorage ───────────────────────────────
function getSession() {
  return {
    facebook:  lsGet("fb_active_page")
                 ? { page: lsGet("fb_active_page") } : null,
    threads:   localStorage.getItem("threads_token") && lsGet("threads_profile")
                 ? { token: localStorage.getItem("threads_token"), profile: lsGet("threads_profile") } : null,
    linkedin:  localStorage.getItem("li_token") && lsGet("li_profile")
                 ? { token: localStorage.getItem("li_token"), profile: lsGet("li_profile") } : null,
    x:         localStorage.getItem("x_token") && lsGet("x_profile")
                 ? { token: localStorage.getItem("x_token"), profile: lsGet("x_profile") } : null,
    instagram: localStorage.getItem("ig_token") && lsGet("ig_account")
                 ? { token: localStorage.getItem("ig_token"), account: lsGet("ig_account") } : null,
  };
}

export default function BroadcastPage({ onBack }) {
  const [session, setSession] = useState(getSession);
  const [selected, setSelected] = useState({}); // { [platformId]: boolean }

  const [postText, setPostText]         = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [results, setResults]           = useState({});
  const [errors,  setErrors]            = useState({});

  const { postImage, imagePreview, fileInputRef, handleImageChange, removeImage } = useImagePicker();

  // Refresh session on mount
  useEffect(() => {
    const s = getSession();
    setSession(s);
    // Pre-select all connected platforms
    const initial = {};
    ALL_PLATFORMS.forEach((p) => {
      if (s[p.id]) initial[p.id] = true;
    });
    setSelected(initial);
  }, []);

  const isConnected = (id) => !!session[id];
  const isSelected  = (id) => !!selected[id];

  const toggleSelect = (id) => {
    if (!isConnected(id)) return; // can't select disconnected
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedConnected = ALL_PLATFORMS.filter((p) => isConnected(p.id) && isSelected(p.id));
  const anyConnected      = ALL_PLATFORMS.some((p) => isConnected(p.id));

  // ── Per-platform post functions ────────────────────────────────────
  const postToFacebook = () => {
    const { page } = session.facebook;
    const fd = new FormData();
    fd.append("pageId", page.id);
    fd.append("token", page.access_token);
    if (postText.trim()) fd.append("message", postText.trim());
    if (postImage) fd.append("image", postImage);
    return api.post("/api/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } });
  };

  const postToThreads = () => {
    const { token } = session.threads;
    const fd = new FormData();
    fd.append("token", token);
    if (postText.trim()) fd.append("text", postText.trim());
    if (postImage) fd.append("image", postImage);
    return api.post("/api/threads/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } });
  };

  const postToLinkedIn = () => {
    const { token, profile } = session.linkedin;
    const fd = new FormData();
    fd.append("token", token);
    fd.append("authorId", profile.sub || profile.id);
    if (postText.trim()) fd.append("text", postText.trim());
    if (postImage) fd.append("image", postImage);
    return api.post("/api/linkedin/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } });
  };

  const postToX = () => {
    const { token } = session.x;
    const fd = new FormData();
    fd.append("token", token);
    if (postText.trim()) fd.append("text", postText.trim());
    if (postImage) fd.append("image", postImage);
    return api.post("/api/x/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } });
  };

  const postToInstagram = () => {
    const { token, account } = session.instagram;
    const fd = new FormData();
    fd.append("token", token);
    fd.append("igId", account.igId);
    if (postText.trim()) fd.append("caption", postText.trim());
    if (postImage) fd.append("image", postImage);
    return api.post("/api/instagram/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } });
  };

  const postFns = { facebook: postToFacebook, threads: postToThreads, linkedin: postToLinkedIn, x: postToX, instagram: postToInstagram };

  // ── Broadcast ──────────────────────────────────────────────────────
  const handleBroadcast = async () => {
    if (!postText.trim() && !postImage) { alert("Add some text or an image."); return; }
    if (selectedConnected.length === 0) { alert("Select at least one platform."); return; }

    // Instagram requires an image
    if (isSelected("instagram") && isConnected("instagram") && !postImage) {
      alert("Instagram requires an image. Add one or deselect Instagram.");
      return;
    }

    setBroadcasting(true);
    const initResults = {};
    const initErrors  = {};
    selectedConnected.forEach((p) => { initResults[p.id] = "sending"; initErrors[p.id] = null; });
    setResults(initResults);
    setErrors(initErrors);

    const tasks = selectedConnected.map((p) =>
      postFns[p.id]()
        .then(() => setResults((r) => ({ ...r, [p.id]: "ok" })))
        .catch((err) => {
          setResults((r) => ({ ...r, [p.id]: "error" }));
          setErrors((e)  => ({
            ...e,
            [p.id]: err.response?.data?.error?.message
              || err.response?.data?.message
              || err.response?.data?.error
              || err.message
              || "Failed",
          }));
        })
    );

    await Promise.allSettled(tasks);
    setBroadcasting(false);
  };

  const statusIcon = (id) => ({ sending: "⏳", ok: "✅", error: "❌" }[results[id]] ?? null);
  const anyResult  = Object.keys(results).length > 0;

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      <AppHeader
        onBack={onBack}
        logo="✦"
        logoClass="broadcast-logo"
        title="Post to All"
        subtitle="Select platforms and publish"
      />

      {/* Platform selector */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.8px", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 12 }}>
          Select platforms to post to
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {ALL_PLATFORMS.map((p) => {
            const connected = isConnected(p.id);
            const sel       = isSelected(p.id);
            return (
              <button
                key={p.id}
                onClick={() => toggleSelect(p.id)}
                disabled={!connected}
                title={connected ? (sel ? `Deselect ${p.label}` : `Select ${p.label}`) : `Not logged in to ${p.label}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px 8px 10px",
                  borderRadius: 12,
                  border: sel
                    ? `2px solid ${p.color}`
                    : "2px solid var(--text-muted)",
                  background: sel
                    ? `${p.color}22`
                    : "var(--surface-2)",
                  cursor: connected ? "pointer" : "not-allowed",
                  opacity: connected ? 1 : 0.35,
                  transition: "all 0.15s",
                  fontFamily: "inherit",
                }}
              >
                {/* Platform icon */}
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: connected ? p.gradient : "var(--surface-2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 800,
                  flexShrink: 0,
                }}>
                  {p.icon}
                </span>

                {/* Label */}
                <span style={{ fontSize: 13, fontWeight: 600, color: sel ? p.color : "var(--text-primary)" }}>
                  {p.label}
                </span>

                {/* Checkmark */}
                <span style={{
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  border: sel ? `2px solid ${p.color}` : "2px solid var(--text-muted)",
                  background: sel ? p.color : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.15s",
                }}>
                  {sel && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {!anyConnected && (
          <div className="broadcast-warning error" style={{ marginTop: 12 }}>
            You're not logged in to any platform. Go back and log in first.
          </div>
        )}
      </div>

      {/* Compose area */}
      {anyConnected && (
        <div className="compose-card">
          <div className="compose-header">
            <span className="compose-title">✦ Broadcast Post</span>
            {selectedConnected.length > 0 && (
              <span className="compose-page-badge" style={{ background: "rgba(139,92,246,.15)", color: "#a78bfa" }}>
                {selectedConnected.length} platform{selectedConnected.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <textarea
            className="compose-textarea"
            placeholder="Write something to share…"
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            maxLength={280}
          />
          <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right", marginTop: 4 }}>
            {postText.length}/280
            <span style={{ marginLeft: 6, color: "var(--text-muted)" }}>(X limit)</span>
          </div>

          {imagePreview && (
            <div className="image-preview-wrap">
              <img src={imagePreview} alt="preview" />
              <button className="image-remove-btn" onClick={removeImage} aria-label="Remove image">✕</button>
            </div>
          )}

          <div className="compose-bar">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageChange}
            />
            <button className="btn btn-ghost" onClick={() => fileInputRef.current.click()}>
              📷 {postImage ? "Change Image" : "Add Image"}
            </button>
            <button
              className="btn btn-primary btn-lg broadcast-btn"
              style={{ marginLeft: "auto" }}
              onClick={handleBroadcast}
              disabled={broadcasting || selectedConnected.length === 0}
            >
              {broadcasting ? "Broadcasting…" : `✦ Post to ${selectedConnected.length || "…"}`}
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {anyResult && (
        <div className="broadcast-results">
          {ALL_PLATFORMS.filter((p) => results[p.id]).map((p) => {
            const icon = statusIcon(p.id);
            return (
              <div key={p.id} className={`broadcast-result-row ${results[p.id]}`}>
                <span className="brr-icon" style={{ background: p.gradient }}>{p.icon}</span>
                <span className="brr-label">{p.label}</span>
                <span className="brr-status">
                  {icon}{" "}
                  {results[p.id] === "ok"
                    ? "Published"
                    : results[p.id] === "error"
                    ? errors[p.id]
                    : "Sending…"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
