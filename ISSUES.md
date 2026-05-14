# Social CRM — Issues & Fix Plan

A prioritised, executable remediation plan. Issues are grouped into phases so
each phase can be completed, tested, and committed independently before moving
to the next.

---

## Phase 1 — Critical Security Fixes
> Fix these before any public deployment. Each item is self-contained.

---

### [SEC-01] All tokens stored in localStorage (XSS-vulnerable)
**Files:** `backend/routes/auth.js`, `frontend/src/AuthContext.jsx`, all platform pages  
**Risk:** Any XSS vector can steal every token — app JWT, Facebook, LinkedIn, X, Instagram, Threads.

**Fix:**
- Move the **app JWT** to an `httpOnly; Secure; SameSite=Strict` cookie issued by the backend.
- Remove `localStorage.setItem("app_token", ...)` from `AuthContext.jsx`.
- Update `GET /auth/me` to read the cookie instead of the `Authorization` header.
- Platform OAuth tokens (Facebook page token, etc.) are third-party tokens that must stay client-side; keep them in `sessionStorage` instead of `localStorage` so they don't persist across browser sessions and are not accessible to service workers.
- Update all `localStorage.getItem("x_token")` / `lsGet(...)` calls in every page and `usePlatformSessions.js` to use `sessionStorage`.

```js
// backend/routes/auth.js — after signing the JWT
res.cookie("app_token", token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
});
res.json({ user }); // no token in body

// backend/middleware/auth.js — read cookie
const token = req.cookies?.app_token || req.headers["authorization"]?.split(" ")[1];
```

Add `cookie-parser` to backend dependencies and `app.use(cookieParser())` in `server.js`.

---

### [SEC-02] OAuth tokens passed as URL query parameters
**Files:** `backend/routes/linkedin.js`, `backend/routes/x.js`, `backend/routes/instagram.js`  
**Risk:** Tokens appear in server access logs, browser history, and `Referer` headers.

**Fix:**
Replace the `?li_token=...` / `?x_token=...` / `?ig_token=...` redirect pattern with a **short-lived one-time code** pattern:

1. After token exchange, generate a random `code = crypto.randomBytes(16).toString("hex")`.
2. Store `{ code → { token, expiresAt: Date.now() + 60_000 } }` in a server-side Map (or Redis).
3. Redirect to `${FRONTEND_URL}/callback?platform=linkedin&code=<code>`.
4. Add a new backend endpoint `GET /auth/callback-token?code=<code>` that returns the token once and deletes the entry.
5. Frontend calls this endpoint on mount when it detects a `code` param, then stores the token in `sessionStorage`.

```js
// backend — shared token store (replace with Redis in production)
const callbackTokens = new Map();

function storeCallbackToken(token) {
  const code = crypto.randomBytes(16).toString("hex");
  callbackTokens.set(code, { token, expiresAt: Date.now() + 60_000 });
  setTimeout(() => callbackTokens.delete(code), 60_000);
  return code;
}

// GET /auth/callback-token
router.get("/callback-token", (req, res) => {
  const entry = callbackTokens.get(req.query.code);
  if (!entry || Date.now() > entry.expiresAt) {
    return res.status(410).json({ error: "Code expired or invalid" });
  }
  callbackTokens.delete(req.query.code);
  res.json({ token: entry.token });
});
```

---

### [SEC-03] PKCE verifier lost on server restart / multi-instance
**File:** `backend/routes/x.js`  
**Risk:** All in-flight X OAuth logins fail silently after any deploy or crash.

**Fix:**
- Short-term: add a startup log warning if `NODE_ENV === "production"` and no Redis URL is configured.
- Proper fix: replace `pkceStore` Map with Redis (`ioredis`) using `SET key value EX 600`.
- If Redis is not available, fall back to a signed, time-limited cookie on the OAuth redirect (store `state:verifier` in a `httpOnly` cookie set at `/x/auth-url`, read it back at `/x/callback`).

```js
// Cookie-based fallback (no Redis required)
// In GET /x/auth-url:
res.cookie(`pkce_${state}`, codeVerifier, {
  httpOnly: true, secure: true, sameSite: "lax", maxAge: 600_000,
});
res.json({ url: `https://twitter.com/i/oauth2/authorize?${params}` });

