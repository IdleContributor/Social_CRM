// ── Threads routes ────────────────────────────────────────────────────
// Threads uses OAuth 2.0 (similar to Facebook).
// API base: https://graph.threads.net/v1.0
// Docs: https://developers.facebook.com/docs/threads
//
// GET  /threads/auth-url        — return OAuth authorization URL
// POST /threads/exchange-token  — exchange code for long-lived token
// GET  /threads/profile         — fetch authenticated user profile
// GET  /threads/posts           — fetch user's Threads posts
// GET  /threads/replies         — fetch replies for a post
// POST /threads/create-post     — create a text or image post

const express  = require("express");
const axios    = require("axios");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const crypto   = require("crypto");

const { requireAuth } = require("../middleware/auth");
const {
  THREADS_APP_ID,
  THREADS_APP_SECRET,
  THREADS_REDIRECT_URI,
  THREADS_API,
  PUBLIC_HOST,
  TEMP_IMG_DIR,
} = require("../config");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Return the Threads OAuth authorization URL for the frontend to redirect to
router.get("/auth-url", requireAuth, (req, res) => {
  const params = new URLSearchParams({
    client_id:     THREADS_APP_ID,
    redirect_uri:  THREADS_REDIRECT_URI,
    scope: [
      "threads_basic",
      "threads_content_publish",
      "threads_read_replies",
      "threads_manage_replies",
      "threads_manage_insights",
    ].join(","),
    response_type: "code",
  });
  res.json({ url: `https://threads.net/oauth/authorize?${params}` });
});

// Exchange authorization code for a short-lived token, then upgrade to long-lived
router.post("/exchange-token", requireAuth, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: "code is required" });

  try {
    // Step 1: short-lived token (must be sent as application/x-www-form-urlencoded)
    const body = new URLSearchParams({
      client_id:     THREADS_APP_ID,
      client_secret: THREADS_APP_SECRET,
      grant_type:    "authorization_code",
      redirect_uri:  THREADS_REDIRECT_URI,
      code,
    }).toString();

    console.log("Threads token exchange body:", body.replace(THREADS_APP_SECRET, "***"));

    const shortRes = await axios.post(
      "https://graph.threads.net/oauth/access_token",
      body,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    const shortToken = shortRes.data.access_token;

    // Step 2: exchange for long-lived token (60-day expiry)
    const longRes = await axios.get("https://graph.threads.net/access_token", {
      params: {
        grant_type:    "th_exchange_token",
        client_secret: THREADS_APP_SECRET,
        access_token:  shortToken,
      },
    });
    res.json(longRes.data); // { access_token, token_type, expires_in }
  } catch (err) {
    console.error("Threads token exchange error:", err.response?.data || err.message);
    res.status(500).json(err.response?.data || { error: "Token exchange failed" });
  }
});

// Fetch authenticated user's profile
router.get("/profile", requireAuth, async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "token is required" });
  try {
    const response = await axios.get(`${THREADS_API}/me`, {
      params: {
        fields: "id,username,name,threads_profile_picture_url,threads_biography",
        access_token: token,
      },
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || { error: "Failed to fetch profile" });
  }
});

// Fetch user's Threads posts (media objects)
router.get("/posts", requireAuth, async (req, res) => {
  const { token, after } = req.query;
  if (!token) return res.status(400).json({ error: "token is required" });
  try {
    const params = new URLSearchParams({
      fields: "id,text,media_type,media_url,thumbnail_url,timestamp,replies.summary(true)",
      access_token: token,
      limit: 20,
    });
    if (after) params.append("after", after);
    const response = await axios.get(`${THREADS_API}/me/threads?${params}`);
    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || { error: "Failed to fetch posts" });
  }
});

// Fetch replies for a specific Threads post
router.get("/replies", requireAuth, async (req, res) => {
  const { token, mediaId, after } = req.query;
  if (!token || !mediaId) {
    return res.status(400).json({ error: "token and mediaId are required" });
  }
  try {
    const params = new URLSearchParams({
      fields: "id,text,username,timestamp",
      access_token: token,
      limit: 25,
    });
    if (after) params.append("after", after);
    const response = await axios.get(`${THREADS_API}/${mediaId}/replies?${params}`);
    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || { error: "Failed to fetch replies" });
  }
});

// Create a Threads post (text-only or single image)
// Threads publishing is a two-step process:
//   1. Create a media container  →  POST /{userId}/threads
//   2. Publish the container     →  POST /{userId}/threads_publish
router.post("/create-post", requireAuth, upload.single("image"), async (req, res) => {
  const { token, text } = req.body;
  if (!token) return res.status(400).json({ error: "token is required" });
  if (!text && !req.file) return res.status(400).json({ error: "text or image is required" });

  // If an image was uploaded, save it temporarily so Threads can fetch it via URL
  let tempFilename = null;
  if (req.file) {
    const ext = path.extname(req.file.originalname) || ".jpg";
    tempFilename = `${crypto.randomUUID()}${ext}`;
    fs.writeFileSync(path.join(TEMP_IMG_DIR, tempFilename), req.file.buffer);
  }

  try {
    // Resolve the user ID first
    const meRes = await axios.get(`${THREADS_API}/me`, {
      params: { fields: "id", access_token: token },
    });
    const userId = meRes.data.id;

    // Step 1: create container
    const containerParams = { access_token: token };
    if (text) containerParams.text = text;

    if (tempFilename) {
      containerParams.media_type = "IMAGE";
      containerParams.image_url  = `${PUBLIC_HOST}/tmp-img/${tempFilename}`;
    } else {
      containerParams.media_type = "TEXT";
    }

    const containerRes = await axios.post(
      `${THREADS_API}/${userId}/threads`,
      null,
      { params: containerParams }
    );
    const containerId = containerRes.data.id;

    // Step 2: publish container
    const publishRes = await axios.post(
      `${THREADS_API}/${userId}/threads_publish`,
      null,
      { params: { creation_id: containerId, access_token: token } }
    );

    res.json({ success: true, data: publishRes.data });
  } catch (err) {
    console.error("Threads create post error:", err.response?.data || err.message);
    res.status(500).json(err.response?.data || { error: "Failed to create thread" });
  } finally {
    // Clean up temp file after a delay (give Threads time to fetch it)
    if (tempFilename) {
      setTimeout(() => {
        try { fs.unlinkSync(path.join(TEMP_IMG_DIR, tempFilename)); } catch (_) {}
      }, 60_000);
    }
  }
});

module.exports = router;
