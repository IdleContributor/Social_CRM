// ── Instagram routes ──────────────────────────────────────────────────
// Instagram uses the Facebook OAuth flow + Instagram Graph API.
// Same Facebook App (APP_ID / APP_SECRET) — just different scopes.
//
// Required permissions on your Meta App:
//   instagram_basic, instagram_content_publish, pages_show_list,
//   pages_read_engagement, instagram_manage_insights (optional)
//
// Flow:
//   1. User logs in via Facebook OAuth with instagram scopes
//   2. We get a user access token → fetch their connected IG Business/Creator accounts
//   3. Use the IG account's access token for all subsequent calls
//
// GET  /instagram/auth-url      — return Facebook OAuth URL with IG scopes
// GET  /instagram/callback      — exchange code, redirect to frontend with token
// GET  /instagram/accounts      — list connected Instagram accounts
// GET  /instagram/profile       — fetch IG account profile
// GET  /instagram/media         — fetch recent posts
// POST /instagram/create-post   — publish a photo or reel (image required)

const express  = require("express");
const axios    = require("axios");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");
const crypto   = require("crypto");

const { requireAuth } = require("../middleware/auth");
const {
  APP_ID,
  APP_SECRET,
  IG_REDIRECT_URI,
  IG_API,
  BACKEND_URL,
  FRONTEND_URL,
  TEMP_IMG_DIR,
  PUBLIC_HOST,
} = require("../config");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Return the Facebook OAuth URL with Instagram scopes
router.get("/auth-url", requireAuth, (req, res) => {
  if (!APP_ID) {
    return res.status(503).json({ error: "Facebook APP_ID not configured." });
  }
  const callbackUri = `${BACKEND_URL}/instagram/callback`;
  const params = new URLSearchParams({
    client_id:     APP_ID,
    redirect_uri:  callbackUri,
    scope: [
      "instagram_basic",
      "instagram_content_publish",
      "pages_show_list",
      "pages_read_engagement",
    ].join(","),
    response_type: "code",
    state:         "instagram_oauth",
  });
  res.json({ url: `https://www.facebook.com/v19.0/dialog/oauth?${params}` });
});

// Facebook redirects here — exchange code for long-lived token, redirect to frontend
router.get("/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.redirect(
      `${FRONTEND_URL}/?ig_error=${encodeURIComponent(error_description || error)}`
    );
  }
  if (!code || state !== "instagram_oauth") {
    return res.redirect(`${FRONTEND_URL}/?ig_error=invalid_callback`);
  }

  const callbackUri = `${BACKEND_URL}/instagram/callback`;

  try {
    // Step 1: short-lived token
    const tokenRes = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
      params: {
        client_id:     APP_ID,
        client_secret: APP_SECRET,
        redirect_uri:  callbackUri,
        code,
      },
      validateStatus: () => true,
    });

    if (!tokenRes.data.access_token) {
      const msg = tokenRes.data.error?.message || "token_exchange_failed";
      return res.redirect(`${FRONTEND_URL}/?ig_error=${encodeURIComponent(msg)}`);
    }

    // Step 2: exchange for long-lived token (60-day expiry)
    const longRes = await axios.get("https://graph.facebook.com/v19.0/oauth/access_token", {
      params: {
        grant_type:        "fb_exchange_token",
        client_id:         APP_ID,
        client_secret:     APP_SECRET,
        fb_exchange_token: tokenRes.data.access_token,
      },
      validateStatus: () => true,
    });

    const finalToken = longRes.data.access_token || tokenRes.data.access_token;
    const token = encodeURIComponent(finalToken);
    return res.redirect(`${FRONTEND_URL}/?ig_token=${token}&state=instagram_oauth`);
  } catch (err) {
    return res.redirect(`${FRONTEND_URL}/?ig_error=${encodeURIComponent(err.message)}`);
  }
});