// In GET /x/callback:
const codeVerifier = req.cookies[`pkce_${state}`];
res.clearCookie(`pkce_${state}`);
```

---

### [SEC-04] `APP_SECRET` missing from config exports
**File:** `backend/config.js`  
**Risk:** `APP_SECRET` is read from `process.env` but never exported. Instagram and Facebook routes that need it get `undefined`, causing silent auth failures.

**Fix:** Add `APP_SECRET` to the `module.exports` object and update all routes that use it to import from config.

```js
// backend/config.js — add to module.exports
APP_SECRET: process.env.APP_SECRET,

// backend/routes/instagram.js — destructure from config
const { APP_ID, APP_SECRET, ... } = require("../config");
```

---

### [SEC-05] `authLimiter` not applied to the active auth endpoint
**File:** `backend/routes/auth.js`  
**Risk:** `POST /auth/google/token` (the endpoint the frontend actually uses) has no rate limit. Only the unused `POST /auth/google` is rate-limited.

**Fix:**
```js
// backend/routes/auth.js
router.post("/google/token", authLimiter, async (req, res) => { ... });
```

---

### [SEC-06] Google Client ID committed to repository
**File:** `frontend/.env.local`  
**Risk:** Real credential value is in a tracked file.

**Fix:**
1. Add `.env.local` to `frontend/.gitignore` (it should already be there — verify).
2. Rotate the Google OAuth client if the repo is public.
3. Add `.env.local` to the root `.gitignore` as a catch-all.

---

## Phase 2 — Bug Fixes & Code Correctness

---

### [BUG-01] Duplicate localStorage cleanup in every `clearSession`
**Files:** All platform pages (`XPage.jsx`, `LinkedInPage.jsx`, `ThreadsPage.jsx`, `InstagramPage.jsx`, `FacebookPage.jsx`)  
**Issue:** Every `clearSession` calls both `lsRemove("x_token")` AND `localStorage.removeItem("x_token")` — identical operations.

**Fix:** Remove the raw `localStorage.removeItem(...)` calls; `lsRemove` already wraps it.

```js
// Before
lsRemove("x_token");
localStorage.removeItem("x_token"); // ← delete this line

// After
lsRemove("x_token");
```

---

### [BUG-02] FB SDK loaded twice
**Files:** `frontend/src/pages/HomePage.jsx`, `frontend/src/pages/FacebookPage.jsx`, `frontend/src/hooks/usePlatformLogin.js`  
**Issue:** `useFacebookSDK` hook is called in `HomePage` and the SDK is also loaded manually inside `FacebookPage`. The `if (window.FB) return` guard prevents double-init but the logic is duplicated and fragile.

**Fix:** Remove the manual SDK load from `FacebookPage.jsx`. It should rely solely on `useFacebookSDK()` which is already called in `HomePage`. Since `FacebookPage` is only reachable after `HomePage` has mounted, the SDK will always be ready.

---

### [BUG-03] No error boundaries
**Files:** `frontend/src/main.jsx`, `frontend/src/App.jsx`  
**Issue:** Any unhandled render error crashes the entire app to a blank screen.

**Fix:** Add a simple `ErrorBoundary` class component and wrap `<App />` with it.

```jsx
// frontend/src/ErrorBoundary.jsx
import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, textAlign: "center", color: "var(--red)" }}>
          <h2>Something went wrong</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14 }}>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// frontend/src/main.jsx
import ErrorBoundary from "./ErrorBoundary.jsx";
// wrap <App /> with <ErrorBoundary>
```

---

### [BUG-04] `ngrok` in production dependencies
**File:** `frontend/package.json`  
**Issue:** `ngrok` is a dev tunneling tool listed under `dependencies`, not `devDependencies`. It gets bundled into the production build.

**Fix:**
```json
// Move from dependencies to devDependencies
"devDependencies": {
  "ngrok": "^5.0.0-beta.2",
  ...
}
```

---

### [BUG-05] Dead files cluttering the project
**Files:**
- `frontend/src/components/ui/animated-hero.jsx` — never imported
- `frontend/src/components/ui/animated-hero-demo.jsx` — never imported
- `frontend/src/LoginScreen.css` — never imported (LoginScreen uses inline styles)
- `backend/SIGNUP_component.jsx` — React component in the backend directory, never used

**Fix:** Delete all four files.

---

### [BUG-06] Broadcast character limit ignores selected platforms
**File:** `frontend/src/pages/BroadcastPage.jsx`  
**Issue:** `maxLength={280}` and the counter label `(X limit)` are hardcoded regardless of whether X is selected.

**Fix:** Compute the effective limit dynamically.

```js
// Derive the tightest character limit from selected platforms
const PLATFORM_LIMITS = { facebook: 63206, threads: 500, linkedin: 3000, x: 280, instagram: 2200 };

