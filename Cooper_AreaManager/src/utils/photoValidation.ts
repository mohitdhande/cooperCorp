// Shared by every camera/gallery photo/video picker across the task forms
// (commissioning + SR) — enforced client-side before an item ever gets
// added to the form's local state, so an oversized/unsupported file is
// caught immediately instead of failing later at upload time.
export const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg'];
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg'];

// No size cap on videos — only format is validated (per explicit
// instruction not to restrict video size at all).
const ALLOWED_VIDEO_EXTENSIONS = ['mp4', 'mov'];
const ALLOWED_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime'];

// PDFs share the photos upload call (no dedicated document endpoint), but
// get their own, more generous cap — a scanned multi-page document is
// routinely bigger than a single compressed photo.
export const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// expo-document-picker's result shape, not ImagePicker's — kept separate
// from PickedAsset/getPhotoValidationError above since document results
// carry `name`/`size`/`mimeType`, not `fileSize`/`type`.
export function getPdfValidationError(asset: { name?: string; size?: number; mimeType?: string | null }): string | null {
  const mime = asset.mimeType?.toLowerCase();
  const ext = asset.name?.split('.').pop()?.toLowerCase();
  const formatOk = mime ? mime === 'application/pdf' : ext === 'pdf';
  if (!formatOk) return 'Only PDF files are allowed.';
  if (typeof asset.size === 'number' && asset.size > MAX_PDF_SIZE_BYTES) {
    return 'PDFs must be 10 MB or smaller.';
  }
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
  if (typeof asset.fileSize === 'number' && asset.fileSize > MAX_PHOTO_SIZE_BYTES) {
    return 'Photos must be 5 MB or smaller.';
  }
  return null;
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
