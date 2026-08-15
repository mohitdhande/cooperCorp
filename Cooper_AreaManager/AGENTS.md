# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Project architecture — read this before touching role-related code

This folder is the **single merged app** for three real user roles — `engineer`, `dealer`, `areaManager` (plus a mostly-unused `admin`) — who each log into the *same* app build and see a different view based on their role. It used to be three separate apps (`Cooper`, `Cooper_Dealer`, `Cooper_AreaManager`); they were merged into this one on 2026-07-21. The sibling `Cooper/` and `Cooper_Dealer/` folders still exist in this workspace but are **stale reference copies only** — do not port work back from them, and do not assume they reflect current behavior.

**Single source of truth for what a role can do:** `src/constants/permissions.ts`. Every screen that needs to know "can this user create a commissioning entry / see My Team / fill in the task form" reads from `getPermissions(role)` — never hand-roll a `role === 'dealer'` check elsewhere. If you're adding a new capability that differs by role, add a field to `RolePermissions` there first.

**Role string matching is defensive on purpose.** The three original apps never needed to check their own role client-side (each app assumed a single role), so the exact wire-format strings the backend sends were never verified end-to-end. `getPermissions()` normalizes case/spacing/underscores before matching — if you add a new role, add it to `ROLE_ALIASES` too, and don't assume the backend's string is already camelCase.

**Known role-based behavior differences** (as of this merge):
- `dealer` can Accept a task but never Start/Continue into the form (`canFillTaskForm: false`) — form-filling is engineer/area-manager work.
- `dealer` and `areaManager` can create commissioning/service entries and assign them to their subordinates (`subordinateRole`: dealer→engineer, areaManager→dealer).
- Only `areaManager` has the Team Overview rollup tab; both `dealer` and `areaManager` have a My Team roster (of different subordinate roles) and Dashboard/Records access.
- The profile screen was **redesigned on 2026-07-28** to add a **TEAM** section below the Full Name/Email/Mobile/Address card — this reverses the earlier "identical for every role" rule below. Everything on the screen (name/role/email/mobile/address/team/the AM's `areaNames`) comes from one call, `GET /api/me/profile` (`myProfile` in `profileController.ts` — see `src/models/profile.types.ts` for the confirmed response shape), not from `permissions.ts` or the separate `getDealers`/`getEngineers` roster calls. The team list is **role-dependent on the backend's own terms**, not re-derived from `subordinateRole`: engineer gets peer engineers, dealer gets their engineers, areaManager gets their dealers, rsm/admin get `[]` — the section just hides itself when that array is empty. Change Password + Logout stay identical for every role. The JWT-decoded `profile` cached at login is only an instant-render fallback before `myProfile` arrives, plus the source of `userId` for photo upload/remove.

**Commissioning task lifecycle** (`ASSIGNED` → `ACCEPTED` → `IN_PROGRESS` → form steps 1-6 → `COMPLETED` at step 6's "Complete" action → OTP generated/verified at step 8, independently of completion). The step-6 "Complete" call and the step-8 OTP verify are two separate, sequential backend calls — do not call `completeCommissioningTask` a second time at step 8, the backend rejects completing an already-completed entry. The SR (service) flow does **not** have this split — it still completes and verifies together in one step, unchanged from the original design.

**Crash safety pattern:** nav params that were `JSON.stringify`'d by another screen (`task`, `member`) should be parsed with `src/utils/safeJsonParse.ts`, not a bare `JSON.parse`. There is exactly one `ErrorBoundary` for the whole app (in `_layout.tsx`) — if it triggers, "Back to My Tasks" resets the navigation stack rather than re-rendering the screen that crashed, so don't rely on it as a per-screen safety net; guard risky parsing/array access at the source instead.
