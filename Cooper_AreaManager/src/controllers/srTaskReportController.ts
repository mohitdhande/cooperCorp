import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Alert, AppState, AppStateStatus, Linking, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/tokenStore';
import { UserProfile } from '../models/Login';
import {
  getServiceTaskById, getAssetById, getGcsSignedUrl, getGcsSignedUrls, closeServiceTask,
  generateServiceOtp, verifyServiceOtp,
} from '../viewModel/commisionAPi';
import { parseApiError } from '../utils/apiError';
import { cacheData, getCachedData } from '../utils/offlineCache';
import { isNetworkError } from '../utils/syncEngine';

// Loads the full SR (service) task detail + asset for the report screen.
// `initialTask` is the summary object handed over via navigation params —
// shown immediately while the fuller detail loads in the background.
export function useSrTaskReportController(initialTask: any) {
  const [detail, setDetail] = useState<any>(null);
  const [asset, setAsset] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  // True the moment the live task-detail fetch fails from a genuine network
  // error (regardless of whether a cache existed to fall back to) — drives
  // disabling the Verify OTP button below, since OTP generate/verify are
  // inherently live-only actions (see commisionAPi.ts) that can't queue
  // for later the way every other save in this app now can.
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
    try {
      const token = await getToken();
      if (!token || !initialTask?._id) return true;

      const data = await getServiceTaskById(token, initialTask._id);
      setDetail(data);
      setIsOffline(false);
      // No user-scoping needed on the cache key — logout already clears all
      // of AsyncStorage, so a stale previous user's cached detail can never
      // leak into a fresh session.
      await cacheData(`service_report_detail_${initialTask._id}`, data);

      const assetIdToFetch = data.assetId || initialTask.assetId;
      if (assetIdToFetch) {
        try {
          const assetData = await getAssetById(token, assetIdToFetch);
          setAsset(assetData);
          await cacheData(`asset_${assetIdToFetch}`, assetData);
        } catch (assetErr) {
          console.log('[SR Task Report] Failed to load asset:', assetErr);
          if (isNetworkError(assetErr)) {
            const cachedAsset = await getCachedData(`asset_${assetIdToFetch}`);
            if (cachedAsset) setAsset(cachedAsset.data);
          }
        }
      }
      return true;
    } catch (error) {
      console.log('[SR Task Report] Failed to load task detail:', error);
      // No signal at all — fall back to the fullest detail this device last
      // saw for this task instead of leaving the screen on just initialTask
      // (the list's sparse summary).
      if (isNetworkError(error)) {
        setIsOffline(true);
        const cached = await getCachedData(`service_report_detail_${initialTask._id}`);
        if (cached) { setDetail(cached.data); return true; }
      }
      return false;
    }
  }, [initialTask?._id]);

  const [detailError, setDetailError] = useState('');

  // Profile only — loaded once, no reason to re-read it every time this
  // screen regains focus (it doesn't change while the app is open).
  useEffect(() => {
    AsyncStorage.getItem('userData')
      .then((saved) => { if (saved) setProfile(JSON.parse(saved)); })
      .catch((error) => console.log('[SR Task Report] Failed to load profile:', error));
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

  // Polls while a work approval is sitting with the AM/RSM, so this report
  // screen reflects an approve/reject decision made elsewhere within one
  // poll tick instead of requiring a manual pull-to-refresh. useFocusEffect
  // (not a plain useEffect) for the same reason as the block above — this
  // shouldn't keep polling every 8s from a screen the user has navigated
  // away from while it stays mounted in the background.
  const pendingWorkApprovalStatus = task?.workApproval?.status;
  useFocusEffect(
    useCallback(() => {
      if (pendingWorkApprovalStatus !== 'PENDING_AM' && pendingWorkApprovalStatus !== 'PENDING_RSM') return;
      const interval = setInterval(() => { fetchDetail(); }, 8000);
      return () => clearInterval(interval);
    }, [pendingWorkApprovalStatus, fetchDetail])
  );

  // Video playback — task.videos are raw GCS URLs, unplayable directly
  // (private bucket). Tapping a video opens the modal immediately (spinner
  // while videoUri is still null) and resolves a signed URL on demand,
  // never cached, matching the dev guide's own "fetch on tap, don't cache
  // it" rule for GCS-signed reads.
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

  // Unified media[] model (Sep 2026 backend migration) — replaces the old
  // separate photos/videos fields (PDFs used to ride the videos array,
  // distinguished only by their .pdf extension). Each item now carries its
  // own .type directly. An item tagged 'Running Hours' (the fixed default
  // useSrTaskForm.ts's runningHoursQueue always confirms with) is pulled
  // out into its own runningHoursPhotoUrl instead of the general photos
  // list — same distinction the commissioning report makes, see its own
  // comment in taskReportController.ts.
  const media: { type: string; gcsUrl: string; tags?: string[] }[] = task?.media || [];
  const isRunningHours = (m: { tags?: string[] }) => !!m.tags?.includes('Running Hours');
  const siteMedia = media.filter((m) => !isRunningHours(m));
  const runningHoursPhotoUrl = media.find((m) => isRunningHours(m) && (m.type === 'photo' || m.type === 'image'))?.gcsUrl || null;

  const videos = siteMedia.filter((m) => m.type === 'video').map((m) => m.gcsUrl);
  const documents = siteMedia.filter((m) => m.type === 'pdf').map((m) => m.gcsUrl);

  const [documentOpeningUrl, setDocumentOpeningUrl] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState('');

  // No in-app PDF viewer in this app — signs the private GCS url into a
  // short-lived readable link (same pattern as handlePlayVideo above) and
  // hands it to the OS/browser's own PDF viewer via Linking, rather than
  // trying to render it inline.
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

  // Photo gallery — same private-bucket problem as videos, but batch-signed
  // once (one /gcs/sign round-trip for the whole gallery) rather than on
  // tap, per the dev guide's "sign before rendering thumbnails" rule.
  // Keyed by the ORIGINAL raw url so the render side can look a signed url
  // up without re-deriving the bucket path.
  const [signedPhotoUrls, setSignedPhotoUrls] = useState<Record<string, string>>({});
  const [photosSigning, setPhotosSigning] = useState(false);
  const photoUrls = siteMedia.filter((m) => m.type === 'photo' || m.type === 'image').map((m) => m.gcsUrl);
  // Signed in the same batch as the general gallery (below) so the
  // Running Hours section's own thumbnail resolves too.
  const photosToSign = runningHoursPhotoUrl ? [...photoUrls, runningHoursPhotoUrl] : photoUrls;
  const photosKey = JSON.stringify(photosToSign);

  useEffect(() => {
    const photos: string[] = photosToSign;
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
        console.log('[SR Task Report] Failed to sign photos:', error);
      } finally {
        if (!cancelled) setPhotosSigning(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photosKey]);

  // Close Ticket — same 3-gate rule as srTaskForm.tsx/srDetailController.ts:
  // OTP verified (CLIENT_APPROVED) AND part approval not still PENDING AND
  // work approval CONFIRMED (or never required for this category). Report
  // screen is read-only otherwise, so this is the one action it needs —
  // closing just refetches in place rather than navigating anywhere.
  const [closingTicket, setClosingTicket] = useState(false);
  const [closeTicketError, setCloseTicketError] = useState('');

  const otpVerified = task?.status === 'CLIENT_APPROVED' || task?.completionOtp?.verified === true;
  const partsDone = !task?.partApproval || task.partApproval.status !== 'PENDING';
  const workDone = !task?.workApproval || task.workApproval.status === 'CONFIRMED';
  const canCloseTicket = otpVerified && partsDone && workDone && task?.status !== 'CLOSED';

  const handleCloseTicket = useCallback(async () => {
    setClosingTicket(true);
    setCloseTicketError('');
    try {
      const token = await getToken();
      if (!token || !initialTask?._id) return;
      await closeServiceTask(token, initialTask._id);
      await fetchDetail();
    } catch (error: any) {
      setCloseTicketError(parseApiError(error, 'Failed to close this ticket. Please try again.').message);
    } finally {
      setClosingTicket(false);
    }
  }, [initialTask?._id, fetchDetail]);

  // Client OTP verification — moved here from srTaskForm.tsx (Customer
  // Sign-off used to live inline on Step 5), same as commissioning's own
  // OTP step living on taskReport.tsx instead of taskForm.tsx. Same 3-step
  // shape as commissioning: Generate OTP -> Customer Enters OTP -> Customer
  // Remark (optional feedback, saved via PUT /:id/feedback — no status
  // restriction). A successful verify moves status to CLIENT_APPROVED (not
  // an auto-close like commissioning's COMPLETED → CLOSED) — Close Service
  // above stays a separate, later step once partApproval/workApproval also
  // clear.
  const isOtpPending = task?.status === 'COMPLETED' && !task?.completionOtp?.verified;

  const [otpSheetOpen, setOtpSheetOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<1 | 2 | 3>(1);
  const [otpGenerated, setOtpGenerated] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState<string[]>(['', '', '', '']);
  const [customerOtp, setCustomerOtp] = useState<string[]>(['', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const otpInputRefs = useRef<Array<TextInput | null>>([null, null, null, null]);
  const [remark, setRemark] = useState('');
  const [remarkSaving, setRemarkSaving] = useState(false);
  const [remarkError, setRemarkError] = useState('');

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
      const response = await generateServiceOtp(token, initialTask._id);
      const code = String(response?.code || '');
      setGeneratedOtp(code.split('').slice(0, 4));
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

      const verifyData = await verifyServiceOtp(token, initialTask._id, code);
      if (!verifyData?.verified && verifyData?.status !== 'CLIENT_APPROVED') {
        setOtpError('Incorrect OTP. Please ask the customer to check the code.');
        return;
      }

      // Moves to the optional remark step instead of closing the sheet —
      // refetching now (rather than waiting for the sheet to close) so the
      // footer/status behind it are already correct by the time the user
      // does close it. Same as commissioning's own handleVerifyOtp.
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

  // Save & Close always calls PUT /:id/close — there's no separate
  // /:id/feedback route for service tasks (confirmed: it 404s), unlike
  // commissioning's own equivalent endpoint. Same partsDone/workDone gate
  // handleCloseTicket enforces below — checked client-side before ever
  // calling the API instead of just trusting the backend to reject an
  // ineligible close (confirmed the backend doesn't always reject this
  // reliably, which let a ticket close once with both approvals still
  // PENDING).
  const handleSaveRemark = useCallback(async () => {
    if (!partsDone || !workDone) {
      // Same wording the backend itself used to reject this — kept
      // consistent so the message reads the same whether the client or
      // the server ends up being the one that catches it.
      setRemarkError(
        !partsDone && !workDone
          ? 'Parts and work approval must be reviewed before closing.'
          : !partsDone
          ? 'Parts must be reviewed by AM before closing.'
          : 'Work approval must be confirmed before closing.'
      );
      return;
    }

    setRemarkSaving(true);
    setRemarkError('');
    try {
      const token = await getToken();
      if (!token || !initialTask?._id) return;
      const trimmed = remark.trim();

      // PUT /:id/close is the only endpoint that exists for this — there's
      // no separate /:id/feedback route on the backend for service tasks
      // (confirmed: it 404s). The remark rides its customerFeedback field,
      // sent whenever there's actually something to send.
      await closeServiceTask(token, initialTask._id, trimmed || undefined);

      setOtpSheetOpen(false);
      await fetchDetail();
    } catch (error: any) {
      setRemarkError(parseApiError(error, 'Failed to save. Please try again.').message);
    } finally {
      setRemarkSaving(false);
    }
  }, [remark, initialTask?._id, fetchDetail, partsDone, workDone]);

  return {
    task, asset: asset || {}, isLoading, refreshing, onRefresh, profile,
    detailError, isOffline,
    videos, videoModalVisible, videoUri, videoError, handlePlayVideo, closeVideoModal,
    documents, documentOpeningUrl, documentError, handleViewDocument,
    photos: photoUrls, signedPhotoUrls, photosSigning,
    runningHoursPhotoUrl,
    canCloseTicket, closingTicket, closeTicketError, handleCloseTicket,
    otpVerified, partsDone, workDone,
    isOtpPending,
    otpSheetOpen, openOtpSheet, closeOtpSheet, otpStep,
    otpGenerated, generatedOtp, customerOtp, otpInputRefs, otpLoading, otpError,
    handleGenerateOtp, handleRegenerateOtp, handleChangeCustomerOtpDigit, handleVerifyOtp,
    remark, setRemark, remarkSaving, remarkError, handleSaveRemark,
  };
}
