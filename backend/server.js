const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const path    = require("path");

const { PORT, ALLOWED_ORIGINS, TEMP_IMG_DIR } = require("./config");
const { globalLimiter } = require("./middleware/rateLimiter");

const authRoutes      = require("./routes/auth");
const facebookRoutes  = require("./routes/facebook");
const threadsRoutes   = require("./routes/threads");
const linkedinRoutes  = require("./routes/linkedin");
const xRoutes         = require("./routes/x");
const instagramRoutes = require("./routes/instagram");

const app = express();

// ── Security headers ──────────────────────────────────────────────────
app.use(helmet({
  crossOriginEmbedderPolicy: false, // needed for FB SDK iframes
  contentSecurityPolicy:     false, // managed by frontend
}));

// ── CORS — allow the frontend origin only ─────────────────────────────
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json());

// ── Global rate limiter — 100 requests per minute per IP ──────────────
app.use(globalLimiter);

// ── Static: temp images for Threads ──────────────────────────────────
app.use("/tmp-img", express.static(TEMP_IMG_DIR));

// ── Routes ────────────────────────────────────────────────────────────
// /auth — app login (Google JWT)
app.use("/auth",          authRoutes);

// Facebook routes live at both / (legacy) and /api for production
app.use("/api",           facebookRoutes);

// Platform routes: /api/* for frontend API calls
app.use("/api/threads",   threadsRoutes);
app.use("/api/linkedin",  linkedinRoutes);
app.use("/api/x",         xRoutes);
app.use("/api/instagram", instagramRoutes);

// OAuth callbacks must stay at their registered URIs (no /api prefix)
// These are registered in each platform's developer portal as:
//   https://api.simar.dev/linkedin/callback
//   https://api.simar.dev/x/callback
//   https://api.simar.dev/instagram/callback
app.use("/linkedin",  linkedinRoutes);
app.use("/x",         xRoutes);
app.use("/instagram", instagramRoutes);

// ── Start ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