const effectiveLimit = selectedConnected.length > 0
  ? Math.min(...selectedConnected.map((p) => PLATFORM_LIMITS[p.id] ?? Infinity))
  : 280;

const limitLabel = selectedConnected.find((p) => PLATFORM_LIMITS[p.id] === effectiveLimit)?.label ?? "";

// In JSX
<textarea maxLength={effectiveLimit} ... />
<div>{postText.length}/{effectiveLimit} <span>({limitLabel} limit)</span></div>
```

---

### [BUG-07] Platform pages show dead-end "log in from home page" with no action
**Files:** All platform pages  
**Issue:** When a user lands on a platform page without a session, they see a message with no login button — they must manually navigate back.

**Fix:** Add a login button directly on the not-logged-in state of each platform page, reusing the same login handler from `usePlatformLogin.js`.

```jsx
// Example for XPage.jsx — replace the dead-end paragraph
{!isLoggedIn && (
  <div style={{ padding: "60px 20px", textAlign: "center" }}>
    <p style={{ color: "var(--text-muted)", fontSize: 15, marginBottom: 20 }}>
      Connect your X account to get started.
    </p>
    <button className="btn btn-primary btn-lg x-post-btn" onClick={login}>
      Connect X Account
    </button>
  </div>
)}
```

---

## Phase 3 — UI/UX Polish

---

### [UI-01] Replace all `alert()` / `confirm()` with in-app UI
**Files:** All platform pages, `BroadcastPage.jsx`, `FacebookPage.jsx`  
**Issue:** Native browser dialogs are jarring, block the thread, and break the visual design.

**Fix:** Build a lightweight `useToast` hook + `<ToastContainer>` component.

```jsx
// frontend/src/hooks/useToast.js
import { useState, useCallback } from "react";

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(({ type = "info", message, duration = 4000 }) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);

  return { toasts, toast };
}
```

```jsx
// frontend/src/components/ToastContainer.jsx
export default function ToastContainer({ toasts }) {
  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 9999, display: "flex", flexDirection: "column", gap: 8 }}>
      {toasts.map((t) => (
        <div key={t.id} className={`status-banner ${t.type}`} style={{ minWidth: 280, boxShadow: "var(--shadow-lg)" }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
```

Replace all `alert("...")` with `toast({ type: "error", message: "..." })` and all `confirm("...")` with an inline confirmation state (e.g., a "Are you sure? [Cancel] [Confirm]" row that appears in place of the button).

---

### [UI-02] ThemeToggle overlaps header content
**File:** `frontend/src/components/ThemeToggle.jsx`, `frontend/src/index.css`  
**Issue:** Fixed-position toggle at `top: 16px; right: 16px` collides with the user avatar and sign-out button in the header.

**Fix:** Move `ThemeToggle` into the `AppHeader` right-side slot on the home page, and into the header children on platform pages. Remove the `position: fixed` styling.

```jsx
// AppHeader.jsx — add theme toggle as last child in the header
// HomePage.jsx — pass <ThemeToggle /> as part of the header children slot
// Remove fixed positioning from .theme-toggle in index.css
```

---

### [UI-03] No loading skeletons
**Files:** All platform pages  
**Issue:** "Verifying session…" and "Loading…" are plain text with no visual feedback.

**Fix:** Add a `<Skeleton>` component and use it for the post feed and compose card while loading.

```jsx
// frontend/src/components/Skeleton.jsx
export function Skeleton({ width = "100%", height = 20, borderRadius = 8, style = {} }) {
  return (
    <div
      style={{
        width, height, borderRadius,
        background: "var(--surface-2)",
        animation: "skeleton-pulse 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  );
}
// Add to index.css:
// @keyframes skeleton-pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
```

Use `<Skeleton />` blocks in place of "Loading…" text in post feeds and during token verification.

---

### [UI-04] Replace emoji icons with Lucide icons
**Files:** All pages and components  
**Issue:** Emoji render inconsistently across OS/browser. `lucide-react` is already installed.

**Fix:** Replace the most visible emoji with Lucide equivalents:

| Current | Replace with |
|---------|-------------|
| 🚪 Logout | `<LogOut size={14} />` |
| 🔄 Refresh | `<RefreshCw size={14} />` |
| 📷 Add Image | `<ImagePlus size={14} />` |
| 🚀 Post | `<Send size={14} />` |
| ← Back | `<ArrowLeft size={14} />` |
| ⏰ Schedule | `<Clock size={14} />` |
| ✕ Remove | `<X size={12} />` |

---

### [UI-05] FloatingCard Unsplash images — external dependency
**File:** `frontend/src/pages/HomePage.jsx`  
**Issue:** Platform card images are loaded from `images.unsplash.com` — external dependency, slow on first load, unnecessary network requests.

**Fix:** Remove the `image` prop from all `FloatingCard` entries in `PLATFORMS`. The cards look clean without the image strip; the gradient, icon, and description are sufficient. Alternatively, replace with a subtle SVG pattern or solid gradient background baked into the card.

---

### [UI-06] FloatingCard particle animation always running
**File:** `frontend/src/components/ui/floating-card.jsx`  
**Issue:** `useParticles(available)` runs a `setInterval` for every card on screen, spawning DOM nodes continuously even when the user isn't interacting.

**Fix:** Only activate particles on hover.

```jsx
// floating-card.jsx
const [isHovered, setIsHovered] = useState(false);
const particles = useParticles(available && isHovered);

// On the outer div:
onMouseEnter={() => { setIsHovered(true); if (available) handleMouseMove(...); }}
onMouseLeave={() => { setIsHovered(false); handleMouseLeave(); }}
```

---

### [UI-07] Status banners hidden when logged in
**Files:** All platform pages  
**Issue:** `postStatus?.type === "error" && !isLoggedIn` means success/error messages while logged in are only visible inside the ComposeCard and can be missed.

**Fix:** Remove the `!isLoggedIn` condition. Show the status banner at the top of the page for all states, and auto-dismiss it after 5 seconds.

```jsx
// Replace the conditional banner with:
{postStatus && (
  <div className={`status-banner ${postStatus.type}`} style={{ marginBottom: 16 }}>
    {postStatus.msg}
  </div>
)}

// Auto-dismiss in the post handler:
setPostStatus({ type: "success", msg: "Posted! 🎉" });
setTimeout(() => setPostStatus(null), 5000);
```

---

### [UI-08] No broadcast confirmation step
**File:** `frontend/src/pages/BroadcastPage.jsx`  
**Issue:** Clicking "Post to N" immediately fires requests to all platforms with no review step.

**Fix:** Add a confirmation state that shows a summary before posting.

```jsx
const [confirming, setConfirming] = useState(false);

// Replace the broadcast button with:
{!confirming ? (
  <button className="btn btn-primary btn-lg broadcast-btn"
    onClick={() => setConfirming(true)}
    disabled={selectedConnected.length === 0}>
    ✦ Review & Post to {selectedConnected.length || "…"}
  </button>
) : (
  <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
    <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
    <button className="btn btn-primary btn-lg broadcast-btn" onClick={handleBroadcast} disabled={broadcasting}>
      {broadcasting ? "Broadcasting…" : `Confirm — Post to ${selectedConnected.length}`}
    </button>
  </div>
)}
```

---

### [UI-09] No draft persistence
**Files:** All platform pages  
**Issue:** Compose text is lost on navigation.

**Fix:** Persist draft text to `sessionStorage` per platform, restore on mount.

```js
// In each platform page, replace useState("") for postText with:
const [postText, setPostText] = useState(() => sessionStorage.getItem("draft_x") || "");

// On change:
const handleTextChange = (e) => {
  setPostText(e.target.value);
  sessionStorage.setItem("draft_x", e.target.value);
};

// On successful post, clear the draft:
sessionStorage.removeItem("draft_x");
```

---

### [UI-10] Frontend image validation before upload
**File:** `frontend/src/hooks/useImagePicker.js`  
**Issue:** No file size, format, or dimension validation. Instagram has strict requirements that cause silent API failures.

**Fix:** Add validation in `handleImageChange`.

```js
const MAX_SIZE_MB = 8;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const handleImageChange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!ALLOWED_TYPES.includes(file.type)) {
    onError?.(`Unsupported format. Use JPEG, PNG, WebP, or GIF.`);
    return;
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    onError?.(`Image must be under ${MAX_SIZE_MB}MB.`);
    return;
  }
  setPostImage(file);
  const reader = new FileReader();
  reader.onload = (ev) => setImagePreview(ev.target.result);
  reader.readAsDataURL(file);
};
```

Add an optional `onError` prop to `useImagePicker` and wire it to the toast system.

---

## Phase 4 — Missing Capabilities

---

### [FEAT-01] X post feed
**Files:** `frontend/src/pages/XPage.jsx`, `backend/routes/x.js`  
**Issue:** X page is post-only. No way to see recent tweets or engagement.

**Fix:**
1. Add `GET /api/x/timeline` backend route using `GET /2/users/:id/tweets` with `tweet.fields=created_at,public_metrics,attachments`.
2. Add feed state + fetch to `XPage.jsx`.
3. Render using the existing `PostCard` component.

```js
// backend/routes/x.js
router.get("/timeline", requireAuth, async (req, res) => {
  const { token, userId } = req.query;
  if (!token || !userId) return res.status(400).json({ error: "token and userId required" });
  try {
    const response = await axios.get(`${X_API}/users/${userId}/tweets`, {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        max_results: 10,
        "tweet.fields": "created_at,public_metrics,attachments",
        expansions: "attachments.media_keys",
        "media.fields": "url,preview_image_url",
      },
    });
    res.json(response.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(err.response?.data || { error: "Failed to fetch timeline" });
  }
});
```

---

### [FEAT-02] LinkedIn post feed
**Files:** `frontend/src/pages/LinkedInPage.jsx`, `backend/routes/linkedin.js`  
**Issue:** LinkedIn page is post-only. The backend already has `GET /linkedin/posts` but the frontend never calls it.

**Fix:** Wire up the existing backend endpoint in `LinkedInPage.jsx`. Fetch posts after login using `profile.sub` as `authorId`. Render with `PostCard`.

```js
// LinkedInPage.jsx — add after isLoggedIn is confirmed
const fetchPosts = async () => {
  setPostsLoading(true);
  try {
    const res = await api.get("/api/linkedin/posts", {
      params: { token: accessToken, authorId: profile.sub || profile.id },
    });
    setPosts(res.data.elements || []);
  } catch (err) {
    console.error("LinkedIn posts fetch failed:", err);
  } finally {
    setPostsLoading(false);
  }
};
```

---

### [FEAT-03] Comment/reply capability
**Files:** `frontend/src/pages/FacebookPage.jsx`, `frontend/src/pages/ThreadsPage.jsx`, `backend/routes/facebook.js`, `backend/routes/threads.js`  
**Issue:** Comments and replies are readable but not actionable. No way to reply from the app.

**Fix:**
1. Add `POST /api/post-comments` backend route (Facebook Graph `/{commentId}/comments`).
2. Add `POST /api/threads/reply` backend route (Threads `/{mediaId}/threads` with `reply_to_id`).
3. Add an inline reply input that appears when a comment is expanded — a small textarea + send button inside `PostCard`'s comment section.

---

### [FEAT-04] Scheduled posts for all platforms
**Files:** `frontend/src/pages/ThreadsPage.jsx`, `frontend/src/pages/LinkedInPage.jsx`, `frontend/src/pages/XPage.jsx`  
**Issue:** Scheduling only works for Facebook. Other platforms don't support native scheduling via their APIs, but the app can implement its own queue.

**Fix:** Add a lightweight server-side job queue:
1. Add a `scheduled_posts` table/store (JSON file or SQLite via `better-sqlite3` for simplicity).
2. Add `POST /api/schedule` endpoint that stores `{ platform, payload, scheduledAt }`.
3. Add a cron job (using `node-cron`) that runs every minute, checks for due posts, and fires them.
4. Add a `GET /api/schedule` endpoint to list pending jobs.
5. Wire up the existing schedule UI in `ComposeCard` for all platforms.

---

### [FEAT-05] Token refresh / expiry handling
**Files:** All platform pages, `frontend/src/api.js`  
**Issue:** No token refresh flow. When tokens expire users are silently kicked out.

**Fix:**
1. Add an Axios response interceptor in `api.js` that catches `401` responses.
2. On `401`, clear the platform session and show a toast: "Your [Platform] session expired. Please reconnect."
3. For LinkedIn and Instagram (60-day long-lived tokens), add a `GET /api/linkedin/refresh` and `GET /api/instagram/refresh` backend route that exchanges the current token for a new one before it expires.

```js
// frontend/src/api.js
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Emit a custom event that platform pages can listen to
      window.dispatchEvent(new CustomEvent("session-expired", {
        detail: { platform: detectPlatformFromUrl(err.config.url) }
      }));
    }
    return Promise.reject(err);
  }
);
```

---

### [FEAT-06] Post activity log
**Files:** `frontend/src/pages/BroadcastPage.jsx`, new file  
**Issue:** Broadcast results disappear on next render. No history of what was posted.

**Fix:** Persist broadcast results to `sessionStorage` and show a collapsible "Recent Activity" section.

```js
// On successful broadcast, append to activity log
const logEntry = {
  id: Date.now(),
  platforms: selectedConnected.map((p) => p.id),
  text: postText.slice(0, 100),
  results,
  timestamp: new Date().toISOString(),
};
const existing = JSON.parse(sessionStorage.getItem("broadcast_log") || "[]");
sessionStorage.setItem("broadcast_log", JSON.stringify([logEntry, ...existing].slice(0, 20)));
```

---

## Phase 5 — Accessibility & Responsive Design

---

### [A11Y-01] Status LEDs have no accessible label
**Files:** All platform pages, `frontend/src/components/ui/floating-card.jsx`  
**Issue:** `<span aria-hidden="true" />` hides connection status from screen readers entirely.

**Fix:**
```jsx
// Replace
<span className={`status-led ${connected ? "led-green" : "led-red"}`} aria-hidden="true" />

// With
<span
  className={`status-led ${connected ? "led-green" : "led-red"}`}
  role="status"
  aria-label={connected ? "Connected" : "Not connected"}
/>
```

---

### [A11Y-02] No focus management on page navigation
**File:** `frontend/src/AppRouter.jsx`  
**Issue:** Switching views doesn't reset focus or announce the new page to screen readers.

**Fix:** Add a visually-hidden `<h1>` with the page title and focus it on view change.

```jsx
// AppRouter.jsx
useEffect(() => {
  document.getElementById("page-title")?.focus();
}, [view]);

// In each page component, add:
<h1 id="page-title" tabIndex={-1} className="sr-only">{pageTitle}</h1>
```

Add `.sr-only` utility class to `index.css`:
```css
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
```

---

### [A11Y-03] Compose textarea doesn't auto-focus
**Files:** All platform pages  
**Issue:** When navigating to a platform page, focus stays on the back button. Users have to tab to the compose area.

**Fix:** Add `autoFocus` to the `<textarea>` inside `ComposeCard` when the user is logged in, or use a `useEffect` + `ref` to focus it after the logged-in state is confirmed.

---

### [RESP-01] Inconsistent max-width between home and platform pages
**Files:** `frontend/src/pages/HomePage.jsx`, `frontend/src/App.css`  
**Issue:** Home page uses `maxWidth: 1100px`, platform pages use `.app-shell` at `max-width: 720px`. The layout jumps width on navigation.

**Fix:** Standardise on a single layout wrapper. Use `1100px` for the home grid and `720px` for single-column content pages, but add a smooth transition or keep the outer container consistent.

---

## Execution Order

| Phase | Effort | Priority |
|-------|--------|----------|
| Phase 1 — Security | ~1 day | 🔴 Do first |
| Phase 2 — Bug Fixes | ~2 hours | 🟠 Do second |
| Phase 3 — UI/UX | ~1–2 days | 🟡 Do third |
| Phase 4 — Features | ~3–5 days | 🟢 Do fourth |
| Phase 5 — A11y/Responsive | ~4 hours | 🔵 Do last |

Each issue is tagged with its file(s) and includes a concrete code snippet so fixes can be applied directly without further analysis.