// List Instagram Business/Creator accounts connected to the user's Facebook Pages
router.get("/accounts", requireAuth, async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "token is required" });
  try {
    // Get Facebook Pages the user manages
    const pagesRes = await axios.get(`${IG_API}/me/accounts`, {
      params: { access_token: token, fields: "id,name,instagram_business_account" },
    });

    const pages = pagesRes.data.data || [];
    const igAccounts = pages
      .filter((p) => p.instagram_business_account)
      .map((p) => ({
        pageId:    p.id,
        pageName:  p.name,
        igId:      p.instagram_business_account.id,
      }));

    if (igAccounts.length === 0) {
      return res.json({ accounts: [], warning: "No Instagram Business or Creator accounts found. Make sure your Instagram account is connected to a Facebook Page." });
    }

    // Fetch IG profile details for each account
    const detailed = await Promise.all(
      igAccounts.map(async (acc) => {
        try {
          const igRes = await axios.get(`${IG_API}/${acc.igId}`, {
            params: {
              fields: "id,username,name,profile_picture_url,followers_count,media_count",
              access_token: token,
            },
          });
          return { ...acc, ...igRes.data };
        } catch {
          return acc;
        }
      })
    );

    res.json({ accounts: detailed });
  } catch (err) {
    res.status(500).json(err.response?.data || { error: "Failed to fetch Instagram accounts" });
  }
});

// Fetch IG account profile
router.get("/profile", requireAuth, async (req, res) => {
  const { token, igId } = req.query;
  if (!token || !igId) return res.status(400).json({ error: "token and igId are required" });
  try {
    const response = await axios.get(`${IG_API}/${igId}`, {
      params: {
        fields: "id,username,name,profile_picture_url,followers_count,media_count,biography",
        access_token: token,
      },
    });
    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || { error: "Failed to fetch profile" });
  }
});

// Fetch recent media for an IG account
router.get("/media", requireAuth, async (req, res) => {
  const { token, igId, after } = req.query;
  if (!token || !igId) return res.status(400).json({ error: "token and igId are required" });
  try {
    const params = new URLSearchParams({
      fields: "id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count",
      access_token: token,
      limit: 20,
    });
    if (after) params.append("after", after);
    const response = await axios.get(`${IG_API}/${igId}/media?${params}`);
    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || { error: "Failed to fetch media" });
  }
});

// Publish a photo or video to Instagram
// Instagram Content Publishing is a two-step process:
//   1. Create a media container  →  POST /{igId}/media
//   2. Publish the container     →  POST /{igId}/media_publish
//
// Requirements:
//   - Account must be a Business or Creator account
//   - Image must be publicly accessible (we host it temporarily like Threads)
router.post("/create-post", requireAuth, upload.single("image"), async (req, res) => {
  const { token, igId, caption } = req.body;
  if (!token || !igId) return res.status(400).json({ error: "token and igId are required" });
  if (!req.file) return res.status(400).json({ error: "image is required for Instagram posts" });

  // Save image temporarily so Instagram can fetch it via public URL
  const ext = path.extname(req.file.originalname) || ".jpg";
  const tempFilename = `${crypto.randomUUID()}${ext}`;
  const tempPath = path.join(TEMP_IMG_DIR, tempFilename);
  fs.writeFileSync(tempPath, req.file.buffer);

  try {
    const imageUrl = `${PUBLIC_HOST}/tmp-img/${tempFilename}`;

    // Step 1: create container
    const containerRes = await axios.post(
      `${IG_API}/${igId}/media`,
      null,
      {
        params: {
          image_url:    imageUrl,
          caption:      caption || "",
          access_token: token,
        },
      }
    );
    const containerId = containerRes.data.id;

    // Step 2: publish
    const publishRes = await axios.post(
      `${IG_API}/${igId}/media_publish`,
      null,
      { params: { creation_id: containerId, access_token: token } }
    );

    res.json({ success: true, data: publishRes.data });
  } catch (err) {
    console.error("Instagram create post error:", err.response?.data || err.message);
    res.status(500).json(err.response?.data || { error: "Failed to publish to Instagram" });
  } finally {
    // Clean up temp file after 2 minutes
    setTimeout(() => {
      try { fs.unlinkSync(tempPath); } catch (_) {}
    }, 120_000);
  }
});

module.exports = router;
