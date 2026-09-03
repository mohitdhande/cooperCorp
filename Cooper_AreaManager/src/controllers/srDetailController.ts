import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/tokenStore';
import {
  getServiceTaskById, requestServiceWorkApproval, acceptServiceTask, startServiceTask, reviewServiceParts,
  closeServiceTask, submitAmWorkApproval, submitRsmWorkApproval, getAssetById, getGcsSignedUrls,
} from '../viewModel/commisionAPi';
import { parseApiError } from '../utils/apiError';
import { getRole, Role } from '../constants/permissions';
import { cacheData, getCachedData } from '../utils/offlineCache';
import { isNetworkError } from '../utils/syncEngine';

type EditFaultCode = { codeId: string; code: string; description: string; observation: string; rootCause: string; correctiveAction: string };
type EditPart = { partId: string; name: string; code: string; unit: string; quantity: number };

// Drives the read-only "SR Detail" screen — reached by tapping an Active-tab
// service card whose work-approval request is still awaiting the RSM
// (nothing to Start/Continue into yet), a Closed/Completed card, or an
// Active-tab card the RSM rejected. `initialTask` is the list card's own
// task object, shown immediately while the fuller detail (in case
// workApproval has moved on since the list was fetched) loads in behind it.
export function useSrDetailController(initialTask: any) {
  const [detail, setDetail] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  // The list/detail responses only ever embed a partial asset (just enough
  // for gensetNumber/engineNumber) or a bare assetId string — never the
  // full record with address/contact fields AssetLocationContact needs.
  // Same separate GET /assets/:id fetch srTaskReportController already
  // does for the same reason.
  const [asset, setAsset] = useState<any>(null);

  // Gates the work-approval action cards below — areaManager gets the
  // PENDING_AM step, admin stands in for the (non-existent, per this app's
  // Role type) rsm role at PENDING_RSM.
  const [role, setRole] = useState<Role>('engineer');
  const [userId, setUserId] = useState<string | undefined>(undefined);
  useEffect(() => {
    AsyncStorage.getItem('userData')
      .then((saved) => {
        if (!saved) return;
        const parsed = JSON.parse(saved);
        setRole(getRole(parsed.role));
        setUserId(parsed.userId);
      })
      .catch((error) => console.log('[SR Detail] Failed to load profile:', error));
  }, []);

  const [detailError, setDetailError] = useState('');

  // Depends on the real task id, not []: if this screen instance is ever
  // reused for a different task (navigating between two tasks' SR Detail
  // screens without a full unmount), the fetch needs to rerun for the new
  // id instead of leaving `detail` stuck on whichever task was first
  // fetched — that stale detail.status would then override the fresher
  // initialTask.status in the merge below, showing the wrong lifecycle
  // stage entirely.
  const fetchDetail = useCallback(async () => {
    setDetailError('');
    try {
      const token = await getToken();
      if (!token || !initialTask?._id) return;
      const data = await getServiceTaskById(token, initialTask._id);
      setDetail(data);
      // No user-scoping needed on the cache key — logout already clears all
      // of AsyncStorage, so a stale previous user's cached detail can never
      // leak into a fresh session.
      await cacheData(`service_detail_${initialTask._id}`, data);

      // assetId can arrive as a bare string (detail endpoint) or a
      // populated object (list endpoint's own embed) — either way, this
      // pulls out just the id string getAssetById needs.
      const rawAssetId = data.assetId || initialTask.assetId || initialTask.asset;
      const assetIdToFetch = typeof rawAssetId === 'string' ? rawAssetId : rawAssetId?._id;
      if (assetIdToFetch) {
        try {
          const assetData = await getAssetById(token, assetIdToFetch);
          setAsset(assetData);
          await cacheData(`asset_${assetIdToFetch}`, assetData);
        } catch (assetErr) {
          console.log('[SR Detail] Failed to load asset:', assetErr);
          if (isNetworkError(assetErr)) {
            const cachedAsset = await getCachedData(`asset_${assetIdToFetch}`);
            if (cachedAsset) setAsset(cachedAsset.data);
          }
        }
      }
    } catch (error: any) {
      console.log('[SR Detail] Failed to load task detail:', error);
      // No signal at all — fall back to the fullest detail this device last
      // saw for this task instead of leaving the screen on just initialTask
      // (the list's sparse summary).
      if (isNetworkError(error)) {
        const cached = await getCachedData(`service_detail_${initialTask._id}`);
        if (cached) { setDetail(cached.data); return; }
      }
      setDetailError(parseApiError(error, 'Failed to load the latest task details. Pull to refresh and try again.').message);
    }
  }, [initialTask?._id]);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      await fetchDetail();
      setIsLoading(false);
    })();
  }, [fetchDetail]);

  // Polls while a work approval is sitting with the AM/RSM — this screen is
  // the AM/RSM's own review surface, so a decision made elsewhere (or by
  // this same user via the action cards below) should reflect here within
  // one poll tick instead of waiting on a manual pull-to-refresh. No
  // isLoading toggle on the poll tick itself — only the initial load shows
  // the full-screen spinner.
  // useFocusEffect (not a plain useEffect) — this shouldn't keep polling
  // every 8s from a screen the user has navigated away from while it stays
  // mounted in the background (expo-router's Stack keeps previous screens
  // mounted, not unmounted, on push).
  const pendingWorkApprovalStatus = (detail || initialTask)?.workApproval?.status;
  useFocusEffect(
    useCallback(() => {
      if (pendingWorkApprovalStatus !== 'PENDING_AM' && pendingWorkApprovalStatus !== 'PENDING_RSM') return;
      const interval = setInterval(() => { fetchDetail(); }, 8000);
      return () => clearInterval(interval);
    }, [pendingWorkApprovalStatus, fetchDetail])
  );

  // Merged, not just detail-or-initialTask — the detail endpoint's response
  // only carries `assetId` (a bare string), not the populated `asset` object
  // the list endpoint embeds. A plain `detail || initialTask` swap would
  // silently drop asset.gensetNumber/engineNumber once detail loads.
  const task = detail ? { ...initialTask, ...detail } : initialTask;

  // Gates the Acknowledge/Start Work/Complete Service action cards to the
  // actual assignee — this screen is also how an areaManager reaches a
  // subordinate's task (to review/approve parts or work), and without this
  // check they'd see the exact same "Continue" button the engineer sees,
  // even though filling the form is that engineer's job, not theirs.
  const isMyOwnTask = !!userId && task?.assignedTo?.userId === userId;

  // ── Edit & Resubmit (rejected tasks only) ──
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFaultCodes, setEditFaultCodes] = useState<EditFaultCode[]>([]);
  const [editParts, setEditParts] = useState<EditPart[]>([]);
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitError, setResubmitError] = useState('');

  // Snapshots the current (populated) faultCodes/partsUsed into editable
  // local copies — codeId/partId get unwrapped back to bare id strings here
  // since that's what the API expects on the way back out, not the
  // populated objects GET /service/:id returns them as.
  const openEditModal = useCallback(() => {
    setEditFaultCodes((task.faultCodes || []).map((fc: any) => ({
      codeId: fc.codeId?._id || fc.codeId,
      code: fc.codeId?.code || '',
      description: fc.codeId?.description || '',
      observation: fc.observation || '',
      rootCause: fc.rootCause || '',
      correctiveAction: fc.correctiveAction || '',
    })));
    setEditParts((task.partsUsed || []).map((p: any) => ({
      partId: p.partId?._id || p.partId,
      name: p.partId?.name || '',
      code: p.partId?.code || '',
      unit: p.partId?.unit || '',
      quantity: p.quantity || 1,
    })));
    setResubmitError('');
    setEditModalVisible(true);
  }, [task.faultCodes, task.partsUsed]);

  const closeEditModal = useCallback(() => setEditModalVisible(false), []);

  const updateFaultCodeField = useCallback((index: number, field: 'observation' | 'rootCause' | 'correctiveAction', value: string) => {
    setEditFaultCodes((prev) => prev.map((fc, i) => (i === index ? { ...fc, [field]: value } : fc)));
  }, []);

  const changePartQuantity = useCallback((index: number, delta: number) => {
    setEditParts((prev) => prev.map((p, i) => (i === index ? { ...p, quantity: Math.max(1, p.quantity + delta) } : p)));
  }, []);

  const handleResubmit = useCallback(async () => {
    setResubmitting(true);
    setResubmitError('');
    try {
      const token = await getToken();
      if (!token || !task._id) return;
      await requestServiceWorkApproval(token, task._id, {
        category: task.category,
        subCategory: task.subCategory,
        faultCodes: editFaultCodes.map((fc) => ({
          codeId: fc.codeId, observation: fc.observation, rootCause: fc.rootCause, correctiveAction: fc.correctiveAction,
        })),
        partsUsed: editParts.map((p) => ({ partId: p.partId, quantity: p.quantity })),
        notes: task.notes,
      });
      setEditModalVisible(false);
      await fetchDetail();
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to resubmit for approval. Please try again.');
      setResubmitError(message);
    } finally {
      setResubmitting(false);
    }
  }, [task._id, task.category, task.subCategory, task.notes, editFaultCodes, editParts, fetchDetail]);

  // ── Acknowledge (plain ASSIGNED active task, not yet accepted) ──
  const [acknowledging, setAcknowledging] = useState(false);
  const [acknowledgeError, setAcknowledgeError] = useState('');

  const handleAcknowledge = useCallback(async () => {
    setAcknowledging(true);
    setAcknowledgeError('');
    try {
      const token = await getToken();
      if (!token || !task._id) return;
      await acceptServiceTask(token, task._id);
      await fetchDetail();
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to acknowledge this task. Please try again.');
      setAcknowledgeError(message);
    } finally {
      setAcknowledging(false);
    }
  }, [task._id, fetchDetail]);

  // ── Start Work (ACCEPTED -> IN_PROGRESS) ──
  const [startingWork, setStartingWork] = useState(false);
  const [startWorkError, setStartWorkError] = useState('');

  const handleStartWork = useCallback(async () => {
    setStartingWork(true);
    setStartWorkError('');
    try {
      const token = await getToken();
      if (!token || !task._id) return;
      await startServiceTask(token, task._id);
      await fetchDetail();
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to start this task. Please try again.');
      setStartWorkError(message);
    } finally {
      setStartingWork(false);
    }
  }, [task._id, fetchDetail]);

  // ── AM's per-part approval decision (Parts Awaiting Review card) ──
  // Genuinely per-part — the endpoint takes a decisions[] array, so this
  // sends a single-item array for whichever part's ✓/✗ was tapped.
  const [amReviewSaving, setAmReviewSaving] = useState(false);
  const [amReviewError, setAmReviewError] = useState('');

  const handleAmReview = useCallback(async (partId: string, decision: 'APPROVED' | 'REJECTED', reason?: string) => {
    setAmReviewSaving(true);
    setAmReviewError('');
    try {
      const token = await getToken();
      if (!token || !task._id) return;
      await reviewServiceParts(token, task._id, [
        { partId, decision, ...(decision === 'REJECTED' ? { reason: reason?.trim() || 'Not approved' } : {}) },
      ]);
      await fetchDetail();
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to submit your decision. Please try again.');
      setAmReviewError(message);
    } finally {
      setAmReviewSaving(false);
    }
  }, [task._id, fetchDetail]);

  // ── Work approval decisions — the separate AM-review/RSM-confirm gate
  // (workApproval, only seeded for D/E always or B/C+Goodwill), distinct
  // from handleAmReview above which is the per-part partApproval gate.
  const [workApprovalSaving, setWorkApprovalSaving] = useState(false);
  const [workApprovalError, setWorkApprovalError] = useState('');

  const handleAmWorkDecision = useCallback(async (decision: 'APPROVED' | 'REJECTED', note?: string) => {
    setWorkApprovalSaving(true);
    setWorkApprovalError('');
    try {
      const token = await getToken();
      if (!token || !task._id) return;
      await submitAmWorkApproval(token, task._id, decision, note?.trim() || (decision === 'APPROVED' ? 'Approved' : 'Not Approved'));
      await fetchDetail();
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to submit your decision. Please try again.');
      setWorkApprovalError(message);
    } finally {
      setWorkApprovalSaving(false);
    }
  }, [task._id, fetchDetail]);

  const handleRsmWorkDecision = useCallback(async (decision: 'CONFIRMED' | 'REJECTED', note?: string) => {
    setWorkApprovalSaving(true);
    setWorkApprovalError('');
    try {
      const token = await getToken();
      if (!token || !task._id) return;
      await submitRsmWorkApproval(token, task._id, decision, note?.trim() || (decision === 'CONFIRMED' ? 'Confirmed' : 'Not Approved'));
      await fetchDetail();
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to submit your decision. Please try again.');
      setWorkApprovalError(message);
    } finally {
      setWorkApprovalSaving(false);
    }
  }, [task._id, fetchDetail]);

  // ── Close Ticket — "path b" from the API doc: no work-approval gate
  // (this category never seeded one) and parts are all reviewed, so the
  // ticket can close directly with no OTP step. ("Path a", work approval
  // confirmed + OTP verified, is handled entirely inside srTaskForm.tsx.)
  const [closingTicket, setClosingTicket] = useState(false);
  const [closeTicketError, setCloseTicketError] = useState('');

  const handleCloseTicket = useCallback(async () => {
    setClosingTicket(true);
    setCloseTicketError('');
    try {
      const token = await getToken();
      if (!token || !task._id) return;
      await closeServiceTask(token, task._id);
      await fetchDetail();
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to close this ticket. Please try again.');
      setCloseTicketError(message);
    } finally {
      setClosingTicket(false);
    }
  }, [task._id, fetchDetail]);

  // Photos here are raw GCS URLs — same private-bucket problem as
  // srTaskReportController, fixed the same way: one batch /gcs/sign call
  // for the whole gallery, keyed by the original raw url. task.media
  // replaces the old flat task.photos field (unified media[] model, Sep
  // 2026 backend migration) — filtered by .type instead of trusting a
  // field that no longer exists.
  // An item tagged 'Running Hours' is pulled out into its own
  // runningHoursPhotoUrl instead of the general photos list — same split
  // srTaskReportController.ts's own Running Hours section makes, so this
  // screen's new matching section (and the general gallery below) don't
  // both show the same photo.
  const media: { type: string; gcsUrl: string; tags?: string[] }[] = task?.media || [];
  const isRunningHours = (m: { tags?: string[] }) => !!m.tags?.includes('Running Hours');
  const siteMedia = media.filter((m) => !isRunningHours(m));
  const runningHoursPhotoUrl = media.find((m) => isRunningHours(m) && (m.type === 'photo' || m.type === 'image'))?.gcsUrl || null;

  const photoUrls: string[] = siteMedia.filter((m) => m.type === 'photo' || m.type === 'image').map((m) => m.gcsUrl);
  const [signedPhotoUrls, setSignedPhotoUrls] = useState<Record<string, string>>({});
  const [photosSigning, setPhotosSigning] = useState(false);
  // Signed in the same batch as the general gallery so the Running Hours
  // section's own thumbnail resolves too.
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
        console.log('[SR Detail] Failed to sign photos:', error);
      } finally {
        if (!cancelled) setPhotosSigning(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photosKey]);

  return {
    task, asset, isLoading, role, isMyOwnTask,
    detailError, retryFetchDetail: fetchDetail,
    editModalVisible, openEditModal, closeEditModal,
    editFaultCodes, editParts, updateFaultCodeField, changePartQuantity,
    resubmitting, resubmitError, handleResubmit,
    acknowledging, acknowledgeError, handleAcknowledge,
    startingWork, startWorkError, handleStartWork,
    amReviewSaving, amReviewError, handleAmReview,
    workApprovalSaving, workApprovalError, handleAmWorkDecision, handleRsmWorkDecision,
    closingTicket, closeTicketError, handleCloseTicket,
    signedPhotoUrls, photosSigning, runningHoursPhotoUrl,
  };
}
