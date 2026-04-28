/**
 * PostCard
 *
 * Renders a single post/thread card with engagement row and expandable
 * comments/replies section.
 *
 * Props:
 *   timestamp     — ISO string or unix ms for the post time
 *   text          — post body text (null/undefined shows "(no text)")
 *   imageUrl      — optional media image URL
 *   engagementBadges — array of { label, className } for the eng-badge spans
 *                      e.g. [{ label: "👍 3 Likes", className: "likes" }]
 *   toggleLabel   — label for the show/hide comments button (e.g. "View Comments")
 *   isOpen        — whether the comments section is expanded
 *   onToggle      — handler to open/close comments
 *   showToggle    — whether to render the toggle button at all
 *
 *   // Comments / replies section
 *   items         — array of comment/reply objects
 *   itemLoading   — boolean
 *   itemError     — string | null
 *   emptyLabel    — text when items is empty (e.g. "No comments yet.")
 *   loadingLabel  — text while loading (e.g. "Loading comments…")
 *   nextCursor    — if set, renders a "Load more" button
 *   onLoadMore    — handler for load more
 *
 *   // Render a single item — caller controls the shape
 *   renderItem    — (item, index) => JSX
 */
export default function PostCard({
  timestamp,
  text,
  imageUrl,
  engagementBadges = [],
  toggleLabel,
  isOpen,
  onToggle,
  showToggle,
  items,
  itemLoading,
  itemError,
  emptyLabel = "No items yet.",
  loadingLabel = "Loading…",
  nextCursor,
  onLoadMore,
  renderItem,
}) {
  return (
    <div className="post-card">
      {/* Timestamp */}
      <div className="post-time">
        🕐 {new Date(timestamp).toLocaleString()}
      </div>

      {/* Body text */}
      <div className="post-message">
        {text || <i style={{ color: "var(--text-muted)" }}>(no text)</i>}
      </div>

      {/* Media image */}
      {imageUrl && (
        <img src={imageUrl} alt="post" className="post-image" />
      )}

      {/* Engagement row */}
      <div className="eng-row">
        {engagementBadges.map((b, i) => (
          <span key={i} className={`eng-badge ${b.className}`}>
            {b.label}
          </span>
        ))}
        {showToggle && (
          <button
            className={`view-cmt-btn${isOpen ? " open" : ""}`}
            onClick={onToggle}
          >
            {isOpen ? `Hide ${toggleLabel}` : `View ${toggleLabel}`}
          </button>
        )}
      </div>

      {/* Expanded comments / replies */}
      {isOpen && (
        <div className="cmt-section">
          {itemLoading && !items?.length && (
            <div className="cmt-empty">{loadingLabel}</div>
          )}
          {itemError && (
            <div className="cmt-error">⚠️ {itemError}</div>
          )}
          {items?.length === 0 && !itemLoading && (
            <div className="cmt-empty">{emptyLabel}</div>
          )}
          {items?.map((item, i) => renderItem(item, i))}
          {nextCursor && (
            <button
              className="load-more-btn"
              disabled={itemLoading}
              onClick={onLoadMore}
            >
              {itemLoading ? "Loading…" : "Load more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
