import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, AppState, AppStateStatus, Linking, TextInput } from 'react-native';
import { File, Paths } from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/tokenStore';
import { UserProfile } from '../models/Login';
import {
  getCommissioningTaskDetail, getAssetById, getGcsSignedUrl, getGcsSignedUrls, closeCommissioningTask,
  generateCommissioningOtp, verifyCommissioningOtp, saveCommissioningFeedback,
} from '../viewModel/commisionAPi';
import { getRole, Role } from '../constants/permissions';
import { parseApiError } from '../utils/apiError';
import { splitMediaByExtension } from '../utils/reportFormatters';
import { cacheData, getCachedData } from '../utils/offlineCache';
import { isNetworkError } from '../utils/syncEngine';
import { API_URL } from '../constants/StringConstants';

// Loads the full commissioning task detail + asset for the report screen.
// `initialTask` is the summary object handed over via navigation params —
// shown immediately while the fuller detail loads in the background.
export function useTaskReportController(initialTask: any) {
  const [detail, setDetail] = useState<any>(null);
  const [asset, setAsset] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // Gates the Approve/Close actions below — admin stands in for the
  // (non-existent in this app) rsm role, same pattern as srDetailController.
  const [role, setRole] = useState<Role>('engineer');
  // True the moment the live task-detail fetch fails from a genuine network
  // error (regardless of whether a cache existed to fall back to) — drives
  // disabling the Verify OTP button below, since OTP generate/verify are
  // inherently live-only actions (see commisionAPi.ts) that can't queue for
  // later the way every other save in this app now can.
  const [isOffline, setIsOffline] = useState(false);

  // Returns whether the task detail itself loaded — the asset fetch failing
  // on its own doesn't count as a failure here, since the report still has
  // everything it needs from initialTask/detail without the asset.
  //
  // Depends on the real task id, not [] — if this screen instance is ever
  // reused for a different task without a full unmount, the fetch needs to
  // rerun for the new id instead of leaving `detail` (and its status field)
  // stuck on whichever task was first fetched here.
  const fetchDetail = useCallback(async (): Promise<boolean> => {
    const token = await getToken();
    if (!token || !initialTask?._id) return true;

    // Task detail and asset are two independent fetches — each gets its own
    // try/catch so a failure (offline or otherwise) on one doesn't skip the
    // other's own cache-fallback logic. They used to share one try block,
    // which meant an offline task-detail fetch threw straight past the
    // asset fetch entirely: the task's own cached checks would still show,
    // but Genset Identification/Engine Parameters/Alternator & Panel (all
    // sourced from the asset, not the task) stayed blank even though a
    // perfectly good cached asset existed from an earlier online visit.
    let ok = true;
    let assetIdToFetch = initialTask.assetId;
    console.log('[Task Report] fetchDetail start — initialTask.assetId:', initialTask.assetId, 'taskId:', initialTask._id);

    try {
      const data = await getCommissioningTaskDetail(token, initialTask._id);
      setDetail(data);
      setIsOffline(false);
      // No user-scoping needed on the cache key — logout already clears all
      // of AsyncStorage, so a stale previous user's cached detail can never
      // leak into a fresh session (same rule as dashboard_summary's cache).
      await cacheData(`commissioning_detail_${initialTask._id}`, data);
      assetIdToFetch = data.assetId || initialTask.assetId;
      console.log('[Task Report] Task detail fetched live. assetId from data:', data.assetId);
    } catch (error: any) {
      console.log('[Task Report] Failed to load task detail:', error?.message, '| isNetworkError:', isNetworkError(error), '| has response:', !!error?.response, '| has request:', !!error?.request);
      // No signal at all — fall back to the fullest detail this device last
      // saw for this task instead of leaving the screen on just initialTask
      // (the list's sparse summary, missing checklist/fault-code/parts
      // detail). A real server error still reports failure normally, since
      // stale data can't fix that.
      if (isNetworkError(error)) {
        setIsOffline(true);
        const cached = await getCachedData(`commissioning_detail_${initialTask._id}`);
        console.log('[Task Report] Cached task detail found?', !!cached, '| cached assetId:', cached?.data?.assetId);
        if (cached) { setDetail(cached.data); assetIdToFetch = cached.data.assetId || initialTask.assetId; }
        else ok = false;
      } else {
        ok = false;
      }
    }

    console.log('[Task Report] Resolved assetIdToFetch:', assetIdToFetch);
    if (assetIdToFetch) {
      try {
        const assetData = await getAssetById(token, assetIdToFetch);
        setAsset(assetData);
        await cacheData(`asset_${assetIdToFetch}`, assetData);
        console.log('[Task Report] Asset fetched live.');
      } catch (assetErr: any) {
        console.log('[Task Report] Failed to load asset:', assetErr?.message, '| isNetworkError:', isNetworkError(assetErr));
        if (isNetworkError(assetErr)) {
          const cachedAsset = await getCachedData(`asset_${assetIdToFetch}`);
          console.log('[Task Report] Cached asset found?', !!cachedAsset);
          if (cachedAsset) setAsset(cachedAsset.data);
        }
      }
    } else {
      console.log('[Task Report] No assetIdToFetch resolved at all — asset fetch skipped entirely.');
    }

    return ok;
  }, [initialTask?._id, initialTask?.assetId]);

  const [detailError, setDetailError] = useState('');

  // Profile only — loaded once, no reason to re-read it every time this
  // screen regains focus (it doesn't change while the app is open).
  useEffect(() => {
    AsyncStorage.getItem('userData')
      .then((saved) => {
        if (saved) {
          const parsed = JSON.parse(saved);
          setProfile(parsed);
          setRole(getRole(parsed.role));
        }
      })
      .catch((error) => console.log('[Task Report] Failed to load profile:', error));
  }, []);

  // useFocusEffect (not a plain useEffect) — both the initial load and the
  // periodic re-check only run while this screen is actually the one on
  // screen. A plain useEffect would keep the AppState listener/interval
  // alive for as long as this controller stayed *mounted*, which in an
  // expo-router Stack is well past the point the user has navigated away
  // (previous screens stay mounted in the background) — silently polling
  // this task's detail every 20s from a screen nobody's looking at.
  // useFocusEffect's own cleanup (returned below) tears it down the moment
  // focus is lost, and the same setup runs again next time this screen
  // regains focus (also re-checking connectivity — see isOffline's own
  // comment above — so isOffline can't stay stale from before you
  // navigated away either).
  // `hasFetchedOnceRef` keeps the very first load's normal full-screen
  // spinner (the expected first-load experience) while every later
  // refocus fetches silently, matching what the periodic check already did.
  const appState = useRef(AppState.currentState);
  const hasFetchedOnceRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (!hasFetchedOnceRef.current) {
          setIsLoading(true);
          const ok = await fetchDetail();
          setDetailError(ok ? '' : 'Failed to load the latest task details.');
          setIsLoading(false);
          hasFetchedOnceRef.current = true;
        } else {
          fetchDetail();
        }
      })();

      const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
        if (appState.current.match(/inactive|background/) && nextState === 'active') {
          fetchDetail();
        }
        appState.current = nextState;
      });
      const interval = setInterval(() => {
        if (appState.current === 'active') fetchDetail();
      }, 20000);
      return () => {
        subscription.remove();
        clearInterval(interval);
      };
    }, [fetchDetail])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const ok = await fetchDetail();
    setDetailError(ok ? '' : 'Failed to load the latest task details.');
    setRefreshing(false);
    if (!ok) Alert.alert('Error', 'Failed to refresh this task. Please try again.');
  }, [fetchDetail]);

  const task = detail ? { ...initialTask, ...detail } : initialTask;

  // Commissioning has no separate videos/documents field — every media type
  // (photo/video/PDF) rides the one `photos` array (see the confirm-endpoint
  // note in commisionAPi.ts's uploadCommissioningVideos), so split it back
  // out by extension before rendering three separate sections.
  const allMediaUrls: string[] = task?.photos || [];
  const { photos, videos, documents } = splitMediaByExtension(allMediaUrls);

  // Photos are raw GCS URLs (private bucket) — batch-sign just the photo
  // subset in one /gcs/sign call, same pattern as the SR report/detail
  // controllers, keyed by the original raw url. Videos/documents are signed
  // on tap instead (below), not up front.
  const [signedPhotoUrls, setSignedPhotoUrls] = useState<Record<string, string>>({});
  const [photosSigning, setPhotosSigning] = useState(false);
  const photosKey = JSON.stringify(photos);

  useEffect(() => {
    if (photos.length === 0) { setSignedPhotoUrls({}); return; }
    let cancelled = false;
    (async () => {
      setPhotosSigning(true);
      try {
        const token = await getToken();
        if (!token) return;
        const signed = await getGcsSignedUrls(token, photos);
        if (!cancelled) setSignedPhotoUrls(signed);
      } catch (error) {
        console.log('[Task Report] Failed to sign photos:', error);
      } finally {
        if (!cancelled) setPhotosSigning(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photosKey]);

  // Video playback — signs the private GCS url on tap (never cached), same
  // pattern as srTaskReportController's handlePlayVideo.
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoError, setVideoError] = useState('');

  const handlePlayVideo = useCallback(async (gcsUrl: string) => {
    setVideoModalVisible(true);
    setVideoUri(null);
    setVideoError('');
    try {
      const token = await getToken();
      if (!token) return;
      const signedUrl = await getGcsSignedUrl(token, gcsUrl);
      if (!signedUrl) throw new Error('No signed URL returned');
      setVideoUri(signedUrl);
    } catch (error: any) {
      setVideoError(parseApiError(error, 'Failed to load this video. Please try again.').message);
    }
  }, []);

  const closeVideoModal = useCallback(() => {
    setVideoModalVisible(false);
    setVideoUri(null);
    setVideoError('');
  }, []);

  // No in-app PDF viewer — signs the private GCS url into a short-lived
  // readable link and hands it to the OS/browser's own PDF viewer, same
  // pattern as srTaskReportController's handleViewDocument.
  const [documentOpeningUrl, setDocumentOpeningUrl] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState('');

  const handleViewDocument = useCallback(async (gcsUrl: string) => {
    setDocumentOpeningUrl(gcsUrl);
    setDocumentError('');
    try {
      const token = await getToken();
      if (!token) return;
      const signedUrl = await getGcsSignedUrl(token, gcsUrl);
      if (!signedUrl) throw new Error('No signed URL returned');
      await Linking.openURL(signedUrl);
    } catch (error: any) {
      setDocumentError(parseApiError(error, 'Failed to open this document. Please try again.').message);
    } finally {
      setDocumentOpeningUrl(null);
    }
  }, []);

  // The full "Installation & Commissioning Report" PDF — GET /:id/pdf
  // streams the raw PDF bytes directly (confirmed: the response starts
  // with "%PDF-1.3..."), not a JSON url wrapper, so this can't go through
  // axiosClient (its default json/text parsing corrupts binary). Downloads
  // straight to a local file via expo-file-system instead, which handles
  // the raw bytes correctly, then hands that local file off to the OS.
  // This is the PRIMARY route, not task.pdfUrl (the raw GCS link the task
  // record also carries) — confirmed live that the GCS bucket rejects
  // anonymous/unsigned reads of that link with AccessDenied, so it only
  // works if our backend's service-account credentials fetch it, which is
  // exactly what this endpoint does server-side. task.pdfUrl is kept only
  // as a last-resort fallback in case this endpoint itself is unavailable.
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [downloadReportError, setDownloadReportError] = useState('');

  const handleDownloadReport = useCallback(async () => {
    if (!initialTask?._id) return;
    console.log('[PDF] Download requested for task', initialTask._id);
    setDownloadingReport(true);
    setDownloadReportError('');
    try {
      const token = await getToken();
      if (!token) {
        console.log('[PDF] No auth token available — aborting download');
        return;
      }
      // idempotent: true — re-downloading the same task's report overwrites
      // the previous local copy instead of throwing DestinationAlreadyExists.
      const destination = new File(Paths.cache, `commissioning-report-${initialTask._id}.pdf`);
      const sourceUrl = `${API_URL}/api/commissioning/${initialTask._id}/pdf`;
      console.log('[PDF] Downloading from', sourceUrl, 'to', destination.uri);
      try {
        const file = await File.downloadFileAsync(
          sourceUrl,
          destination,
          { headers: { Authorization: `Bearer ${token}` }, idempotent: true }
        );
        console.log('[PDF] Downloaded to local file:', file.uri);
        await Linking.openURL(file.uri);
        console.log('[PDF] Linking.openURL resolved for local file');
      } catch (primaryError: any) {
        console.log('[PDF] Backend download failed, falling back to task.pdfUrl:', primaryError?.response?.status || primaryError?.message || primaryError);
        if (!task?.pdfUrl) throw primaryError;
        console.log('[PDF] Using stored pdfUrl:', task.pdfUrl);
        await Linking.openURL(task.pdfUrl);
        console.log('[PDF] Linking.openURL resolved for pdfUrl');
      }
    } catch (error: any) {
      console.log('[PDF] Download failed:', error?.response?.status || error?.message || error);
      setDownloadReportError(parseApiError(error, 'Failed to download the report. Please try again.').message);
    } finally {
      setDownloadingReport(false);
    }
  }, [initialTask?._id, task?.pdfUrl]);

  // Client OTP verification — moved here from the task form (taskForm.tsx
  // used to handle this in-place on step 6; Complete now navigates
  // straight to this screen instead, so the OTP step lives here). Shown
  // whenever the task is COMPLETED but the customer's OTP isn't verified
  // yet — same condition TaskPreviewCard's own "OTP Pending" banner uses.
  const completionOtp = task?.completionOtp || null;
  const isOtpPending = task?.status === 'COMPLETED' && !completionOtp?.verified;

  // 3-step sheet: 1 Generate OTP -> 2 Customer Enters OTP -> 3 Customer
  // Remark (optional feedback, saved via PUT /:id/feedback — no status
  // restriction, so this still works once the entry is CLOSED).
  const [otpSheetOpen, setOtpSheetOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<1 | 2 | 3>(1);
  const [otpGenerated, setOtpGenerated] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string[]>(['', '', '', '']);
  const [customerOtp, setCustomerOtp] = useState<string[]>(['', '', '', '']);
  const otpInputRefs = useRef<Array<TextInput | null>>([null, null, null, null]);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [remark, setRemark] = useState('');
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [remarkError, setRemarkError] = useState('');

  // Fresh every time the sheet opens — no stale code/digits left over from
  // a previous open-close cycle.
  const openOtpSheet = useCallback(() => {
    setOtpSheetOpen(true);
    setOtpStep(1);
    setOtpGenerated(false);
    setGeneratedOtp(['', '', '', '']);
    setCustomerOtp(['', '', '', '']);
    setOtpError('');
    setRemark('');
    setRemarkError('');
  }, []);

  const closeOtpSheet = useCallback(() => setOtpSheetOpen(false), []);

  const handleGenerateOtp = useCallback(async () => {
    setOtpLoading(true);
    setOtpError('');
    try {
      const token = await getToken();
      if (!token || !initialTask?._id) return;

      const data = await generateCommissioningOtp(token, initialTask._id);
      const digits = String(data.code).split('');
      setGeneratedOtp(digits);
      setCustomerOtp(['', '', '', '']);
      setOtpGenerated(true);
      setOtpStep(2);
    } catch (error: any) {
      setOtpError(parseApiError(error, 'Failed to generate OTP. Please try again.').message);
    } finally {
      setOtpLoading(false);
    }
  }, [initialTask?._id]);

  const handleRegenerateOtp = useCallback(async () => {
    setOtpGenerated(false);
    setCustomerOtp(['', '', '', '']);
    setGeneratedOtp(['', '', '', '']);
    await handleGenerateOtp();
  }, [handleGenerateOtp]);

  const handleChangeCustomerOtpDigit = useCallback((index: number, value: string) => {
    const digit = value.replace(/[^0-9]/g, '').slice(-1);
    setCustomerOtp(prev => {
      const next = [...prev];
      next[index] = digit;
      return next;
    });
    if (digit && index < 3) otpInputRefs.current[index + 1]?.focus();
  }, []);

  const handleVerifyOtp = useCallback(async () => {
    const code = customerOtp.join('');
    if (code.length < 4) return;

    setOtpLoading(true);
    setOtpError('');
    try {
      const token = await getToken();
      if (!token || !initialTask?._id) return;

      const verifyData = await verifyCommissioningOtp(token, initialTask._id, code);
      if (!verifyData.verified) {
        setOtpError('Incorrect OTP. Please ask the customer to check the code.');
        return;
      }

      // Moves to the optional remark step instead of closing the sheet —
      // refetching now (rather than waiting for the sheet to close) so the
      // footer/WORK COMPLETION section behind it are already correct by
      // the time the user does close it.
      setOtpStep(3);
      await fetchDetail();
    } catch (error: any) {
      const { code: errorCode, message } = parseApiError(error, 'Verification failed. Please try again.');
      if (errorCode === 'OTP_LOCKED') {
        // Too many failed attempts — force the customer-facing OTP back to
        // "not generated" so the only way forward is a fresh code.
        setOtpGenerated(false);
        setCustomerOtp(['', '', '', '']);
        setGeneratedOtp(['', '', '', '']);
        setOtpStep(1);
      }
      setOtpError(message);
    } finally {
      setOtpLoading(false);
    }
  }, [customerOtp, initialTask?._id, fetchDetail]);

  // No separate close call here — the backend already moves the task
  // straight to CLOSED as soon as the OTP is verified (confirmed: calling
  // /close afterward gets rejected with CONFLICT, "Entry cannot be closed
  // in its current state", since /close only accepts APPROVED tasks, same
  // precondition handleCloseTicket below already checks). This just saves
  // the optional feedback and refreshes so the already-CLOSED status shows.
  const handleSaveRemark = useCallback(async () => {
    setRemarkSaving(true);
    setRemarkError('');
    try {
      const token = await getToken();
      if (!token || !initialTask?._id) return;
      const trimmed = remark.trim();
      if (trimmed) await saveCommissioningFeedback(token, initialTask._id, { comment: trimmed });
      setOtpSheetOpen(false);
      await fetchDetail();
    } catch (error: any) {
      setRemarkError(parseApiError(error, 'Failed to save. Please try again.').message);
    } finally {
      setRemarkSaving(false);
    }
  }, [remark, initialTask?._id, fetchDetail]);

  // Close (APPROVED → CLOSED) — the one lifecycle-ending action this report
  // screen exposes. Roles per the backend dev guide: admin|rsm|dealer|
  // area_manager (admin stands in for rsm). Refetches in place afterward,
  // same as the SR report screen's Close Service action.
  const canClose = (role === 'areaManager' || role === 'admin' || role === 'dealer') && task?.status === 'APPROVED';

  const [closingTicket, setClosingTicket] = useState(false);
  const [closeTicketError, setCloseTicketError] = useState('');

  const handleCloseTicket = useCallback(async () => {
    setClosingTicket(true);
    setCloseTicketError('');
    try {
      const token = await getToken();
      if (!token || !initialTask?._id) return;
      await closeCommissioningTask(token, initialTask._id);
      await fetchDetail();
    } catch (error: any) {
      setCloseTicketError(parseApiError(error, 'Failed to close this ticket. Please try again.').message);
    } finally {
      setClosingTicket(false);
    }
  }, [initialTask?._id, fetchDetail]);

  return {
    task, asset: asset || {}, isLoading, refreshing, onRefresh, profile,
    detailError, isOffline,
    photos, signedPhotoUrls, photosSigning,
    videos, videoModalVisible, videoUri, videoError, handlePlayVideo, closeVideoModal,
    documents, documentOpeningUrl, documentError, handleViewDocument,
    downloadingReport, downloadReportError, handleDownloadReport,
    canClose, closingTicket, closeTicketError, handleCloseTicket,
    isOtpPending, completionOtp,
    otpSheetOpen, openOtpSheet, closeOtpSheet, otpStep,
    otpGenerated, generatedOtp, customerOtp, otpInputRefs, otpLoading, otpError,
    handleGenerateOtp, handleRegenerateOtp, handleChangeCustomerOtpDigit, handleVerifyOtp,
    remark, setRemark, remarkSaving, remarkError, handleSaveRemark,
  };
}
