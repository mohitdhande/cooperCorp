# Changelog

All notable changes to the Cooper_AreaManager app are recorded here, newest first.

## v0.0.3 — 2026-09-09

### Work Approval / Parts Approval
- AM-self-assigned tasks now correctly show the AM step as **"Skipped"** instead of a misleading "Approved" — both on the Approval Request card (`srDetail.tsx`) and on the shared task-preview card used by the Dashboard and task lists (`TaskPreviewCard.tsx`), which had the identical bug.
- The Parts badge now reads **"RSM Review Needed"** when that's the real required tier, instead of always assuming AM — it was hardcoded before.
- Approve/Reject buttons on the Parts section are now gated to whichever tier (AM or RSM) actually needs to review — previously any Area Manager saw live buttons even on their own self-assigned task, where only RSM/admin should be able to act.
- **Reject** and **Approve** buttons on the Approval Request card are now equal width (Approve was deliberately wider before).
- View Report (both Commissioning and Service) now shows each part's Approved/Rejected/Pending status and its rejection reason, matching what `srDetail.tsx` already displayed — previously View Report showed nothing at all here.

### Task list accuracy (Area Manager)
- Fixed a real, confirmed bug: Service tasks that are `COMPLETED` but not yet customer-OTP-verified were being bucketed under the **Active** tab instead of **Completed**, because of a hardcoded local rule that had already gone stale once before. The app now trusts the server's own `statusGroup` field on every task instead of guessing.
- The same task can legitimately appear twice in the raw `/me/team` response — now deduplicated by `_id` before counting or displaying, for both Commissioning and Service.
- Service's Assign/Reassign button now correctly hides once a task reaches `COMPLETED` (there's no more field work to hand off at that point) — it was staying visible until the customer's OTP was verified, well past the point reassignment made sense.

### Commissioning Complete flow
- Reconfirmed via live testing that saving the customer remark (`PUT /commissioning/:id/feedback`) closes the task as a side effect on the backend — unlike Service, where Save and Close are genuinely two independent calls. The button is correctly labeled **"Save & Close"** to reflect this, and the separate "Task Closed" confirmation that briefly existed was removed since it no longer applied once this was reconfirmed.
- The customer remark field on Step 3 of the OTP sheet (both Commissioning and Service) is now a single-line input instead of a 4-line text area.
- Added a 5-star customer rating picker above the remark field on Step 3, for all 5 task types (Pre-Commissioning, Commissioning, Re-Commissioning, Revalidation, and Service).
- The backend added a real `PUT /service/:id/feedback` endpoint this session, mirroring Commissioning's own — Service's Step 3 "Save" now calls it directly (same as Commissioning already did), instead of the earlier AsyncStorage-hold-until-Close-Ticket workaround that existed only because no such endpoint used to exist. Close Ticket (`PUT /service/:id/close`) no longer bundles a customer remark/rating of its own — the remark/rating are already saved by the time Close Ticket is tappable.
- Commissioning's View Report now shows the customer's star rating too (confirmed against a real closed task's `customerFeedback: { rating, comment }`), not just the remark — same "Voice of Customer" star-row + label layout Service's own View Report already had.
- View Report (both Commissioning and Service) now has its own standalone "Selfie with Genset" section showing the uploaded selfie — pulled out of the general media[] array by its `Selfie` tag, same pattern the existing Running Hours photo section already uses, so it no longer just blends into the plain Photos grid.
- Removed the extra "Voice of Customer" label from Commissioning's View Report — that section now just shows "Customer Remark" directly (with the rating below it), instead of "Voice of Customer" as its own separate heading above "Customer Remark".
- Service's View Report now orders its bottom card as "Voice of Customer" / "Suggestion Comments" / "Customer Remark" + rating, per explicit request — the first card's heading was relabeled from "Notes" to "Voice of Customer" (it still shows the same underlying job note set at task creation; this was a display-label change only), and the redundant second "Voice of Customer" heading further down (above Customer Remark) was removed since the label now only appears once, at the top.
- Replaced the OTP sheet's hand-computed keyboard-avoidance math (a manually tracked keyboard height feeding into padding/max-height calculations, which could drift out of sync and leave a large gap between the content and the keyboard) with `KeyboardAvoidingView`, React Native's own built-in mechanism, on both Commissioning and Service's OTP/Customer Remark sheets — the remark field and Save button now stay pinned directly above the keyboard. Switched its `behavior` to `"padding"` on both platforms (not just iOS) after `"height"` on Android still left the sheet's own bottom button (Verify OTP/Save) extending slightly behind the keyboard on some devices. (A follow-up attempt to also give the sheet a fixed minimum height left Step 1 — which has almost no content and no keyboard open — looking like an awkward mostly-empty box, so that part was reverted; the sheet goes back to sizing itself to whatever each step actually needs.)
- Fixed the selfie thumbnail not showing on the form after upload (only the other Photos/Videos updated live) — found the actual cause: the whole thumbnail (image + retake bar) was wrapped in one `TouchableOpacity`, unlike every other working thumbnail in this app, which uses a plain `View` with any tappable bits as separate small overlays. `TouchableOpacity` renders through an internal `Animated.View`, and combined with `overflow: hidden` and several absolutely-positioned children, its own contents weren't reliably showing up. Restructured to match the proven pattern — plain `View` around the image, with "Retake" as its own small tappable bar at the bottom — plus a loading spinner and a few automatic retries for the separate, genuine front-camera file-still-writing race. Also gave the `SelfieCard` element its own `key` (the photo's uri), so it fully remounts the moment a selfie is captured or retaken, instead of updating an existing instance in place.

