# Offline Support — Simple Guide

## What works offline

- **Login** — if you already logged in once, reopening the app doesn't need internet at all.
- **Dashboard** — shows your last-seen tasks/counts.
- **Commissioning & Service lists** — shows the last-seen list.
- **Task detail / report screens** — shows the last-seen full task details.
- **Filling the Commissioning/Service form (engineer only)** — your saves get stored on the phone and sent later.

**Never offline (always needs internet):** OTP generate/verify, Complete, Approve, Close Ticket, work-approval decisions. These change the task's status in ways that aren't safe to "save for later" — so they just show a normal error if there's no internet.

---

## The two mechanisms, in plain words

**1. Viewing data** — every successful load takes a "photo" of the data and saves it. Next time, if the internet call fails, you see that last photo instead of an error screen.

**2. Saving data (forms)** — if Save fails because there's no internet, the save gets put in a waiting list on the phone instead of failing. The app automatically retries that waiting list (on open, on foreground, every 20 seconds) until it succeeds.

---

## FULL CYCLE #1 — Saving something while offline

Example: engineer taps "Save" on Group A checks in the Commissioning form.

```
 1. User taps Save
        │
        ▼
 2. handleSaveGroupA()                         [useTaskForm.ts]
        │  (builds the payload for just this group)
        ▼
 3. saveGroupChecks(groupKey, payload)         [useTaskForm.ts]
        │
        ▼
 4. putOrQueue(url, body, description,
        dedupeKey, isEngineer)                 [syncEngine.ts]
        │
        │  tries the real save first:
        │  axiosClient.put(url, body)
        │
   ┌────┴─────────────────────┐
   │                           │
 IT WORKS                 NO INTERNET
   │                     (isNetworkError = true
   │                      AND isEngineer = true)
   │                           │
   │                           ▼
   │                   5. enqueueAction({...})  [offlineQueue.ts]
   │                           │
   │                           ▼
   │                   6. AsyncStorage.setItem(
   │                        'cc_offline_queue',
   │                        [...existing, newAction])
   │                           │
   │                           ▼
   │                   7. notifyListeners()      [syncEngine.ts]
   │                           │
   │                           ▼
   │                   8. PendingSyncBanner shows:
   │                      "1 change saved on this
   │                       device — will sync later"
   ▼                           ▼
"Saved successfully!"    "Saved on this device —
                           will sync later"
```

**Later, when internet comes back:**

```
 1. Trigger fires — app opens, comes to
    foreground, or every 20s while open       [_layout.tsx]
        │
        ▼
 2. runSync()                                  [syncEngine.ts]
        │
        ▼
 3. getQueue()                                 [offlineQueue.ts]
        │  AsyncStorage.getItem('cc_offline_queue')
        ▼
 4. For each waiting save, replay it:
        axiosClient.put(action.url, action.body)
        │
   ┌────┴──────────────────┬─────────────────────┐
   │                        │                     │
 SUCCESS              STILL NO INTERNET      SERVER SAYS NO
   │                  (stop here, try            (real error,
   ▼                   again next trigger)         not a network
 removeFromQueue()                                  problem)
   │                                                   │
   ▼                                                   ▼
 synced + 1                                    recordSyncFailure()
                                                        │
                                                        ▼
                                                 removeFromQueue()
                                                        │
                                                        ▼
                                                    failed + 1
        │
        ▼
 5. PendingSyncBanner updates — yellow count
    goes down, or a red "failed to sync" banner
    appears for anything the server rejected
```

---

## FULL CYCLE #2 — Viewing a screen while offline

Example: opening the Dashboard.

```
 1. Screen opens → fetchSummary()              [dashboardHomeController.ts]
        │
        ▼
 2. Tries: axios GET /me/dashboard
        │
   ┌────┴─────────────────┐
   │                       │
 IT WORKS               NO INTERNET
   │                       │
   ▼                       ▼
 3a. cacheData(          3b. isNetworkError? → yes
     'dashboard_summary',      │
      data)                    ▼
   │  AsyncStorage.setItem  getCachedData('dashboard_summary')
   │  ('cc_cache_...', data)   │
   ▼                          AsyncStorage.getItem('cc_cache_...')
 Show fresh data                │
                                 ▼
                          Show last-saved data
                          (no error shown)
```

