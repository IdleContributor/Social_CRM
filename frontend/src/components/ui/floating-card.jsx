import { useState, useEffect, useRef } from "react";

// ── Custom hooks ───────────────────────────────────────────────────────

function useCardTransform() {
  const [transform, setTransform] = useState({
    rotateX: 0, rotateY: 0, translateY: 0, scale: 1,
  });

  const handleMouseMove = (e, cardRef) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    setTransform({
      rotateX: (y / rect.height) * -20,
      rotateY: (x / rect.width) * 20,
      translateY: -12,
      scale: 1.03,
    });
  };

  const handleMouseLeave = () => {
    setTransform({ rotateX: 0, rotateY: 0, translateY: 0, scale: 1 });
  };

  return { transform, handleMouseMove, handleMouseLeave };
}

function useParticles(isActive) {
  const [particles, setParticles] = useState([]);
  const particleId = useRef(0);

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => {
      const p = {
        id: particleId.current++,
        left: Math.random() * 100,
        duration: Math.random() * 3 + 2,
        opacity: Math.random() * 0.4 + 0.15,
      };
      setParticles((prev) => [...prev, p]);
      setTimeout(() => {
        setParticles((prev) => prev.filter((x) => x.id !== p.id));
      }, p.duration * 1000);
    }, 400);
    return () => clearInterval(interval);
  }, [isActive]);

  return particles;
}

function useRipple() {
  const [ripples, setRipples] = useState([]);
  const rippleId = useRef(0);

  const createRipple = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const r = {
      id: rippleId.current++,
      x: e.clientX - rect.left - 30,
      y: e.clientY - rect.top - 30,
    };
    setRipples((prev) => [...prev, r]);
    setTimeout(() => setRipples((prev) => prev.filter((x) => x.id !== r.id)), 600);
  };

  return { ripples, createRipple };
}

// ── FloatingCard ───────────────────────────────────────────────────────
/**
 * Props:
 *   gradient    — CSS gradient for icon bg and action button
 *   shadow      — rgba shadow color
 *   icon        — character shown in the icon square
 *   name        — platform name
 *   description — short description
 *   image       — Unsplash image URL
 *   available   — if false, card is faded and shows "Coming soon"
 *   connected   — if true, LED is green and button says "Open"
 *                 if false, LED is red and button says "Login"
 *   onLogin     — called when user clicks the button while not connected
 *   onOpen      — called when user clicks the button while connected
 *                 (also called when clicking the card body while connected)
 *   isBroadcast — if true, no LED, button always says "Post →"
 */