### Mandatory selfie (all 5 task types)
- Added a new, required Selfie section above the Suggestion Comment field — Step 6 for Pre-Commissioning/Commissioning/Re-Commissioning/Revalidation, Step 5 for Service. Front-camera-only (no gallery pick), single photo — tapping it again retakes/replaces it. Complete Task (and Service's Send For Approval, for both the engineer and Area Manager paths) now hard-blocks with a clear alert until a selfie has been taken; no selfie means no completion. Uploads through the exact same media API as every other photo/video (no separate endpoint), tagged `Selfie` by default so it's excluded from the regular Photos & Video grid, and captures GPS location the same way every other upload already does. Shows an on-screen-only "Note: Selfie with Genset" caption under the card (not sent to the backend — the media API has no note/caption field).

### Keyboard handling
- Swept every Modal in the app for text inputs with no keyboard-avoidance handling. Fixed the three bottom-sheet modals on `srDetail.tsx` (Edit & Resubmit, Reject, Approve) and the PDF "type REGENERATE to confirm" popup — all had none at all, so typing could push the confirm button behind the keyboard.

### Media & tagging
- Long tag labels ("Power Cable Connection", "AMC CAMC part Requirement format") no longer get cut off with "…" on video/PDF rows — the tag chip now wraps its own text instead, and always stays on the same line as the location pin instead of pushing it below.

### Forms & validation
- Create Asset screen: "Genset S/N"/"Engine S/N" renamed to **Genset SR Number**/**Engine SR Number**, both now force uppercase as you type; Primary/Alternate Contact No. now require exactly 10 digits and strip anything else on input.
- Step 1 dropdown options (Engine Type, Engine Family, Fuel Type, Application, Phase) are now upper case, matching the text fields already on that step.
- Reverted Service's own Oil Level/Coolant Level fields back to full-width stacked rows (same fix Commissioning got in v0.0.2, which Service still needed).
- Closed the visual gap between the Running Hours input and its green save button (Commissioning and Service).

### Forgot Password (new)
- Built the full self-service Forgot Password flow, previously just a "contact your admin" alert on the login screen. New two-step screen (`screens/forgotPassword`): Step 1 (email/mobile → `POST /auth/forgot-password`) matches the provided reference design (circular Cooper Corp logo, light card, indigo "Send OTP" button); Step 2 (6-digit code + new password + confirm → `POST /auth/reset-password`) has no reference design of its own, so it was built in the same visual language as Step 1. Step 1 always proceeds to Step 2 on success regardless of whether the account exists, per the backend's own intentionally generic response — nothing else to branch the UI on. A wrong/expired OTP (`OTP_INVALID`) and validation errors both surface inline; a "Resend code" link re-requests a fresh OTP (invalidating the previous one, per the documented contract).

### Change Password (self-service)
- Profile's "Change Password" row previously just showed a "contact your admin" alert — it's now a real popup (Current Password / New Password / Confirm New Password, a "Show passwords" toggle, and an Update Password button), calling the real self-service `PUT /api/auth/change-password` endpoint (distinct from the existing admin-resets-someone-else's-password call, which needs no current password and was never wired to this button in the first place). Validates a matching confirmation and a 6+ character new password client-side before submitting; server-side errors (wrong current password, reused password, etc.) surface inline. No extra "password changed" toast on success — the backend already sends its own email + in-app confirmation for this.

### Push notifications
- `registerPushToken()` existed since before this session but was never actually called anywhere — wired it in for real: fires after a successful login, and on every app foreground/mount while a session exists (`_layout.tsx`, alongside the existing offline-sync retry). Also wired `unregisterPushToken()` into Logout, before the session is revoked, matching its own documented intent. Both are best-effort and silently no-op on failure, so neither can block login/logout.

### Infrastructure
- Improved the `expo-router` dev-mode-warning patch from v0.0.2: the original fix just delayed the update by one tick, which wasn't always enough on a fast reload. It now properly tracks whether the screen has actually mounted and only fires once it has, regardless of how long that takes.

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
