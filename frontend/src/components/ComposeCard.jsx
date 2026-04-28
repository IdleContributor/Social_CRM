/**
 * ComposeCard
 *
 * Shared compose UI: title badge, textarea, image preview, action bar,
 * optional character counter, optional status banner.
 *
 * Props:
 *   title         — left label in the compose header (e.g. "✏️ Create a Post")
 *   badge         — right badge text (e.g. page name or platform count)
 *   badgeStyle    — inline style object for the badge (optional)
 *   placeholder   — textarea placeholder
 *   value         — controlled textarea value
 *   onChange      — textarea onChange handler
 *   maxLength     — if set, shows a character counter
 *   counterSuffix — extra text after the counter (e.g. "(Threads limit)")
 *   imagePreview  — data URL for the selected image preview
 *   onRemoveImage — handler to clear the selected image
 *   fileInputRef  — ref forwarded to the hidden <input type="file">
 *   onImageChange — onChange handler for the hidden file input
 *   postImage     — current File object (used to toggle button label)
 *   status        — { type: "success"|"error", msg: string } | null
 *   actions       — JSX rendered inside the compose-bar after the image button
 *                   (submit button, schedule toggle, etc.)
 *   extraRows     — JSX rendered below the compose-bar (e.g. schedule picker)
 */
export default function ComposeCard({
  title,
  badge,
  badgeStyle,
  placeholder,
  value,
  onChange,
  maxLength,
  counterSuffix,
  imagePreview,
  onRemoveImage,
  fileInputRef,
  onImageChange,
  postImage,
  status,
  actions,
  extraRows,
}) {
  return (
    <div className="compose-card">
      {/* Header */}
      <div className="compose-header">
        <span className="compose-title">{title}</span>
        {badge && (
          <span className="compose-page-badge" style={badgeStyle}>
            {badge}
          </span>
        )}
      </div>

      {/* Textarea */}
      <textarea
        className="compose-textarea"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
      />

      {/* Character counter */}
      {maxLength != null && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "right", marginTop: 4 }}>
          {value.length}/{maxLength}
          {counterSuffix && (
            <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>{counterSuffix}</span>
          )}
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="image-preview-wrap">
          <img src={imagePreview} alt="preview" />
          <button className="image-remove-btn" onClick={onRemoveImage} aria-label="Remove image">
            ✕
          </button>
        </div>
      )}

      {/* Action bar */}
      <div className="compose-bar">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={onImageChange}
        />
        <button className="btn btn-ghost" onClick={() => fileInputRef.current.click()}>
          📷 {postImage ? "Change Image" : "Add Image"}
        </button>

        {/* Caller-supplied actions (submit button, schedule toggle, etc.) */}
        {actions}
      </div>

      {/* Extra rows below the bar (e.g. schedule date picker) */}
      {extraRows}

      {/* Status banner */}
      {status && (
        <div className={`status-banner ${status.type}`}>{status.msg}</div>
      )}
    </div>
  );
}
