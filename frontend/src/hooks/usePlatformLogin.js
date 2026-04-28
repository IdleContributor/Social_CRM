import { useEffect } from "react";
import api from "../api.js";

/**
 * useFacebookSDK
 *
 * Loads the Facebook JS SDK and calls FB.init().
 * Does NOT return a login function — callers must call window.FB.login()
 * directly from a button's onClick to preserve the trusted user gesture.
 */
export function useFacebookSDK() {
  useEffect(() => {
    // Already initialised
    if (window.FB) return;

    const load = async () => {
      try {
        const cfg = await api.get("/api/config");
        const appId = cfg.data.appId;
        if (!appId) { console.warn("FB APP_ID missing from /api/config"); return; }

        window.fbAsyncInit = function () {
          window.FB.init({ appId, cookie: true, xfbml: true, version: "v19.0" });
          console.log("[FB SDK] initialised");
        };

        // Don't add the script twice
        if (document.getElementById("fb-sdk")) return;

        const script = document.createElement("script");
        script.id  = "fb-sdk";
        script.src = "https://connect.facebook.net/en_US/sdk.js";
        script.async = true;
        script.defer = true;
        document.body.appendChild(script);
      } catch (err) {
        console.error("[FB SDK] load error:", err);
      }
    };

    load();
  }, []);
}

/**
 * loginWithThreads
 * Redirects to Threads OAuth. Call directly from onClick.
 */
export async function loginWithThreads() {
  try {
    const res = await api.get("/api/threads/auth-url");
    window.location.href = res.data.url;
  } catch {
    alert("Failed to get Threads auth URL. Is the server running?");
  }
}

/**
 * loginWithLinkedIn
 * Redirects to LinkedIn OAuth. Call directly from onClick.
 */
export async function loginWithLinkedIn() {
  try {
    const res = await api.get("/api/linkedin/auth-url");
    window.location.href = res.data.url;
  } catch {
    alert("Failed to get LinkedIn auth URL. Is the server running?");
  }
}

/**
 * loginWithX
 * Redirects to X OAuth. Call directly from onClick.
 */
export async function loginWithX() {
  try {
    const res = await api.get("/api/x/auth-url");
    window.location.href = res.data.url;
  } catch (err) {
    const msg = err.response?.data?.error || "Failed to get X auth URL. Is the server running?";
    alert(msg);
  }
}

/**
 * loginWithInstagram
 * Redirects to Facebook OAuth with Instagram scopes.
 */
export async function loginWithInstagram() {
  try {
    const res = await api.get("/api/instagram/auth-url");
    window.location.href = res.data.url;
  } catch (err) {
    const msg = err.response?.data?.error || "Failed to get Instagram auth URL. Is the server running?";
    alert(msg);
  }
}
