# UI Redesign & User Flow Plan

A complete redesign spec for the Social CRM. This document covers what's wrong,
the correct user flow, the new layout architecture, and component-level design
decisions — written so it can be handed directly to implementation.

---

## What's Wrong Right Now (Honest Diagnosis)

### The login page
- A centered headline, an animated word, one paragraph, one button. That's it.
- The animated cycling words ("effortlessly", "seamlessly", "smarter"…) are a
  common SaaS landing page pattern but here they're the *only* content. There's
  nothing to look at, nothing to trust, nothing that shows what the product
  actually does.
- "Sign in to view" is the worst possible CTA label. It tells the user nothing
  about what they're signing into or why they should.
- The ThemeToggle is floating in the top-right corner of a centered layout,
  completely disconnected from everything else.

### The dashboard (HomePage)
- Six FloatingCard components with 3D tilt, floating animation, particle
  effects, and Unsplash images. Each card is ~320px tall. On a 1080p screen
  you get two rows of three cards that all look the same except for color.
- The cards have no hierarchy. "Post to All" (the most powerful feature) looks
  identical to "Facebook". There's no visual signal about what to do first.
- The user avatar + name + email + sign-out button is crammed into the right
  side of the AppHeader with no breathing room.
- The ThemeToggle is *still* floating fixed in the top-right, now overlapping
  the user info.
- There's no onboarding state. A brand new user who hasn't connected any
  platform sees six identical cards all saying "Login" with a red LED. No
  guidance on what to do.

### Platform pages (Facebook, Threads, etc.)
- The layout is a single 720px-wide column with a header, then a compose box,
  then a feed — stacked vertically like a 2012 admin panel.
- The header has a logo square, title, subtitle, a status LED, and a logout
  button all in one `display: flex` row with `gap: 12px`. It looks like a
  developer placeholder.
- The compose card has a title "✏️ Create a Post", a badge with the page name,
  a textarea, a character counter, an image preview, and a button bar — all
  inside a bordered box. It's functional but it looks like a form, not a
  creative tool.
- Every platform page looks identical except for the accent color. The Facebook
  page, the LinkedIn page, the X page — same layout, same structure, same
  visual weight. There's no sense of being "inside" a platform.
- The back button is a small ghost button in the header. It's easy to miss and
  feels like an afterthought.
- `alert()` and `confirm()` dialogs break the entire visual experience.

### The core structural problem
The app has **no persistent navigation**. Every platform is a full-page
replacement. Going to Facebook means the entire screen changes. Going back
means the entire screen changes again. There's no sidebar, no tab bar, no
persistent chrome. The user has no sense of where they are or how to get
somewhere else without going "back to home" first.

---

## The Right User Flow

### Mental model
This is a **dashboard tool**, not a social network. The user is a content
manager or small business owner who wants to:
1. See the status of all their connected accounts at a glance
2. Quickly compose and publish content
3. Check recent posts and engagement
4. Schedule things for later

The correct mental model is closer to **Linear**, **Notion**, or **Buffer** —
a sidebar-driven app where the left side is navigation and the right side is
content. Not a card grid that you click into and then click back out of.

### Correct flow

```
Landing Page (not logged in)
  ↓ "Get started free" / "Sign in with Google"
  ↓
Dashboard — first visit (no platforms connected)
  → Onboarding banner: "Connect your first platform to get started"
  → Platform list with "Connect" buttons
  ↓ User connects Facebook
Dashboard — active state
  → Left sidebar: platform list with connection status
  → Main area: unified feed / compose / overview
  ↓ User clicks "Facebook" in sidebar
Facebook Panel (slides in as main content, sidebar stays)
  → Compose area at top
  → Recent posts feed below
  → No full-page navigation — sidebar always visible
  ↓ User clicks "Compose" in header
Compose Modal / Drawer
  → Platform selector (checkboxes)
  → Textarea with per-platform character counter
  → Image upload
  → Schedule toggle
  → Publish button
```

---

## New Layout Architecture

### Shell: Sidebar + Main Content

Replace the current full-page-swap router with a persistent shell:

```
┌─────────────────────────────────────────────────────┐
│  Topbar: Logo | Search (future) | User avatar | Theme│
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│   Sidebar    │         Main Content Area            │
│   (240px)    │         (flex: 1)                    │
│              │                                      │
│  ● Overview  │  Changes based on sidebar selection  │
│  ─────────── │                                      │
│  f Facebook  │                                      │
│  @ Threads   │                                      │
│  ◈ Instagram │                                      │
│  in LinkedIn │                                      │
│  𝕏 X         │                                      │
│  ─────────── │                                      │
│  ✦ Broadcast │                                      │
│              │                                      │
│  [+ Connect] │                                      │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

On mobile (< 768px): sidebar collapses to a bottom tab bar with icons only.

### No more full-page navigation
`AppRouter.jsx` currently swaps the entire page. Replace it with:
- A persistent `<AppShell>` that renders the topbar + sidebar always
- A `<MainContent>` area that renders the active panel
- The "view" state stays but controls only what's in `<MainContent>`

---

## Page-by-Page Redesign

---

### 1. Landing / Login Page

**Goal:** Convince the user this is worth signing up for. Show them what they'll
get before asking for anything.

**Layout:** Split-screen on desktop, stacked on mobile.

```
┌─────────────────────┬──────────────────────────────┐
│                     │                              │
│   LEFT: Marketing   │   RIGHT: Sign-in card        │
│                     │                              │
│  Logo + wordmark    │  ┌──────────────────────┐    │
│                     │  │                      │    │
│  Headline:          │  │  Welcome back        │    │
│  "One place for     │  │                      │    │
│   all your social   │  │  [G] Sign in with    │    │
│   content"          │  │      Google          │    │
│                     │  │                      │    │
│  3 feature bullets: │  │  ─────────────────   │    │
│  ✓ Post to 5        │  │                      │    │
│    platforms at     │  │  By signing in you   │    │
│    once             │  │  agree to our Terms  │    │
│  ✓ Schedule ahead   │  │                      │    │
│  ✓ See engagement   │  └──────────────────────┘    │
│    in one feed      │                              │
│                     │                              │
│  Platform logos row │                              │
│  (f @ ◈ in 𝕏)      │                              │
│                     │                              │
└─────────────────────┴──────────────────────────────┘
```

**Key changes from current:**
- Left side shows the product value — platform logos, feature bullets
- Right side is a clean card with just the sign-in action
- CTA label: "Sign in with Google" not "Sign in to view"
- No animated cycling words — they add motion but zero information
- No floating ThemeToggle — put it in the top-right of the topbar
- Background: subtle grid or dot pattern, not flat `var(--bg)`

---

### 2. Dashboard — Overview (first screen after login)

**Goal:** Give the user a command center view. Status of all platforms, quick
compose, recent activity.

**Layout:** Sidebar + main content (see shell above)

**Main content — Overview panel:**

```
┌─────────────────────────────────────────────────────┐
│  Good morning, Simar                                │
│  Wednesday, May 13                                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  CONNECTED PLATFORMS          [+ Connect more]      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ f        │ │ @        │ │ ◈        │            │
│  │ Facebook │ │ Threads  │ │Instagram │            │
│  │ ● Active │ │ ● Active │ │ ✕ Not    │            │
│  │          │ │          │ │ connected│            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  QUICK COMPOSE                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │  What do you want to post today?              │  │
│  │                                               │  │
│  │  [f] [@ ] [◈] [in] [𝕏]  ← platform toggles  │  │
│  │                                               │  │
│  │  [📷 Image]  [🕐 Schedule]  [→ Publish]       │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  RECENT ACTIVITY                                    │
│  ┌─────────────────────────────────────────────┐    │
│  │ [f] "Check out our new product launch…"     │    │
│  │     2 hours ago · 14 likes · 3 comments     │    │
│  ├─────────────────────────────────────────────┤    │
│  │ [@] "Just shipped a new feature…"           │    │
│  │     5 hours ago · 8 replies                 │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Onboarding state (no platforms connected):**
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│         Connect your first platform                 │
│    to start managing your social presence           │
│                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ f        │ │ @        │ │ ◈        │            │
│  │ Facebook │ │ Threads  │ │Instagram │            │
│  │[Connect] │ │[Connect] │ │[Connect] │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│  ┌──────────┐ ┌──────────┐                         │
│  │ in       │ │ 𝕏        │                         │
│  │ LinkedIn │ │ X        │                         │
│  │[Connect] │ │[Connect] │                         │
│  └──────────┘ └──────────┘                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

### 3. Platform Panel (e.g. Facebook)

**Goal:** A focused workspace for one platform. Compose at the top, feed below.
The sidebar stays visible so the user can switch platforms without going "back".

**Layout:** Two-column within the main content area on wide screens.

