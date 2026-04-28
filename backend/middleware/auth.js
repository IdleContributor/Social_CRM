// ── JWT auth middleware ───────────────────────────────────────────────
// Attach to any route that requires the user to be Google-authenticated.

const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config");

function requireAuth(req, res, next) {
  const token =
    req.headers["authorization"]?.split(" ")[1] ||
    req.query._auth; // fallback for redirect flows

  if (!token) {
    return res.status(401).json({ error: "Not authenticated. Please sign in." });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

module.exports = { requireAuth };
