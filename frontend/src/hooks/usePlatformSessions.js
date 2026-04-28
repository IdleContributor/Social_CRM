import { useState, useEffect } from "react";
import { lsGet } from "./useLocalStorage.js";

/**
 * usePlatformSessions
 *
 * Reads all three platform sessions from localStorage and returns a
 * simple { facebook, threads, linkedin } boolean map.
 * Re-reads on every call so callers can trigger a refresh by re-rendering.
 */
export function getPlatformSessions() {
  return {
    facebook:  !!lsGet("fb_active_page"),
    threads:   !!(localStorage.getItem("threads_token") && lsGet("threads_profile")),
    linkedin:  !!(localStorage.getItem("li_token") && lsGet("li_profile")),
    x:         !!(localStorage.getItem("x_token") && lsGet("x_profile")),
    instagram: !!(localStorage.getItem("ig_token") && lsGet("ig_account")),
  };
}

/**
 * Hook version — returns sessions and a manual refresh function.
 */
export function usePlatformSessions() {
  const [sessions, setSessions] = useState(getPlatformSessions);
  const refresh = () => setSessions(getPlatformSessions());
  // Re-read on focus (user may have logged in on another tab / just returned)
  useEffect(() => {
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  return { sessions, refresh };
}