```
┌─────────────────────────────────────────────────────┐
│  Facebook                    Page: My Business Page │
│  ● Connected as John Smith   [Switch page ▾]        │
├──────────────────────┬──────────────────────────────┤
│                      │                              │
│  COMPOSE             │  RECENT POSTS                │
│  ┌────────────────┐  │  ┌──────────────────────┐    │
│  │                │  │  │ 2h ago               │    │
│  │  What's on     │  │  │ "Our new product..."  │    │
│  │  your mind?    │  │  │ 👍 14  💬 3           │    │
│  │                │  │  │ [View comments ▾]     │    │
│  └────────────────┘  │  └──────────────────────┘    │
│  [📷] [⏰ Schedule]  │  ┌──────────────────────┐    │
│  [→ Post Now]        │  │ Yesterday             │    │
│                      │  │ "Weekend sale..."     │    │
│  ── SCHEDULED ──     │  │ 👍 32  💬 7           │    │
│  ┌────────────────┐  │  └──────────────────────┘    │
│  │ ⏰ Tomorrow    │  │                              │
│  │ 9:00 AM        │  │  [Load more]                 │
│  │ "Flash sale…"  │  │                              │
│  │ [Cancel]       │  │                              │
│  └────────────────┘  │                              │
│                      │                              │
└──────────────────────┴──────────────────────────────┘
```

On narrow screens (< 1024px): stack compose above feed, single column.

**Key changes from current:**
- No "← Back" button — sidebar handles navigation
- No "✏️ Create a Post" title inside the compose card — the context is obvious
- No platform logo + title header — the sidebar already shows where you are
- The page selector is a subtle dropdown in the top-right of the panel, not a
  row of chips below the header
- Scheduled posts are in the left column alongside compose, not a separate
  section below everything

---

### 4. Broadcast / Compose Modal

**Goal:** The "Post to All" feature should feel like a power tool, not a page.
It should be accessible from anywhere via a prominent "Compose" button.

**Trigger:** A "✦ New Post" button in the topbar (always visible) opens a
centered modal/drawer.

```
┌─────────────────────────────────────────────────────┐
│  New Post                                    [✕]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Post to:                                           │
│  [✓ f Facebook] [✓ @ Threads] [✗ ◈ Instagram]      │
│  [✓ in LinkedIn] [✓ 𝕏 X]                           │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │                                               │  │
│  │  Write something…                             │  │
│  │                                               │  │
│  │                                               │  │
│  └───────────────────────────────────────────────┘  │
│  Characters: 0 / 280  (limited by X)                │
│                                                     │
│  [📷 Add image]                                     │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  🕐 Schedule for later                      │    │
│  │  [Date & time picker]                       │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [Cancel]                    [→ Publish to 4]       │
└─────────────────────────────────────────────────────┘
```

---

### 5. Sidebar Design

```
┌──────────────────────┐
│  ◈ Social CRM        │  ← Logo + wordmark
├──────────────────────┤
│  Overview            │  ← Active state: left accent bar + bg highlight
├──────────────────────┤
│  PLATFORMS           │  ← Section label (uppercase, muted)
│                      │
│  ● f  Facebook       │  ← Green dot = connected
│  ● @  Threads        │
│  ✕ ◈  Instagram      │  ← Grey X = not connected
│  ● in LinkedIn       │
│  ● 𝕏  X              │
├──────────────────────┤
│  ✦  Broadcast        │
├──────────────────────┤
│  [+ Connect more]    │  ← Ghost button at bottom
└──────────────────────┘
```

**Sidebar item states:**
- Default: icon + label, muted text
- Hover: subtle background highlight
- Active: left 3px accent bar + slightly brighter background + bold label
- Connected: small green dot before the icon
- Not connected: small grey dot, label slightly muted, clicking opens connect flow

---

## Component Design System

### Typography scale
```
Display:  32px / 700 / -0.03em   — page titles
Heading:  20px / 700 / -0.02em   — section headers
Subhead:  15px / 600 / 0         — card titles, labels
Body:     14px / 400 / 0         — content text
Caption:  12px / 500 / 0.01em    — timestamps, metadata
Micro:    11px / 600 / 0.05em    — uppercase labels, badges
```

### Spacing system
Use a consistent 4px base unit: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64.
No more arbitrary `padding: 18px 0 20px` or `gap: 12px` mixed with `gap: 10px`.