export function FloatingCard({
  gradient,
  shadow,
  icon,
  name,
  description,
  image,
  available = true,
  connected = false,
  onLogin,
  onOpen,
  isBroadcast = false,
}) {
  const cardRef = useRef(null);
  const { transform, handleMouseMove, handleMouseLeave } = useCardTransform();
  const { ripples, createRipple } = useRipple();
  const particles = useParticles(available);

  const transformStyle = `translateY(${transform.translateY}px) rotateX(${transform.rotateX}deg) rotateY(${transform.rotateY}deg) scale(${transform.scale})`;

  // Clicking the card body navigates if connected or broadcast, otherwise does nothing
  const handleCardClick = (e) => {
    createRipple(e);
    if (available && (connected || isBroadcast) && onOpen) onOpen();
  };

  // The action button
  const handleActionClick = (e) => {
    e.stopPropagation();
    if (!available) return;
    if (isBroadcast) {
      if (onOpen) onOpen();
    } else if (connected) {
      if (onOpen) onOpen();
    } else {
      if (onLogin) onLogin();
    }
  };

  const btnLabel = !available
    ? "Coming soon"
    : isBroadcast
    ? "Post →"
    : connected
    ? "Open →"
    : "Login";

  return (
    <div
      style={{ perspective: "1000px" }}
      onMouseMove={(e) => available && handleMouseMove(e, cardRef)}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={cardRef}
        onClick={handleCardClick}
        style={{
          transform: transformStyle,
          animation: available ? "fc-float 6s ease-in-out infinite" : "none",
          transition: "transform 0.4s cubic-bezier(.03,.98,.52,.99)",
          position: "relative",
          borderRadius: 24,
          background: "var(--surface)",
          border: "1.5px solid var(--border-light)",
          boxShadow: available
            ? `0 8px 32px ${shadow}, 0 2px 8px rgba(0,0,0,.40)`
            : "0 2px 8px rgba(0,0,0,.20)",
          cursor: available && (connected || isBroadcast) ? "pointer" : "default",
          opacity: available ? 1 : 0.4,
          overflow: "hidden",
          padding: "24px 24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minHeight: 320,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Particles */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 24, overflow: "hidden", pointerEvents: "none" }}>
          {particles.map((p) => (
            <div
              key={p.id}
              style={{
                position: "absolute",
                width: 2,
                height: 2,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.6)",
                left: `${p.left}%`,
                opacity: p.opacity,
                animation: `fc-particle ${p.duration}s linear forwards`,
              }}
            />
          ))}
        </div>

        {/* Ripples */}
        {ripples.map((r) => (
          <span
            key={r.id}
            style={{
              position: "absolute",
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.15)",
              left: r.x,
              top: r.y,
              pointerEvents: "none",
              animation: "fc-ripple 0.6s ease-out forwards",
            }}
          />
        ))}

        {/* Icon + LED row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: gradient,
              boxShadow: `0 4px 16px ${shadow}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: -1,
              transform: transform.scale > 1 ? "translateZ(20px)" : "none",
              transition: "transform 0.4s",
              flexShrink: 0,
            }}
          >
            {icon}
          </div>

          {available && !isBroadcast && (
            <span
              className={`status-led ${connected ? "led-green" : "led-red"}`}
              aria-hidden="true"
              style={{ marginTop: 4 }}
            />
          )}
        </div>

        {/* Image */}
        {image && (
          <img
            src={image}
            alt={name}
            style={{
              width: "100%",
              height: 120,
              objectFit: "cover",
              borderRadius: 12,
              border: "1px solid var(--border-light)",
              transform: transform.scale > 1 ? "translateZ(10px) scale(1.02)" : "none",
              transition: "transform 0.4s",
            }}
          />
        )}

        {/* Text */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 6 }}>
            {name}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            {description}
          </div>
        </div>

        {/* Action button — full width at bottom */}
        <button
          onClick={(e) => {
            e.stopPropagation(); // prevent card click handler
            if (!available) return;
            if (isBroadcast) {
              if (onOpen) onOpen();
            } else if (connected) {
              if (onOpen) onOpen();
            } else {
              // FB.login MUST be called synchronously here — no wrappers
              if (onLogin) onLogin();
            }
          }}
          disabled={!available}
          style={{
            width: "100%",
            padding: "10px 0",
            borderRadius: 10,
            border: "none",
            background: available ? gradient : "var(--surface-2)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 700,
            cursor: available ? "pointer" : "not-allowed",
            opacity: available ? 1 : 0.5,
            transition: "filter 0.15s",
            boxShadow: available ? `0 2px 10px ${shadow}` : "none",
            letterSpacing: 0.2,
            position: "relative", // ensure it's above the card overlay
            zIndex: 10,
          }}
          onMouseEnter={(e) => { if (available) e.currentTarget.style.filter = "brightness(1.15)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
        >
          {btnLabel}
        </button>
      </div>

      <style>{`
        @keyframes fc-float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-8px); }
        }
        @keyframes fc-particle {
          0%   { transform: translateY(100%) scale(0); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateY(-400%) scale(1); opacity: 0; }
        }
        @keyframes fc-ripple {
          0%   { transform: scale(0); opacity: 1; }
          100% { transform: scale(4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
