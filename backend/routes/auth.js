// ── Auth routes ───────────────────────────────────────────────────────
// POST /auth/google  — verify Google ID token, issue JWT
// GET  /auth/me      — verify current session

const express = require("express");
const jwt     = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const { JWT_SECRET, GOOGLE_CLIENT_ID } = require("../config");
const { requireAuth }  = require("../middleware/auth");
const { authLimiter }  = require("../middleware/rateLimiter");

const router       = express.Router();
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Verify Google ID token sent from the frontend Sign-In button, return a JWT
router.post("/google", authLimiter, async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: "credential is required" });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken:  credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const user = {
      id:      payload.sub,
      name:    payload.name,
      email:   payload.email,
      picture: payload.picture,
    };

    console.log(`[AUTH] User signed in: ${user.name} <${user.email}> at ${new Date().toISOString()}`);

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user });
  } catch (err) {
    console.error("Google auth error:", err.message);
    res.status(401).json({ error: "Invalid Google credential" });
  }
});

// Verify Google access token (from useGoogleLogin hook), fetch userinfo, issue JWT
// Used by the custom-styled sign-in button on the frontend.
router.post("/google/token", authLimiter, async (req, res) => {
  const { access_token } = req.body;
  if (!access_token) return res.status(400).json({ error: "access_token is required" });

  try {
    const response = await fetch(
      `https://www.googleapis.com/oauth2/v3/userinfo`,
      { headers: { Authorization: `Bearer ${access_token}` } }
    );
    if (!response.ok) throw new Error("Failed to fetch Google userinfo");
    const payload = await response.json();

    const user = {
      id:      payload.sub,
      name:    payload.name,
      email:   payload.email,
      picture: payload.picture,
    };

    console.log(`[AUTH] User signed in: ${user.name} <${user.email}> at ${new Date().toISOString()}`);

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user });
  } catch (err) {
    console.error("Google token auth error:", err.message);
    res.status(401).json({ error: "Invalid Google access token" });
  }
});

// Verify the stored JWT is still valid — called by the frontend on load
router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
