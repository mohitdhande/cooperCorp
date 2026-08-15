import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/tokenStore';
import { UserProfile } from '../models/Login';
import { getCommissioningTaskDetail, getAssetById, getGcsSignedUrl, getGcsSignedUrls, closeCommissioningTask } from '../viewModel/commisionAPi';
import { getRole, Role } from '../constants/permissions';
import { parseApiError } from '../utils/apiError';
import { splitMediaByExtension } from '../utils/reportFormatters';
import { cacheData, getCachedData } from '../utils/offlineCache';
import { isNetworkError } from '../utils/syncEngine';

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

      const data = await getCommissioningTaskDetail(token, initialTask._id);
      setDetail(data);
      // No user-scoping needed on the cache key — logout already clears all
      // of AsyncStorage, so a stale previous user's cached detail can never
      // leak into a fresh session (same rule as dashboard_summary's cache).
      await cacheData(`commissioning_detail_${initialTask._id}`, data);

      const assetIdToFetch = data.assetId || initialTask.assetId;
      if (assetIdToFetch) {
        try {
          const assetData = await getAssetById(token, assetIdToFetch);
          setAsset(assetData);
          await cacheData(`asset_${assetIdToFetch}`, assetData);
        } catch (assetErr) {
          console.log('[Task Report] Failed to load asset:', assetErr);
          if (isNetworkError(assetErr)) {
            const cachedAsset = await getCachedData(`asset_${assetIdToFetch}`);
            if (cachedAsset) setAsset(cachedAsset.data);
          }
        }
      }
      return true;
    } catch (error) {
      console.log('[Task Report] Failed to load task detail:', error);
      // No signal at all — fall back to the fullest detail this device last
      // saw for this task instead of leaving the screen on just initialTask
      // (the list's sparse summary, missing checklist/fault-code/parts
      // detail). A real server error still reports failure normally, since
      // stale data can't fix that.
      if (isNetworkError(error)) {
        const cached = await getCachedData(`commissioning_detail_${initialTask._id}`);
        if (cached) { setDetail(cached.data); return true; }
      }
      return false;
    }
  }, [initialTask?._id]);

  const [detailError, setDetailError] = useState('');

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

    (async () => {
      setIsLoading(true);
      const ok = await fetchDetail();
      setDetailError(ok ? '' : 'Failed to load the latest task details.');
      setIsLoading(false);
    })();
  }, [fetchDetail]);

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
    detailError,
    photos, signedPhotoUrls, photosSigning,
    videos, videoModalVisible, videoUri, videoError, handlePlayVideo, closeVideoModal,
    documents, documentOpeningUrl, documentError, handleViewDocument,
    canClose, closingTicket, closeTicketError, handleCloseTicket,
  };
}
