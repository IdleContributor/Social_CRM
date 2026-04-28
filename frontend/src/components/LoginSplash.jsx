/**
 * LoginSplash
 *
 * The "connect your X account" screen shown when a user hasn't authenticated
 * with a platform yet.
 *
 * Props:
 *   icon        — character/string shown in the big icon circle
 *   iconClass   — extra CSS class on the icon div (e.g. "threads-splash-icon")
 *   title       — heading text
 *   description — paragraph text
 *   buttonLabel — text on the primary CTA button
 *   buttonClass — extra CSS class on the button (e.g. "threads-login-btn")
 *   onLogin     — click handler for the CTA button
 *   disabled    — disables the button (e.g. while SDK loads)
 */
export default function LoginSplash({
  icon,
  iconClass = "",
  title,
  description,
  buttonLabel,
  buttonClass = "",
  onLogin,
  disabled = false,
}) {
  return (
    <div className="login-splash">
      <div className={`login-splash-icon ${iconClass}`}>{icon}</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <button
        className={`btn btn-primary btn-lg ${buttonClass}`}
        onClick={onLogin}
        disabled={disabled}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
