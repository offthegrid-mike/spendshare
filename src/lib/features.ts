/**
 * Dark mode stays off until every screen uses the semantic colour tokens:
 * screens still on slate-* literals are unreadable on the dark canvas.
 * Redesign PR 5 (remaining screens + cleanup) flips this to true.
 */
export const DARK_MODE_ENABLED = false;
