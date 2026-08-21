// Shared by every camera/gallery photo/video picker across the task forms
// (commissioning + SR) — format is checked immediately at pick time (a
// PDF-shaped item, wrong extension, etc. is never worth queuing). Size is
// deliberately NOT checked here anymore — it's checked per-item, right
// before that item's own turn to upload (see validateItemSize below and
// useMediaUploadQueue.ts), so a batch of several files uploads whatever it
// can one by one instead of the whole pick being blocked/filtered upfront
// just because one of several files is oversized.
export const MAX_PHOTO_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg'];
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg'];

export const MAX_VIDEO_SIZE_BYTES = 300 * 1024 * 1024; // 300 MB
const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'mov'];
const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime'];

// PDFs share the photos upload call (no dedicated document endpoint), but
// get their own cap — a scanned multi-page document is routinely bigger
// than a single compressed photo.
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// expo-document-picker's result shape, not ImagePicker's — kept separate
// from PickedAsset/getPhotoValidationError above since document results
// carry `name`/`size`/`mimeType`, not `fileSize`/`type`.
export function getPdfValidationError(asset: { name?: string; size?: number; mimeType?: string | null }): string | null {
  const mime = asset.mimeType?.toLowerCase();
  const ext = asset.name?.split('.').pop()?.toLowerCase();
  const formatOk = mime ? mime === 'application/pdf' : ext === 'pdf';
  if (!formatOk) return 'Only PDF files are allowed.';
  return null;
}

type PickedAsset = { uri: string; fileSize?: number; mimeType?: string; type?: string | null };

// Returns null when the asset passes, or a user-facing reason when it
// doesn't. Falls back to checking the URI's extension when the picker
// doesn't report a mimeType (some Android gallery providers omit it).
// Branches on the picker's `type` field ('image' | 'video') since a mixed
// mediaTypes: ['images', 'videos'] result can return either.
export function getPhotoValidationError(asset: PickedAsset): string | null {
  const mime = asset.mimeType?.toLowerCase();
  const ext = asset.uri.split('.').pop()?.split('?')[0]?.toLowerCase();

  if (asset.type === 'video') {
    const formatOk = mime ? ALLOWED_VIDEO_MIME_TYPES.includes(mime) : !!ext && ALLOWED_VIDEO_EXTENSIONS.includes(ext);
    if (!formatOk) return 'Only MP4 and MOV videos are allowed.';
    return null;
  }

  const formatOk = mime ? ALLOWED_MIME_TYPES.includes(mime) : !!ext && ALLOWED_EXTENSIONS.includes(ext);
  if (!formatOk) return 'Only PNG and JPEG photos are allowed.';
  return null;
}

// Checked right before each item's own turn to upload (see
// useMediaUploadQueue.ts's startBatch loop) — not at pick time. Returns
// null when the size is fine (or unknown — some pickers/platforms don't
// always report fileSize, in which case there's nothing to check against).
export function validateItemSize(kind: 'photo' | 'video' | 'pdf', fileSize?: number): string | null {
  if (typeof fileSize !== 'number') return null;
  const limit = kind === 'photo' ? MAX_PHOTO_SIZE_BYTES : kind === 'video' ? MAX_VIDEO_SIZE_BYTES : MAX_PDF_SIZE_BYTES;
  if (fileSize <= limit) return null;
  const limitMb = Math.round(limit / (1024 * 1024));
  const kindLabel = kind === 'photo' ? 'Photos' : kind === 'video' ? 'Videos' : 'PDFs';
  return `${kindLabel} must be ${limitMb} MB or smaller.`;
}

// Splits a multi-select gallery result into accepted assets + a summary of
// what got skipped and why — one combined Alert instead of one per item.
export function partitionValidPhotos<T extends PickedAsset>(assets: T[]): { valid: T[]; skippedMessage: string | null } {
  const valid: T[] = [];
  const reasons = new Set<string>();
  for (const asset of assets) {
    const error = getPhotoValidationError(asset);
    if (error) {
      reasons.add(error);
    } else {
      valid.push(asset);
    }
  }
  const skippedCount = assets.length - valid.length;
  const skippedMessage = skippedCount === 0
    ? null
    : `${skippedCount} item${skippedCount > 1 ? 's were' : ' was'} skipped: ${Array.from(reasons).join(' ')}`;
  return { valid, skippedMessage };
}
