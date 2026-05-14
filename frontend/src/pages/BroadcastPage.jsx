import { useState, useEffect } from "react";
import api from "../api.js";
import "../App.css";
import { useImagePicker } from "../hooks/useImagePicker.js";
import { lsGet } from "../hooks/useLocalStorage.js";
import { ImagePlus, Send, X as XIcon } from "lucide-react";

const ALL_PLATFORMS = [
  { id: "facebook",  label: "Facebook",  icon: "f",  bg: "#1877f2",  gradient: "linear-gradient(135deg,#1877f2,#0f5ecf)" },
  { id: "threads",   label: "Threads",   icon: "@",  bg: "#101010",  gradient: "linear-gradient(135deg,#1a1a1a,#3a3a3a)" },
  { id: "linkedin",  label: "LinkedIn",  icon: "in", bg: "#0a66c2",  gradient: "linear-gradient(135deg,#0a66c2,#004182)" },
  { id: "x",         label: "X",         icon: "𝕏",  bg: "#000",     gradient: "linear-gradient(135deg,#000,#14171a)" },
  { id: "instagram", label: "Instagram", icon: "◈",  bg: "#dd2a7b",  gradient: "linear-gradient(135deg,#f58529,#dd2a7b,#8134af)" },
];

const PLATFORM_LIMITS = { facebook: 63206, threads: 500, linkedin: 3000, x: 280, instagram: 2200 };

