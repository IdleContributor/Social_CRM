import { useEffect } from "react";
import api from "../api.js";
import AppHeader from "../components/AppHeader.jsx";
import { FloatingCard } from "../components/ui/floating-card.jsx";
import { usePlatformSessions } from "../hooks/usePlatformSessions.js";
import { useFacebookSDK, loginWithThreads, loginWithLinkedIn, loginWithX, loginWithInstagram } from "../hooks/usePlatformLogin.js";
import { lsSet } from "../hooks/useLocalStorage.js";

const PLATFORMS = [
  {
    id: "facebook",
    name: "Facebook",
    icon: "f",
    gradient: "linear-gradient(135deg, #1877f2 0%, #0f5ecf 100%)",
    shadow: "rgba(24,119,242,.45)",
    description: "Manage your Facebook Pages, schedule posts, view engagement and comments.",
    image: "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&q=80&fit=crop",
    available: true,
  },
  {
    id: "threads",
    name: "Threads",
    icon: "@",
    gradient: "linear-gradient(135deg, #1a1a1a 0%, #3a3a3a 100%)",
    shadow: "rgba(255,255,255,.12)",
    description: "Publish threads, browse your feed, and manage replies from one place.",
    image: "https://images.unsplash.com/photo-1516251193007-45ef944ab0c6?w=600&q=80&fit=crop",
    available: true,
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "◈",
    gradient: "linear-gradient(135deg, #f58529 0%, #dd2a7b 50%, #8134af 100%)",
    shadow: "rgba(225,48,108,.45)",
    description: "Publish photos to your Instagram Business or Creator account.",
    image: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&q=80&fit=crop",
    available: true,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "in",
    gradient: "linear-gradient(135deg, #0a66c2 0%, #004182 100%)",
    shadow: "rgba(10,102,194,.45)",
    description: "Publish posts to your LinkedIn profile and grow your professional network.",
    image: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&q=80&fit=crop",
    available: true,
  },
  {
    id: "x",
    name: "X (Twitter)",
    icon: "𝕏",
    gradient: "linear-gradient(135deg, #000000 0%, #14171a 100%)",
    shadow: "rgba(255,255,255,.15)",
    description: "Post tweets, manage your timeline, and engage with your X audience.",
    image: "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=600&q=80&fit=crop",
    available: true,
  },
  {
    id: "broadcast",
    name: "Post to All",
    icon: "✦",
    gradient: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
    shadow: "rgba(124,58,237,.45)",
    description: "Write once, publish to Facebook, Threads and LinkedIn simultaneously.",
    image: "https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=600&q=80&fit=crop",
    available: true,
  },
];

export default function HomePage({ user, signOut, onNavigate }) {
  const { sessions, refresh } = usePlatformSessions();

  // Load FB SDK (doesn't return a login function — we call window.FB.login directly)
  useFacebookSDK();

  useEffect(() => { refresh(); }, []);

  // Facebook login — called directly from the card button, must be synchronous
  const handleFacebookLogin = () => {
    if (!window.FB) {
      alert("Facebook SDK is still loading. Please wait a moment and try again.");
      return;
    }
    window.FB.login(
      (response) => {
        if (!response.authResponse) return;
        api.get(
          `https://graph.facebook.com/v19.0/me/accounts?access_token=${response.authResponse.accessToken}`
        ).then((pagesRes) => {
          const pagesData = pagesRes.data.data || [];
          if (pagesData.length === 0) {
            alert("No Facebook Pages found. Make sure you manage a Facebook Page.");
            return;
          }
          lsSet("fb_pages", pagesData);
          lsSet("fb_active_page", pagesData[0]);
          refresh();
        }).catch((err) => {
          console.error("FB pages fetch error:", err);
        });
      },
      { scope: "pages_show_list,pages_read_engagement,pages_read_user_content,pages_manage_posts" }
    );
  };

  // Per-platform login handlers
  const loginHandlers = {
    facebook:  handleFacebookLogin,
    threads:   loginWithThreads,
    linkedin:  loginWithLinkedIn,
    x:         loginWithX,
    instagram: loginWithInstagram,
    broadcast: null,
  };

  return (
    <div style={{ minHeight: "100svh", background: "var(--bg)", padding: "0 0 60px" }}>

      {/* Header */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        <AppHeader logo="S" logoClass="crm-logo" title="Social CRM" subtitle="Choose a platform to get started">
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {user.picture && (
              <img
                src={user.picture}
                alt={user.name}
                style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--border-light)" }}
              />
            )}
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{user.name}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{user.email}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={signOut} title="Sign out">🚪</button>
          </div>
        </AppHeader>
      </div>

      {/* Card grid */}
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 24,
        }}
      >
        {PLATFORMS.map((p) => (
          <FloatingCard
            key={p.id}
            gradient={p.gradient}
            shadow={p.shadow}
            icon={p.icon}
            name={p.name}
            description={p.description}
            image={p.image}
            available={p.available}
            connected={sessions[p.id] ?? false}
            onLogin={loginHandlers[p.id]}
            onOpen={() => onNavigate(p.id)}
            isBroadcast={p.id === "broadcast"}
          />
        ))}
      </div>
    </div>
  );
}
