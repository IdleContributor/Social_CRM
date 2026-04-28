/**
 * AppHeader
 *
 * Props:
 *   onBack      — if provided, renders a ← Back button
 *   logo        — string rendered inside the logo circle (e.g. "f", "@", "in")
 *   logoClass   — extra CSS class on the logo div (e.g. "threads-logo")
 *   title       — main title text
 *   subtitle    — subtitle text
 *   children    — right-side slot (login button, logout button, user chip, etc.)
 */
export default function AppHeader({ onBack, logo, logoClass = "", title, subtitle, children }) {
  return (
    <header className="app-header">
      {onBack && (
        <button
          className="btn btn-ghost btn-sm back-btn"
          onClick={onBack}
          aria-label="Back"
        >
          ← Back
        </button>
      )}
      {logo && (
        <div className={`app-logo ${logoClass}`}>{logo}</div>
      )}
      <div>
        <div className="app-title">{title}</div>
        {subtitle && <div className="app-subtitle">{subtitle}</div>}
      </div>
      {children}
    </header>
  );
}
