// ── Facebook routes ───────────────────────────────────────────────────
// GET    /page-posts           — fetch posts for a page (with likes/comments summary)
// GET    /post-comments        — fetch all comments for a single post (paginated)
// POST   /create-post          — create a post (text/image, immediate or scheduled)
// GET    /scheduled-posts      — fetch scheduled (unpublished) posts
// DELETE /scheduled-posts/:id  — cancel a scheduled post
// GET    /config               — return minimal config for frontend (APP_ID)

const express  = require("express");
const axios    = require("axios");
const multer   = require("multer");
const FormData = require("form-data");

const { requireAuth } = require("../middleware/auth");
const { APP_ID }      = require("../config");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Fetch page posts — includes like/comment summaries and first page of comments
router.get("/page-posts", requireAuth, async (req, res) => {
  const { pageId, token } = req.query;
  try {
    const fields = [
      "message",
      "created_time",
      "full_picture",
      "attachments",
      "likes.summary(true)",
      "comments.summary(true){message,from,created_time}",
    ].join(",");
    const response = await axios.get(
      `https://graph.facebook.com/v19.0/${pageId}/posts?fields=${fields}&access_token=${token}`
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || { error: "Unknown error" });
  }
});

// Fetch all comments for a single post (supports pagination via `after` cursor)
router.get("/post-comments", requireAuth, async (req, res) => {
  const { postId, token, after } = req.query;
  if (!postId || !token) {
    return res.status(400).json({ error: "postId and token are required" });
  }
  try {
    const params = new URLSearchParams({
      fields: "message,from,created_time",
      summary: "true",
      access_token: token,
      limit: 25,
    });
    if (after) params.append("after", after);
    const response = await axios.get(
      `https://graph.facebook.com/v19.0/${postId}/comments?${params}`
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || { error: "Unknown error" });
  }
});

// Create a post (text only OR text + image, immediate or scheduled)
// Optional body field: scheduledTime — ISO 8601 string, must be 10 min–30 days from now
router.post("/create-post", requireAuth, upload.single("image"), async (req, res) => {
  const { pageId, token, message, scheduledTime } = req.body;

  if (!pageId || !token) {
    return res.status(400).json({ error: "pageId and token are required" });
  }

  // Validate scheduled time when provided
  let scheduledUnix = null;
  if (scheduledTime) {
    const ts = Math.floor(new Date(scheduledTime).getTime() / 1000);
    const now = Math.floor(Date.now() / 1000);
    const tenMin = 10 * 60;
    const thirtyDays = 30 * 24 * 60 * 60;
    if (isNaN(ts)) {
      return res.status(400).json({ error: "Invalid scheduledTime value." });
    }
    if (ts < now + tenMin) {
      return res.status(400).json({ error: "Scheduled time must be at least 10 minutes from now." });
    }
    if (ts > now + thirtyDays) {
      return res.status(400).json({ error: "Scheduled time must be within 30 days from now." });
    }
    scheduledUnix = ts;
  }

  try {
    let fbResponse;

    if (req.file) {
      // Photo post — scheduled photo posts go via /{pageId}/photos with published=false
      const formData = new FormData();
      formData.append("source", req.file.buffer, {
        filename: req.file.originalname,
        contentType: req.file.mimetype,
      });
      if (message) formData.append("message", message);
      formData.append("access_token", token);
      if (scheduledUnix) {
        formData.append("published", "false");
        formData.append("scheduled_publish_time", String(scheduledUnix));
      }

      fbResponse = await axios.post(
        `https://graph.facebook.com/v19.0/${pageId}/photos`,
        formData,
        { headers: formData.getHeaders() }
      );
    } else {
      // Text-only post via /{pageId}/feed
      const params = { message, access_token: token };
      if (scheduledUnix) {
        params.published = "false";
        params.scheduled_publish_time = scheduledUnix;
      }

      fbResponse = await axios.post(
        `https://graph.facebook.com/v19.0/${pageId}/feed`,
        null,
        { params }
      );
    }

    res.json({
      success: true,
      scheduled: !!scheduledUnix,
      scheduledTime: scheduledUnix ? new Date(scheduledUnix * 1000).toISOString() : null,
      data: fbResponse.data,
    });
  } catch (err) {
    console.error("FB post error:", err.response?.data || err.message);
    res.status(500).json(err.response?.data || { error: "Failed to post" });
  }
});

// Fetch scheduled (unpublished) posts for a page
router.get("/scheduled-posts", requireAuth, async (req, res) => {
  const { pageId, token } = req.query;
  if (!pageId || !token) {
    return res.status(400).json({ error: "pageId and token are required" });
  }
  try {
    const response = await axios.get(
      `https://graph.facebook.com/v19.0/${pageId}/scheduled_posts`,
      {
        params: {
          fields: "message,scheduled_publish_time,full_picture,attachments",
          access_token: token,
        },
      }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || { error: "Unknown error" });
  }
});

// Cancel (delete) a scheduled post
router.delete("/scheduled-posts/:postId", requireAuth, async (req, res) => {
  const { postId } = req.params;
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: "token is required" });
  try {
    const response = await axios.delete(
      `https://graph.facebook.com/v19.0/${postId}`,
      { params: { access_token: token } }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json(err.response?.data || { error: "Failed to delete post" });
  }
});

// Return minimal config for frontend
router.get("/config", (req, res) => {
  res.json({ appId: APP_ID });
});

module.exports = router;
