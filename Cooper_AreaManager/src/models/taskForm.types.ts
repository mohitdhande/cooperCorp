// ─── Media (unified media[] model, Sep 2026 backend migration) ───
// Mirrors the backend's MediaItem shape exactly (mobile-commissioning
// developer guide §9.2) — 'photo' is camera-captured, 'image' is picked
// from the gallery/file picker, distinct types even though both render as
// a plain photo thumbnail. Commissioning and Service both migrated to this
// (Service's own endpoints are unconfirmed — see commisionAPi.ts's own
// comments on the Service media functions).
export type MediaType = 'photo' | 'image' | 'video' | 'pdf';
export type MediaLocation = { lat?: number; lng?: number; address?: string };
// Camera vs. gallery/file-picker — determines the outgoing MediaType for an
// image-kind item ('photo' for camera, 'image' for gallery), per the
// backend's own convention. Videos and PDFs are always their own fixed
// type regardless of source.
export type MediaSource = 'camera' | 'gallery';

// The confirmed MediaType to send for a picked item — the only place
// `kind` (internal upload routing: which uploader function to call —
// see useMediaUploadQueue.ts's QueueItemKind) and `source` combine into
// the actual backend-facing type. Lives here (not in useMediaUploadQueue.ts
// itself) so mediaSyncEngine.ts can use it too without an import cycle —
// useMediaUploadQueue.ts already imports from mediaSyncEngine.ts
// (subscribeToMediaSyncSuccess).
export function resolveMediaType(kind: 'photo' | 'video' | 'pdf', source: MediaSource): MediaType {
  if (kind === 'video') return 'video';
  if (kind === 'pdf') return 'pdf';
  return source === 'camera' ? 'photo' : 'image';
}

// ─── Site Photos ───
export type SitePhoto = {
  id: string;
  uri: string;
  fileName: string;
  // Absent/'image' for existing photo items (kept optional so every
  // pre-video call site that builds a SitePhoto without this field still
  // type-checks). 'video' items upload separately via their own GCS
  // flow (uploadServiceVideos) — filtered out of the photo-only multipart
  // call (see handleSaveAllPhotos in both forms). 'pdf' items (SR form
  // only) deliberately ride that same GCS flow as 'video' — no dedicated
  // document endpoint exists, so PDFs travel through the same
  // sign-upload-confirm mechanism and land in task.videos, distinguishable
  // there only by their .pdf extension (see srTaskReportController.ts /
  // srDetailController.ts, which split them back out into their own
  // Documents section).
  mediaType?: 'image' | 'video' | 'pdf';
  // Bytes, from ImagePicker's own asset.fileSize when the platform provides
  // it — shown as "1.9 MB" on the Video card's list row. Optional since not
  // every platform/picker path returns it.
  fileSize?: number;
  // The real backend media key (distinct from `uri`, which may be a signed
  // display URL for a private-bucket thumbnail) — required for tagging
  // (PATCH .../media matches by gcsUrl) and set as soon as an upload
  // confirms, or immediately for anything hydrated from a previously-saved
  // task (whose `id` is already the gcsUrl itself).
  gcsUrl?: string;
  // The precise MediaType this item confirmed as — 'photo' vs 'image' isn't
  // recoverable from mediaType alone (both are 'image' there), so this is
  // the source of truth once populated.
  type?: MediaType;
  // 0 or 1 tag, picked from MediaTagPicker's fixed per-type list.
  tags?: string[];
  // GPS + reverse-geocoded address captured at upload time (one reading
  // per upload batch — see resolveUploadLocation in locationLogger.ts),
  // shown via MediaLocationButton's own popup. Undefined for anything
  // uploaded before this existed, or if GPS/permission wasn't available at
  // capture time.
  location?: MediaLocation;
};

// ─── Complaint Codes ───
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

// API-sourced fault code (from /api/fault-codes)
export type ApiFaultCode = {
  _id: string;
  code: string;
  description: string;
  category: string;
  subCategory: string;
  priority: Priority;
};

export type SelectedComplaintCode = {
  uid: string;
  codeId: string; // the _id from /api/fault-codes
  categoryName: string;
  subcategoryName: string;
  code: string;
  priority: Priority;
  title: string;
  observation: string;
  rootCause: string;
  correctiveAction?: string; // SR (service) tasks only
  // True only for codes picked in this session (handleSelectComplaintCode) —
  // false/omitted for codes loaded from a previously-saved task on mount
  // (srTaskForm's resume-in-progress path). Drives ComplaintCodeCard's
  // initial open/collapsed state: a freshly-added code starts open for
  // filling in, an already-saved one starts collapsed to its summary.
  isNew?: boolean;
};

// ─── Parts ───
// API-sourced part (from /api/parts)
// Part schema fully replaced 2026-08-29 — code/name/unit/category/subCategory
// no longer exist anywhere in the API. componentNumber/description are the
// direct replacements for code/name; unit/category/subCategory have no
// replacement at all. engineFamily/cpcbNorm/maxQty are new.
export type ApiPart = {
  _id: string;
  componentNumber: string;
  description: string;
  engineFamily?: string[];
  cpcbNorm?: 'CPCB II' | 'CPCB IV+';
  maxQty?: number;
};

export type SelectedPart = {
  partId: string; // the _id from /api/parts
  componentNumber: string;
  description: string;
  engineFamily?: string[];
  cpcbNorm?: 'CPCB II' | 'CPCB IV+';
  maxQty?: number;
  quantity: number;
};
