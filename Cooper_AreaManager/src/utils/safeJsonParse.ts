// Navigation params (task/member handed between screens as JSON.stringify'd
// route params) are attacker-free but not crash-free — a value can be
// missing, truncated by a platform's URL-length limit, or just stale after
// an app update changes the shape. Parsing it directly at the top of a
// screen throws during render, which the app's single top-level
// ErrorBoundary catches — but its "Try Again" only re-renders the same
// screen with the same bad param, so the user is stuck. Falling back to
// `undefined` here instead lets the screen's normal "not found" state
// handle it.
export function safeJsonParse<T>(raw: string | undefined | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.log('[safeJsonParse] Failed to parse:', error);
    return undefined;
  }
}
