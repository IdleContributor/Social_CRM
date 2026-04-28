/**
 * Safe helpers for reading and writing JSON values in localStorage.
 * Silently returns null on parse errors so callers don't need try/catch.
 */

export function lsGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function lsSet(key, value) {
  localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
}

export function lsRemove(key) {
  localStorage.removeItem(key);
}
