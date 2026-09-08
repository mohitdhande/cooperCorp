# Changelog

All notable changes to the Cooper_AreaManager app are recorded here, newest first.

## v0.0.2 — 2026-09-05

### Location safety (Start / Complete / media uploads)
- Start, Complete, and every photo/video/PDF upload now require a real, currently-confirmed location before the API call is made at all — if GPS is off or location permission is denied, nothing is sent to the server; a popup with a one-tap **Turn On** (Android, via the native location dialog) or **Open Settings** button shows instead. A weak/absent GPS *fix* (GPS on and allowed, just no signal yet) still lets the action through, unchanged — there's no reliable one-tap fix for that case, and blocking it could strand someone indoors near metal equipment.
- The same requirement now also covers **background auto-retry**, not just the live tap: a Start/Complete/upload that got queued for offline retry re-checks location before it's actually replayed, instead of silently going through the moment connectivity returns regardless of whether location is still off.
- Fixed a stale-cache bug where turning location back on didn't actually help the very next upload — a failed location result was being cached for 2 minutes, including the "off" result from before the fix.
- The location-off/permission-off alert's "Turn On"/"Open Settings" buttons now clear that cache immediately, so the next attempt genuinely retries instead of reusing the old failure.

### Camera error handling
- Every camera failure (permission denied, or the camera simply won't open) now shows a clear popup naming the likely cause — including phone-brand-specific privacy managers (Xiaomi/MIUI, Oppo/ColorOS, Vivo/FuntouchOS, Realme) that can silently block the camera even when Android's own permission looks granted — with a direct **Open Settings** button, instead of a dead-end "OK" message.
- Fixed a gap on the Profile screen's "Take Photo" action, which previously had no error handling at all for a failed camera launch.

### Uploads
- Fixed uploads that could hang forever with no error or timeout on a dropped/stalled connection (photo, video, and PDF uploads all share this path) — now gives up after 30 seconds of no progress and safely queues the file for automatic retry, instead of freezing indefinitely.
- The "Add Tag" control on video and PDF rows is now clearly visible (dashed-border chip, bold "Add Tag" label) instead of a small, easy-to-miss grey "Tag" label.
- The Photos & Video grid now wraps into a proper 2-per-row layout instead of a single row that ran off the edge of the screen.

### Offline / sync reliability
- Fixed "Entry must be in progress to complete" showing with no explanation: if the earlier Start action hadn't actually reached the server yet (still queued offline), Complete now gives the sync one real chance to catch up first, and shows a clear message if it's still stuck, instead of surfacing the server's confusing rejection.

### Work approval
- Added a note-input step to the Approve/Confirm action on the work-approval flow (AM and RSM), matching the Reject flow's existing note box — previously Approve/Confirm sent a hardcoded placeholder note with no way to type a real one.

### PDF report actions
- Generate, Regenerate, and Download are now three distinct, always-visible actions (File-Plus-Corner / Refresh / File-Check icons) instead of a single button hiding a popup menu. Regenerate requires typing "REGENERATE" to confirm before it discards the existing PDF.

### UI fixes
- Reverted the Oil Level / Coolant Level fields on the Commissioning form back to their original full-width stacked layout (they had briefly become a cramped two-column row).
- The app version shown below Logout on the Profile screen is now a clearly readable pill instead of faint grey text.

### Infrastructure
- Patched a known `expo-router` dev-mode warning ("Can't perform a React state update on a component that hasn't mounted yet") via `patch-package`, so it no longer reappears after `npm install`.
