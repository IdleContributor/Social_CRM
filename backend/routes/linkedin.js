// ── LinkedIn routes ───────────────────────────────────────────────────
// LinkedIn uses OAuth 2.0 (3-legged).
// API base : https://api.linkedin.com/v2
// Docs     : https://learn.microsoft.com/en-us/linkedin/
//
// Required scopes: openid, profile, email, w_member_social
// Image upload uses the LinkedIn Assets API (register → upload → attach).
//
// GET  /linkedin/auth-url        — return OAuth authorization URL
// GET  /linkedin/callback        — exchange code, redirect to frontend with token
// GET  /linkedin/profile         — fetch authenticated member profile
// GET  /linkedin/posts           — fetch member's recent posts
// GET  /linkedin/comments        — fetch comments for a post
// POST /linkedin/create-post     — create a text or image post

const express  = require("express");
const axios    = require("axios");
const multer   = require("multer");

const { requireAuth } = require("../middleware/auth");
const {
  LI_CLIENT_ID,
  LI_CLIENT_SECRET,
  LI_API,
  BACKEND_URL,
  FRONTEND_URL,
} = require("../config");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Return the LinkedIn OAuth authorization URL
// Redirect goes to the Express server (/linkedin/callback) which exchanges
// the code immediately, then forwards the token to the frontend.
router.get("/auth-url", requireAuth, (req, res) => {
  const callbackUri = `${BACKEND_URL}/linkedin/callback`;
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     LI_CLIENT_ID,
    redirect_uri:  callbackUri,
    state:         "linkedin_oauth",
    scope:         "openid profile email w_member_social",
  });
  res.json({ url: `https://www.linkedin.com/oauth/v2/authorization?${params}` });
});

// LinkedIn redirects here after user approves — exchange code immediately
// then redirect browser to frontend with the token in the URL fragment.
router.get("/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.redirect(
      `${FRONTEND_URL}/?li_error=${encodeURIComponent(error_description || error)}`
    );
  }
  if (!code || state !== "linkedin_oauth") {
    return res.redirect(`${FRONTEND_URL}/?li_error=invalid_callback`);
  }

  const callbackUri = `${BACKEND_URL}/linkedin/callback`;
  const body = [
    `grant_type=authorization_code`,
    `code=${encodeURIComponent(code)}`,
    `redirect_uri=${encodeURIComponent(callbackUri)}`,
    `client_id=${encodeURIComponent(LI_CLIENT_ID)}`,
    `client_secret=${encodeURIComponent(LI_CLIENT_SECRET)}`,
  ].join("&");

  try {
    const tokenRes = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      body,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        validateStatus: () => true,
      }
    );

    if (tokenRes.data.error || !tokenRes.data.access_token) {
      const msg = tokenRes.data.error_description || tokenRes.data.error || "token_exchange_failed";
      return res.redirect(`${FRONTEND_URL}/?li_error=${encodeURIComponent(msg)}`);
    }

    // Pass token to frontend via URL fragment (keeps it out of server logs)
    const token = encodeURIComponent(tokenRes.data.access_token);
    return res.redirect(`${FRONTEND_URL}/?li_token=${token}&state=linkedin_oauth`);
  } catch (err) {
    return res.redirect(`${FRONTEND_URL}/?li_error=${encodeURIComponent(err.message)}`);
  }
});

// Deprecated — token exchange now happens server-side in /linkedin/callback
router.post("/exchange-token", (req, res) => {
  res.status(410).json({ error: "Deprecated. Token exchange now happens in /linkedin/callback." });
});

