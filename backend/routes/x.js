// ── X (Twitter) routes ────────────────────────────────────────────────
// X uses OAuth 2.0 with PKCE (Authorization Code Flow).
// API base: https://api.twitter.com/2
// Docs: https://developer.twitter.com/en/docs/twitter-api
//
// Required env vars:
//   X_CLIENT_ID       — from developer.twitter.com (OAuth 2.0 Client ID)
//   X_CLIENT_SECRET   — OAuth 2.0 Client Secret
//   X_REDIRECT_URI    — must match exactly in the Twitter app settings
//
// GET  /x/auth-url      — return OAuth authorization URL + code_verifier
// POST /x/callback      — exchange code for token, redirect to frontend
// GET  /x/profile       — fetch authenticated user profile
// POST /x/create-post   — post a tweet (text or text + image)

const express  = require("express");
const axios    = require("axios");
const multer   = require("multer");
const crypto   = require("crypto");

const { requireAuth } = require("../middleware/auth");
const {
  X_CLIENT_ID,
  X_CLIENT_SECRET,
  X_REDIRECT_URI,
  FRONTEND_URL,
  BACKEND_URL,
} = require("../config");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const X_API = "https://api.twitter.com/2";

// ── PKCE helpers ──────────────────────────────────────────────────────
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}
function generateCodeChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// In-memory store for code_verifier (keyed by state).
// For production use Redis or a DB — this works for single-instance deploys.
const pkceStore = new Map();

// Return the X OAuth authorization URL
router.get("/auth-url", requireAuth, (req, res) => {
  if (!X_CLIENT_ID) {
    return res.status(503).json({ error: "X credentials not configured. Add X_CLIENT_ID to .env" });
  }

  const state        = crypto.randomBytes(16).toString("hex");
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store verifier for the callback
  pkceStore.set(state, codeVerifier);
  setTimeout(() => pkceStore.delete(state), 10 * 60 * 1000); // expire after 10 min

  const callbackUri = `${BACKEND_URL}/x/callback`;
  const params = new URLSearchParams({
    response_type:         "code",
    client_id:             X_CLIENT_ID,
    redirect_uri:          callbackUri,
    scope:                 "tweet.read tweet.write users.read offline.access",
    state,
    code_challenge:        codeChallenge,
    code_challenge_method: "S256",
  });

  res.json({ url: `https://twitter.com/i/oauth2/authorize?${params}` });
});

// X redirects here — exchange code for token, redirect to frontend
router.get("/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.redirect(
      `${FRONTEND_URL}/?x_error=${encodeURIComponent(error_description || error)}`
    );
  }

  const codeVerifier = pkceStore.get(state);
  if (!code || !codeVerifier) {
    return res.redirect(`${FRONTEND_URL}/?x_error=invalid_callback`);
  }
  pkceStore.delete(state);

  const callbackUri = `${BACKEND_URL}/x/callback`;

  try {
    const tokenRes = await axios.post(
      "https://api.twitter.com/2/oauth2/token",
      new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        redirect_uri:  callbackUri,
        code_verifier: codeVerifier,
        client_id:     X_CLIENT_ID,
      }).toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          // Basic auth with client_id:client_secret
          Authorization: `Basic ${Buffer.from(`${X_CLIENT_ID}:${X_CLIENT_SECRET}`).toString("base64")}`,
        },
        validateStatus: () => true,
      }
    );

    if (!tokenRes.data.access_token) {
      const msg = tokenRes.data.error_description || tokenRes.data.error || "token_exchange_failed";
      return res.redirect(`${FRONTEND_URL}/?x_error=${encodeURIComponent(msg)}`);
    }

    const token = encodeURIComponent(tokenRes.data.access_token);
    return res.redirect(`${FRONTEND_URL}/?x_token=${token}`);
  } catch (err) {
    return res.redirect(`${FRONTEND_URL}/?x_error=${encodeURIComponent(err.message)}`);
  }
});

// Fetch authenticated user profile
router.get("/profile", requireAuth, async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "token is required" });
  try {
    const response = await axios.get(`${X_API}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
      params:  { "user.fields": "id,name,username,profile_image_url,description" },
    });
    res.json(response.data.data);
  } catch (err) {
    res.status(err.response?.status || 500).json(
      err.response?.data || { error: "Failed to fetch X profile" }
    );
  }
});

// Post a tweet (text only or text + image)
// Image upload: POST /2/media/upload (v1.1 endpoint, multipart)
router.post("/create-post", requireAuth, upload.single("image"), async (req, res) => {
  const { token, text } = req.body;
  if (!token) return res.status(400).json({ error: "token is required" });
  if (!text && !req.file) return res.status(400).json({ error: "text or image is required" });

  try {
    let mediaId = null;

    if (req.file) {
      // Upload media via v1.1 (v2 media upload not yet available)
      const FormData = require("form-data");
      const form = new FormData();
      form.append("media", req.file.buffer, {
        filename:    req.file.originalname,
        contentType: req.file.mimetype,
      });

      const mediaRes = await axios.post(
        "https://upload.twitter.com/1.1/media/upload.json",
        form,
        {
          headers: {
            ...form.getHeaders(),
            Authorization: `Bearer ${token}`,
          },
        }
      );
      mediaId = mediaRes.data.media_id_string;
    }

    const body = { text: text || " " };
    if (mediaId) body.media = { media_ids: [mediaId] };

    const tweetRes = await axios.post(
      `${X_API}/tweets`,
      body,
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );

    res.json({ success: true, data: tweetRes.data });
  } catch (err) {
    console.error("X create post error:", err.response?.data || err.message);
    res.status(err.response?.status || 500).json(
      err.response?.data || { error: "Failed to post to X" }
    );
  }
});

module.exports = router;
