import { useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import HomePage from "./pages/HomePage.jsx";
import FacebookPage from "./pages/FacebookPage.jsx";
import ThreadsPage from "./pages/ThreadsPage.jsx";
import LinkedInPage from "./pages/LinkedInPage.jsx";
import BroadcastPage from "./pages/BroadcastPage.jsx";
import XPage from "./pages/XPage.jsx";
import InstagramPage from "./pages/InstagramPage.jsx";

/**
 * AppRouter
 *
 * Owns the active view state and resolves the initial view from OAuth
 * redirect query params. Renders the correct page component and passes
 * navigation callbacks down.
 *
 * Views: "home" | "facebook" | "threads" | "linkedin" | "broadcast"
 */
export default function AppRouter() {
  const { user, signOut } = useAuth();

  const [view, setView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("li_token") && params.get("state") === "linkedin_oauth") return "linkedin";
    if (params.get("li_error")) return "linkedin";
    if (params.get("code"))     return "threads";
    if (params.get("x_token"))  return "x";
    if (params.get("x_error"))  return "x";
    if (params.get("ig_token") && params.get("state") === "instagram_oauth") return "instagram";
    if (params.get("ig_error")) return "instagram";
    return "home";
  });

  const goHome = () => setView("home");

  return (
    <>
      <ThemeToggle />
      {view === "facebook"  && <FacebookPage   onBack={goHome} />}
      {view === "threads"   && <ThreadsPage    onBack={goHome} />}
      {view === "linkedin"  && <LinkedInPage   onBack={goHome} />}
      {view === "broadcast" && <BroadcastPage  onBack={goHome} />}
      {view === "x"         && <XPage          onBack={goHome} />}
      {view === "instagram" && <InstagramPage  onBack={goHome} />}
      {view === "home"      && <HomePage user={user} signOut={signOut} onNavigate={setView} />}
    </>
  );
}