function getSession() {
  return {
    facebook:  lsGet("fb_active_page") ? { page: lsGet("fb_active_page") } : null,
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

export default function BroadcastPage() {
  const [session, setSession]   = useState(getSession);
  const [selected, setSelected] = useState({});
  const [postText, setPostText] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);
  const [confirming, setConfirming]     = useState(false);
  const [results, setResults]   = useState({});
  const [errors, setErrors]     = useState({});
  const { postImage, imagePreview, fileInputRef, handleImageChange, removeImage } = useImagePicker();

  useEffect(() => {
    const s = getSession();
    setSession(s);
    const initial = {};
    ALL_PLATFORMS.forEach((p) => { if (s[p.id]) initial[p.id] = true; });
    setSelected(initial);
  }, []);

  const isConnected = (id) => !!session[id];
  const isSelected  = (id) => !!selected[id];
  const toggleSelect = (id) => {
    if (!isConnected(id)) return;
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
    setConfirming(false);
  };

  const selectedConnected = ALL_PLATFORMS.filter((p) => isConnected(p.id) && isSelected(p.id));
  const anyConnected      = ALL_PLATFORMS.some((p) => isConnected(p.id));

  // Dynamic char limit — tightest limit among selected platforms
  const effectiveLimit = selectedConnected.length > 0
    ? Math.min(...selectedConnected.map((p) => PLATFORM_LIMITS[p.id] ?? Infinity))
    : 280;
  const limitPlatform = selectedConnected.find((p) => PLATFORM_LIMITS[p.id] === effectiveLimit);

  // Post functions
  const postToFacebook  = () => { const { page } = session.facebook; const fd = new FormData(); fd.append("pageId", page.id); fd.append("token", page.access_token); if (postText.trim()) fd.append("message", postText.trim()); if (postImage) fd.append("image", postImage); return api.post("/api/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } }); };
  const postToThreads   = () => { const { token } = session.threads; const fd = new FormData(); fd.append("token", token); if (postText.trim()) fd.append("text", postText.trim()); if (postImage) fd.append("image", postImage); return api.post("/api/threads/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } }); };
  const postToLinkedIn  = () => { const { token, profile } = session.linkedin; const fd = new FormData(); fd.append("token", token); fd.append("authorId", profile.sub || profile.id); if (postText.trim()) fd.append("text", postText.trim()); if (postImage) fd.append("image", postImage); return api.post("/api/linkedin/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } }); };
  const postToX         = () => { const { token } = session.x; const fd = new FormData(); fd.append("token", token); if (postText.trim()) fd.append("text", postText.trim()); if (postImage) fd.append("image", postImage); return api.post("/api/x/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } }); };
  const postToInstagram = () => { const { token, account } = session.instagram; const fd = new FormData(); fd.append("token", token); fd.append("igId", account.igId); if (postText.trim()) fd.append("caption", postText.trim()); if (postImage) fd.append("image", postImage); return api.post("/api/instagram/create-post", fd, { headers: { "Content-Type": "multipart/form-data" } }); };
  const postFns = { facebook: postToFacebook, threads: postToThreads, linkedin: postToLinkedIn, x: postToX, instagram: postToInstagram };

  const handleBroadcast = async () => {
    if (!postText.trim() && !postImage) { alert("Add some text or an image."); return; }
    if (selectedConnected.length === 0) { alert("Select at least one platform."); return; }
    if (isSelected("instagram") && isConnected("instagram") && !postImage) {
      alert("Instagram requires an image. Add one or deselect Instagram."); return;
    }
    setBroadcasting(true); setConfirming(false);
    const initResults = {}; const initErrors = {};
    selectedConnected.forEach((p) => { initResults[p.id] = "sending"; initErrors[p.id] = null; });
    setResults(initResults); setErrors(initErrors);
    const tasks = selectedConnected.map((p) =>
      postFns[p.id]()
        .then(() => setResults((r) => ({ ...r, [p.id]: "ok" })))
        .catch((err) => {
          setResults((r) => ({ ...r, [p.id]: "error" }));
          setErrors((e) => ({ ...e, [p.id]: err.response?.data?.error?.message || err.response?.data?.message || err.response?.data?.error || err.message || "Failed" }));
        })
    );
    await Promise.allSettled(tasks);
    setBroadcasting(false);
  };

  const anyResult = Object.keys(results).length > 0;

  return (
    <div className="page-content">

      {/* Section heading */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span className="section-label-pill">Broadcast</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
            Post to all platforms at once
          </span>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
          Select which platforms to post to, write your content, and publish everywhere simultaneously.
        </p>
      </div>

      {/* Platform toggles */}
      <div style={{ marginBottom: 24 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>Post to</div>
        <div className="platform-selector">
          {ALL_PLATFORMS.map((p) => {
            const connected = isConnected(p.id);
            const sel       = isSelected(p.id);
            return (
              <button
                key={p.id}
                className={`platform-toggle${sel ? " selected" : ""}`}
                onClick={() => toggleSelect(p.id)}
                disabled={!connected}
                title={!connected ? `Not connected to ${p.label}` : undefined}
              >
                <span className="pt-icon" style={{ background: connected ? p.bg : "var(--surface-2)" }}>
                  {p.icon}
                </span>
                {p.label}
                {!connected && (
                  <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 2 }}>—</span>
                )}
                <span className="pt-check">
                  {sel && (
                    <svg width="9" height="7" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {!anyConnected && (
          <div className="broadcast-warning error">
            You're not connected to any platform. Go to Overview and connect at least one.
          </div>
        )}
      </div>

      {/* Compose */}
      {anyConnected && (
        <div className="compose-card" style={{ marginBottom: 20 }}>
          <div className="compose-header">
            <span className="compose-title">Your post</span>
            {selectedConnected.length > 0 && (
              <span className="compose-page-badge">
                {selectedConnected.length} platform{selectedConnected.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          <textarea
            className="compose-textarea"
            placeholder="Write something to share across all selected platforms…"
            value={postText}
            onChange={(e) => { setPostText(e.target.value); setConfirming(false); }}
            maxLength={effectiveLimit}
          />
          <div style={{ fontSize: 12, color: postText.length >= effectiveLimit * 0.9 ? "var(--red)" : "var(--text-muted)", textAlign: "right", marginTop: 4 }}>
            {postText.length}/{effectiveLimit}
            {limitPlatform && (
              <span style={{ marginLeft: 6, color: "var(--text-muted)" }}>
                ({limitPlatform.label} limit)
              </span>
            )}
          </div>

          {imagePreview && (
            <div className="image-preview-wrap">
              <img src={imagePreview} alt="preview" />
              <button className="image-remove-btn" onClick={removeImage} aria-label="Remove image">
                <XIcon size={12} />
              </button>
            </div>
          )}

          <div className="compose-bar">
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
            <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()} style={{ gap: 6 }}>
              <ImagePlus size={14} />
              {postImage ? "Change Image" : "Add Image"}
            </button>

            {/* Confirm / Broadcast button */}
            {!confirming ? (
              <button
                className="btn btn-primary btn-lg"
                style={{ marginLeft: "auto", gap: 6 }}
                onClick={() => {
                  if (!postText.trim() && !postImage) { alert("Add some text or an image."); return; }
                  if (selectedConnected.length === 0) { alert("Select at least one platform."); return; }
                  setConfirming(true);
                }}
                disabled={broadcasting || selectedConnected.length === 0}
              >
                <Send size={14} />
                Post to {selectedConnected.length || "…"}
              </button>
            ) : (
              <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Post to {selectedConnected.map((p) => p.label).join(", ")}?
                </span>
                <button className="btn btn-outline btn-sm" onClick={() => setConfirming(false)}>
                  Cancel
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleBroadcast} disabled={broadcasting} style={{ gap: 6 }}>
                  <Send size={13} />
                  {broadcasting ? "Posting…" : "Confirm"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {anyResult && (
        <>
          <div className="section-label" style={{ marginBottom: 12 }}>Results</div>
          <div className="broadcast-results">
            {ALL_PLATFORMS.filter((p) => results[p.id]).map((p) => (
              <div key={p.id} className={`broadcast-result-row ${results[p.id]}`}>
                <span className="brr-icon" style={{ background: p.gradient }}>{p.icon}</span>
                <span className="brr-label">{p.label}</span>
                <span className="brr-status">
                  {results[p.id] === "ok"   && "Published"}
                  {results[p.id] === "error" && (errors[p.id] || "Failed")}
                  {results[p.id] === "sending" && "Sending…"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
