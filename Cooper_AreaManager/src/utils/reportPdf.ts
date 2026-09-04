import { File, Paths } from 'expo-file-system';
import { Linking } from 'react-native';
import { getToken } from './tokenStore';
import { generateReportPdf } from '../viewModel/commisionAPi';
import { API_URL } from '../constants/StringConstants';

// Downloads a Service/Commissioning report PDF to a local file and, by
// default, hands it off to the OS's own PDF viewer via Linking.openURL —
// the same end result as expo-sharing's shareAsync, without adding a new
// native dependency this app doesn't already have. Shared by
// srDetailController.ts, taskReportController.ts, and
// srTaskReportController.ts so the same three-step fallback isn't
// duplicated three times.
//
// Per the PDF implementation guide's own recommended flow + error table:
//  1. POST /:id/pdf (cache-or-generate) → a short-lived signed pdfUrl →
//     download THAT (no Authorization header needed, it's pre-signed).
//     This is the guide's preferred path — simpler and more reliable than
//     streaming an authenticated response through fetch/blob in RN.
//  2. POST fails, or returns pdfUrl: null (GCS not configured on this
//     backend — rare, dev-only) → fall back to GET /:id/pdf, which streams
//     the raw bytes directly (needs the auth header, since that endpoint
//     isn't pre-signed).
//  3. GET also fails → last resort: fallbackPdfUrl (the raw GCS link the
//     entry itself already carries, e.g. task.pdfUrl) opened directly.
//     Only works if that link happens to still be a live signed URL — the
//     bucket rejects unsigned reads otherwise (confirmed live on both
//     entity types), so this is a last resort, not the primary path.
//
// openAfterDownload — Generate (the very first tap, before any PDF exists
// yet) uses this same function but with this set to false: it still needs
// to actually fetch the file (so the backend genuinely creates/caches it,
// and so the local copy is warm for the next real Download tap), it just
// shouldn't force the OS's PDF viewer open on the user's behalf — the
// caller shows a "PDF generated — you can download it now" toast instead.
// Preview/Download (once ready) call this with the default true.
export async function downloadReportPdf(
  entityType: 'service' | 'commissioning',
  entryId: string,
  fallbackPdfUrl?: string | null,
  // Regenerate — bypasses the server's cache and always rebuilds the PDF.
  // Same POST call as the default "reuse cache if present" path, just with
  // ?force=true, per the guide's own §4c.
  force = false,
  openAfterDownload = true,
): Promise<void> {
  const token = await getToken();
  if (!token) throw new Error('Not signed in.');

  // idempotent: true — re-downloading the same entry's report overwrites
  // the previous local copy instead of throwing DestinationAlreadyExists.
  const destination = new File(Paths.cache, `${entityType}-report-${entryId}.pdf`);

  try {
    const signedUrl = await generateReportPdf(token, entityType, entryId, force);
    if (signedUrl) {
      const file = await File.downloadFileAsync(signedUrl, destination, { idempotent: true });
      if (openAfterDownload) await Linking.openURL(file.uri);
      return;
    }
  } catch {
    // Falls through to the GET stream below — this first attempt is a
    // convenience path, not the only way to get the PDF.
  }

  try {
    await downloadViaGetStream(entityType, entryId, token, destination, openAfterDownload);
  } catch (streamError) {
    // Nothing sensible to open on a bare "just generate it" call if the
    // real fetch above failed — that IS the failure, surface it as one
    // rather than silently opening a possibly-stale fallback link.
    if (!openAfterDownload || !fallbackPdfUrl) throw streamError;
    await Linking.openURL(fallbackPdfUrl);
  }
}

async function downloadViaGetStream(
  entityType: 'service' | 'commissioning',
  entryId: string,
  token: string,
  destination: File,
  openAfterDownload = true,
): Promise<void> {
  const sourceUrl = `${API_URL}/api/${entityType}/${entryId}/pdf`;
  const file = await File.downloadFileAsync(
    sourceUrl,
    destination,
    { headers: { Authorization: `Bearer ${token}` }, idempotent: true }
  );
  if (openAfterDownload) await Linking.openURL(file.uri);
}

// Regenerate — confirmed live (Postman) that POST /:id/pdf?force=true 404s
// on this backend; the generate-and-cache route the guide describes isn't
// actually deployed. GET, unlike POST, has no way to force a rebuild — it
// only ever serves the cached copy if one exists, generating fresh only on
// a genuine cache miss — so "Regenerate" can't truly force anything right
// now. Rather than call the broken POST route and guarantee a 404 on every
// tap, this just re-runs the same GET call Download/Preview already use:
// fetch (cached-or-fresh) bytes, save locally, optionally hand off to the
// OS. Swap this back to the force-POST attempt once that backend route is
// real. openAfterDownload — same meaning as downloadReportPdf's own: the
// Regenerate button passes false and shows a toast instead of forcing the
// viewer open.
export async function regenerateReportPdf(
  entityType: 'service' | 'commissioning',
  entryId: string,
  openAfterDownload = true,
): Promise<void> {
  const token = await getToken();
  if (!token) throw new Error('Not signed in.');
  const destination = new File(Paths.cache, `${entityType}-report-${entryId}.pdf`);
  await downloadViaGetStream(entityType, entryId, token, destination, openAfterDownload);
}
