import { ImagePlus, X } from "lucide-react";

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
            <span style={{ marginLeft: 6 }}>{counterSuffix}</span>
          )}
        </div>
      )}

      {/* Image preview */}
      {imagePreview && (
        <div className="image-preview-wrap">
          <img src={imagePreview} alt="preview" />
          <button className="image-remove-btn" onClick={onRemoveImage} aria-label="Remove image">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Action bar */}
      <div className="compose-bar">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={onImageChange}
        />
        <button className="btn btn-outline btn-sm" onClick={() => fileInputRef.current?.click()}
          style={{ gap: 6 }}>
          <ImagePlus size={14} />
          {postImage ? "Change Image" : "Add Image"}
        </button>
        {actions}
      </div>

      {extraRows}

      {/* Status banner */}
      {status && (
        <div className={`status-banner ${status.type}`} style={{ marginTop: 14 }}>
          {status.msg}
        </div>
      )}
    </div>
  );
}
