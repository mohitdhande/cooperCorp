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