// Fetch authenticated member profile (OpenID Connect userinfo)
router.get("/profile", requireAuth, async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "token is required" });
  try {
    // Try the v2 userinfo endpoint first, fall back to the legacy /v2/me
    let response = await axios.get("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true,
    });

    if (typeof response.data === "string" || response.status !== 200) {
      response = await axios.get(`${LI_API}/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
        params: { projection: "(id,localizedFirstName,localizedLastName)" },
        validateStatus: () => true,
      });
    }

    if (response.status !== 200 || typeof response.data === "string") {
      return res.status(500).json({ error: "Failed to fetch LinkedIn profile" });
    }

    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || { error: "Failed to fetch profile" });
  }
});

// Fetch member's recent posts via the UGC Posts API
router.get("/posts", requireAuth, async (req, res) => {
  const { token, authorId } = req.query;
  if (!token || !authorId) {
    return res.status(400).json({ error: "token and authorId are required" });
  }

  const authorUrn = `urn:li:person:${authorId}`;

  try {
    const response = await axios.get(`${LI_API}/ugcPosts`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Restli-Protocol-Version": "2.0.0",
      },
      params: {
        q:       "authors",
        authors: `List(${authorUrn})`,
        count:   20,
      },
      validateStatus: () => true,
    });

    console.log("LinkedIn posts status:", response.status, JSON.stringify(response.data).slice(0, 300));

    if (response.status === 200 && !response.data.serviceErrorCode) {
      return res.json(response.data);
    }

    // ugcPosts often fails for personal accounts without r_member_social —
    // return empty so the UI shows "No posts yet" rather than an error
    console.warn("LinkedIn ugcPosts failed:", response.data);
    return res.json({ elements: [] });
  } catch (err) {
    console.error("LinkedIn posts error:", err.response?.data || err.message);
    res.status(500).json(err.response?.data || { error: "Failed to fetch posts" });
  }
});

// Fetch comments for a post
router.get("/comments", requireAuth, async (req, res) => {
  const { token, postId } = req.query;
  if (!token || !postId) {
    return res.status(400).json({ error: "token and postId are required" });
  }
  try {
    const response = await axios.get(
      `${LI_API}/socialActions/${encodeURIComponent(postId)}/comments`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Restli-Protocol-Version": "2.0.0",
        },
        params: { count: 25 },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || { error: "Failed to fetch comments" });
  }
});

// Create a LinkedIn post (text-only or text + image)
// Image upload is a 3-step process:
//   1. Register upload   → POST /assets?action=registerUpload
//   2. Upload binary     → PUT <uploadUrl>
//   3. Create UGC post   → POST /ugcPosts  (reference the asset URN)
router.post("/create-post", requireAuth, upload.single("image"), async (req, res) => {
  const { token, authorId, text } = req.body;
  if (!token || !authorId) {
    return res.status(400).json({ error: "token and authorId are required" });
  }
  if (!text && !req.file) {
    return res.status(400).json({ error: "text or image is required" });
  }

  const authorUrn = `urn:li:person:${authorId}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };

  try {
    let mediaAsset = null;

    if (req.file) {
      // Step 1: register upload
      const registerRes = await axios.post(
        `${LI_API}/assets?action=registerUpload`,
        {
          registerUploadRequest: {
            recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
            owner: authorUrn,
            serviceRelationships: [
              {
                relationshipType: "OWNER",
                identifier: "urn:li:userGeneratedContent",
              },
            ],
          },
        },
        { headers }
      );

      const uploadUrl =
        registerRes.data.value.uploadMechanism[
          "com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"
        ].uploadUrl;
      const assetUrn = registerRes.data.value.asset;

      // Step 2: upload binary
      await axios.put(uploadUrl, req.file.buffer, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": req.file.mimetype,
        },
      });

      mediaAsset = assetUrn;
    }

    // Step 3: create UGC post
    const shareContent = mediaAsset
      ? {
          shareCommentary:   { text: text || "" },
          shareMediaCategory: "IMAGE",
          media: [
            {
              status:      "READY",
              description: { text: text || "" },
              media:       mediaAsset,
              title:       { text: "" },
            },
          ],
        }
      : {
          shareCommentary:   { text },
          shareMediaCategory: "NONE",
        };

    const postRes = await axios.post(
      `${LI_API}/ugcPosts`,
      {
        author:          authorUrn,
        lifecycleState:  "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": shareContent,
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      },
      { headers }
    );

    res.json({ success: true, data: postRes.data });
  } catch (err) {
    console.error("LinkedIn create post error:", err.response?.data || err.message);
    res.status(500).json(err.response?.data || { error: "Failed to create post" });
  }
});

// Temporary diagnostic: test LinkedIn credentials without a real OAuth code
router.get("/test-credentials", async (req, res) => {
  const callbackUri = `${BACKEND_URL}/linkedin/callback`;
  const body = [
    `grant_type=authorization_code`,
    `code=TEST_INVALID_CODE`,
    `redirect_uri=${encodeURIComponent(callbackUri)}`,
    `client_id=${encodeURIComponent(LI_CLIENT_ID)}`,
    `client_secret=${encodeURIComponent(LI_CLIENT_SECRET)}`,
  ].join("&");

  try {
    const response = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      body,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        validateStatus: () => true,
      }
    );
    res.json({
      status:           response.status,
      isHtml:           typeof response.data === "string",
      data:             typeof response.data === "string" ? response.data.slice(0, 200) : response.data,
      redirect_uri_used: callbackUri,
      client_id_used:   LI_CLIENT_ID,
    });
  } catch (err) {
    res.json({ exception: err.message });
  }
});

module.exports = router;