Same shape everywhere else — Commissioning/Service lists, and the task
detail/report screens (`srDetail`, `taskReport`, `srTaskReport`) just swap
the cache key and the fetch function.

---

## Which files have the code, and their key methods

### Core offline engine

| File | Method | What it does |
|---|---|---|
| `src/utils/offlineQueue.ts` | `enqueueAction()` | Adds/merges a failed save into the waiting list |
| | `getQueue()` / `getQueueCount()` | Reads the waiting list |
| | `removeFromQueue()` | Removes an item once synced (or dropped) |
| | `getPendingBody()` | Checks "do I already have an unsynced edit for this?" — used when loading a screen so it doesn't overwrite your not-yet-synced changes |
| | `recordSyncFailure()` / `getSyncFailures()` / `clearSyncFailures()` | Tracks saves the server actually rejected (not just offline) |
| `src/utils/offlineCache.ts` | `cacheData()` | Saves a "last-seen" copy of any screen's data |
| | `getCachedData()` | Reads that last-seen copy back |
| `src/utils/syncEngine.ts` | `isNetworkError()` | Decides "was this a real error, or just no internet?" |
| | `putOrQueue()` | The one function every form-save uses — tries to save, queues it if offline |
| | `runSync()` | Goes through the waiting list and tries to send everything |
| | `subscribeToSyncQueue()` / `subscribeToSyncFailures()` | Lets the banner know live when counts change |
| `src/app/_layout.tsx` | (inline, no name) | Calls `runSync()` on app open, on foreground, and every 20 seconds |
| `src/_components/shared/PendingSyncBanner.tsx` | `PendingSyncBanner` | The yellow/red banner component itself |

### Commissioning form — `src/controllers/taskForm/`

| File | Method | What it does |
|---|---|---|
| `useTaskForm.ts` | `loadAssetData()` | Loads the asset, overlays any unsynced edit on top |
| | `saveAssetSection()` | Saves Genset/Alternator sections (used by `handleSaveGensetIdentification`, `handleSaveAlternatorPanel`) |
| | `saveGroupChecks()` | Saves a checklist group (used by `handleSaveGroupA` … `handleSaveGroupE`) |
| | `handleSaveValidationChecks()` | Saves revalidation checks |
| | `handleSaveReadings()` | Saves genset meter readings |
| `useTaskFormOtp.ts` | `handleMarkComplete()` | Marks the task complete (this one save is offline-capable; OTP generate/verify below it are not) |

### Service form — `src/controllers/srTaskForm/useSrTaskForm.ts`

| Method | What it does |
|---|---|
| `loadPreviousData()` | Loads the asset/task, overlays any unsynced edit |
| `handleSaveAssetSection()` | Saves asset details |
| `handleSaveFaultCodes()` | Saves fault codes |
| `handleSavePartsUsed()` | Saves parts used |
| `handleSaveNotes()` | Saves the notes field |

*(`handleFinishService`, `handleSendForApproval`, OTP handlers, and `handleCloseTicket` are NOT offline — they always need a live connection.)*

### Viewing screens ("last-seen" fallback only, no saving)

| File | Method |
|---|---|
| `src/controllers/dashboardHomeController.ts` | `fetchSummary()` |
| `src/controllers/commissioningTasksController.ts` | `fetchPage()` |
| `src/controllers/serviceTasksController.ts` | `fetchPage()` |
| `src/controllers/srDetailController.ts` | `fetchDetail()` |
| `src/controllers/taskReportController.ts` | `fetchDetail()` |
| `src/controllers/srTaskReportController.ts` | `fetchDetail()` |
| `src/app/index.tsx` | `checkLoginStatus()` — decides where to route on launch, no internet needed |
