// ── Rate limiters ─────────────────────────────────────────────────────

const rateLimit = require("express-rate-limit");

// 100 requests per minute per IP — applied globally
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

// Stricter limiter for auth endpoints — 20 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many auth attempts, try again later." },
});

module.exports = { globalLimiter, authLimiter };
