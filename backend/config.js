// ── Central config ────────────────────────────────────────────────────
// All environment variables and shared constants live here.
// Import this module instead of reading process.env directly in route files.

require("dotenv").config();
const path = require("path");
const fs   = require("fs");

const ALLOWED_ORIGINS = [
  "http://localhost:5174",
  "https://localhost:5174",
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

const TEMP_IMG_DIR = path.join(__dirname, "tmp", "threads-imgs");
if (!fs.existsSync(TEMP_IMG_DIR)) fs.mkdirSync(TEMP_IMG_DIR, { recursive: true });

module.exports = {
  PORT:               process.env.PORT || 5000,
  JWT_SECRET:         process.env.JWT_SECRET,
  GOOGLE_CLIENT_ID:   process.env.GOOGLE_CLIENT_ID,
  APP_ID:             process.env.APP_ID || "",
  ALLOWED_ORIGINS,

  // Threads
  THREADS_APP_ID:      process.env.THREADS_APP_ID,
  THREADS_APP_SECRET:  process.env.THREADS_APP_SECRET,
  THREADS_REDIRECT_URI: process.env.THREADS_REDIRECT_URI || "https://localhost:5173",
  THREADS_API:         "https://graph.threads.net/v1.0",
  PUBLIC_HOST:         process.env.PUBLIC_HOST || "http://localhost:5000",
  TEMP_IMG_DIR,

  // LinkedIn
  LI_CLIENT_ID:     process.env.LI_CLIENT_ID,
  LI_CLIENT_SECRET: process.env.LI_CLIENT_SECRET,
  LI_REDIRECT_URI:  process.env.LI_REDIRECT_URI || "https://localhost:5173",
  LI_API:           "https://api.linkedin.com/v2",
  BACKEND_URL:      process.env.BACKEND_URL || "http://localhost:5000",
  FRONTEND_URL:     process.env.FRONTEND_URL || "https://localhost:5174",

  // X (Twitter)
  X_CLIENT_ID:     process.env.X_CLIENT_ID,
  X_CLIENT_SECRET: process.env.X_CLIENT_SECRET,
  X_REDIRECT_URI:  process.env.X_REDIRECT_URI || "http://localhost:5000/x/callback",

  // Instagram — uses the same Facebook App (APP_ID/APP_SECRET)
  // Requires instagram_basic, instagram_content_publish, pages_show_list
  IG_REDIRECT_URI: process.env.IG_REDIRECT_URI || "https://localhost:5174",
  IG_API:          "https://graph.facebook.com/v19.0",
};