### Color usage rules
- `--bg` (#0e1117): page background only
- `--surface` (#161b22): cards, panels, sidebar
- `--surface-2` (#1c2230): inputs, nested elements, hover states
- `--border-light` (#243044): card borders
- `--text-primary`: headings and important content
- `--text-secondary`: body text
- `--text-muted`: timestamps, labels, placeholders
- Platform accent colors: used only for that platform's elements, not globally

### Button hierarchy
```
Primary:    Filled, blue — one per view, the main action
Secondary:  Outlined — secondary actions
Ghost:      No border, subtle bg on hover — tertiary actions
Danger:     Red tint — destructive actions only
Icon:       Square, 32px — toolbar actions
```

Never use `!important` overrides for platform-specific button colors.
Instead use a `data-platform` attribute and CSS attribute selectors:
```css
.btn-primary[data-platform="facebook"] { background: #1877f2; }
.btn-primary[data-platform="linkedin"] { background: #0a66c2; }
```

### Cards
All cards use the same base:
```css
.card {
  background: var(--surface);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 20px;
  box-shadow: var(--shadow-sm);
}
```
No more per-component border-radius variations (14px here, 16px there, 24px
on FloatingCard). Pick 12px and use it everywhere.

### Form inputs
```css
.input, .textarea {
  background: var(--surface-2);
  border: 1.5px solid var(--border-light);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  padding: 10px 12px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.input:focus, .textarea:focus {
  border-color: var(--blue);
  box-shadow: 0 0 0 3px rgba(74,158,255,.12);
  outline: none;
}
```

---

## What to Remove Entirely

| Element | Why |
|---------|-----|
| `FloatingCard` 3D tilt + particles + float animation | Decorative noise. Slows the page, adds no information. Replace with simple flat cards. |
| Animated cycling words on login | Adds motion, zero information value. |
| Unsplash images on platform cards | External dependency, slow, irrelevant stock photos. |
| `LoginScreen.css` | Dead file, never imported. |
| `animated-hero.jsx` + demo | Dead files, never used. |
| `SIGNUP_component.jsx` in backend | React component in wrong directory, never used. |
| Fixed-position ThemeToggle | Conflicts with header content. Move into topbar. |
| Emoji as functional icons (🚪🔄📷🚀) | Inconsistent rendering. Use Lucide icons. |
| Per-platform `!important` CSS overrides | 40+ lines of `!important` rules. Use data attributes instead. |
| `alert()` / `confirm()` | Replace with toast notifications and inline confirmation. |

---

## Implementation Order

### Step 1 — Shell & Navigation (2–3 days)
1. Create `AppShell.jsx` with topbar + sidebar + main content area
2. Move ThemeToggle into topbar
3. Move user avatar + sign-out into topbar
4. Replace `AppRouter.jsx` full-page swap with panel rendering inside `<main>`
5. Build `Sidebar.jsx` with platform list, connection status dots, active state
6. Add mobile bottom tab bar for < 768px

### Step 2 — Login Page (half day)
1. Split-screen layout: marketing left, sign-in card right
2. Add platform logo row (SVG icons, not text characters)
3. Add 3 feature bullet points
4. Fix CTA label
5. Remove animated words
6. Move ThemeToggle to topbar

### Step 3 — Design System (1 day)
1. Audit and consolidate all CSS into a single token-based system
2. Remove all `!important` overrides
3. Standardise spacing, border-radius, typography
4. Build `Button`, `Card`, `Input`, `Textarea` base components
5. Build `Toast` + `useToast` hook
6. Build `Skeleton` loading component

### Step 4 — Overview Dashboard (1 day)
1. Build `OverviewPanel.jsx`
2. Platform status cards (flat, no 3D)
3. Quick compose strip (opens full compose modal)
4. Recent activity feed (aggregated across platforms)
5. Onboarding empty state

### Step 5 — Platform Panels (2–3 days)
1. Rebuild each platform page as a panel (not a full page)
2. Two-column layout: compose left, feed right
3. Remove per-page headers (sidebar handles context)
4. Standardise compose area across all platforms
5. Wire up toast notifications

### Step 6 — Compose Modal (1 day)
1. Build `ComposeModal.jsx` — centered overlay
2. Platform selector with checkboxes
3. Dynamic character counter
4. Image upload with validation
5. Schedule picker
6. Confirmation step before publish

### Step 7 — Polish (1 day)
1. Skeleton loaders on all async content
2. Empty states with helpful copy
3. Keyboard navigation
4. Focus management on panel switch
5. Responsive testing

---

## Reference Apps to Study

These apps solve the same layout problem well:

- **Buffer** (buffer.com) — sidebar nav, compose modal, clean platform panels
- **Linear** (linear.app) — sidebar + main content shell, consistent typography
- **Notion** (notion.so) — sidebar navigation pattern, clean empty states
- **Vercel Dashboard** — topbar + sidebar, status indicators, card design

The goal is not to copy them but to understand why a persistent sidebar works
better than full-page navigation for a tool that manages multiple "accounts"
or "workspaces".
