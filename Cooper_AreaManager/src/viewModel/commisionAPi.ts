import axiosClient from './axiosClient';

// event.loaded can end up slightly ABOVE event.total near the end of a raw
// file upload on Android — the native networking layer's own progress
// reporting across the RN bridge isn't perfectly exact for this upload
// shape, not a sign the byte counts are fake. Clamped everywhere progress
// is computed so the UI never shows e.g. 145%.
const clampPercent = (percent: number): number => Math.max(0, Math.min(100, percent));

// Same backend/contract as Cooper's commisionAPi.ts — returns both
// commissioning and service tasks (plus their counts) for the given status.
export const getMyTasksByStatus = async (
  token: string,
  status: string,
  page: number = 1,
  limit: number = 10
) => {
  try {
    const response = await axiosClient.get(
      `/api/me/tasks?status=${status}&page=${page}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Get My Tasks Error:', error.response?.data || error.message);
    throw error;
  }
};

// The SR Approvals screen's own data source — GET /api/service directly
// (not GET /me/tasks, which doesn't carry preApproval/partApproval/
// workApproval on its list items). `mine: true` scopes to the caller's own
// entries for the "My" tab; omitted entirely for "All" (whatever broader
// scope the backend's own role rules allow for this endpoint).
export const getServiceEntries = async (
  token: string,
  params?: { mine?: boolean; workApprovalStatus?: string; partApprovalStatus?: string }
) => {
  try {
    const response = await axiosClient.get('/api/service', {
      params,
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Service Entries Error:', error.response?.data || error.message);
    throw error;
  }
};

// Area-manager-only: the AM's own tasks (myTasks) plus every dealer under
// them — each dealer's own tasks (ownTasks) and every engineer under that
// dealer (engineers[].tasks) — the whole reporting tree in one call. Used
// by the Commissioning/Service list screens instead of GET /me/tasks for
// this one role, since an AM's tabs need to reflect their entire team's
// tasks, not just their own.
export const getMyTeamData = async (token: string) => {
  try {
    const response = await axiosClient.get('/api/me/team', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get My Team Error:', error.response?.data || error.message);
    throw error;
  }
};

// Single consolidated fetch backing the whole Dashboard screen: active-task
// counts (commissioning + service), the active task lists themselves
// (already carrying their embedded `asset`, same shape GET /api/me/tasks
// returns), recent completions, role-relative summary counts (myActive/
// teamActive/overdue/...), and the team avatar strip with each person's own
// active count — one round trip instead of the screen's previous separate
// team-roster + tasks-by-status calls.
export const getDashboardSummary = async (token: string) => {
  try {
    const response = await axiosClient.get('/api/me/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Dashboard Summary Error:', error.response?.data || error.message);
    throw error;
  }
};

// Org-wide dashboard aggregate — admin | rsm | dealer only (area_manager
// gets 403 here and uses getDashboardSummary/GET /me/dashboard instead,
// which this app already calls for every role). Not currently wired into
// any screen — this app's single Dashboard screen uses /me/dashboard
// uniformly, including for dealer, since that endpoint already covers a
// dealer's own team scope. Implemented for completeness / a future
// org-wide view (e.g. an admin-level cross-region dashboard).
export const getOrgDashboard = async (token: string) => {
  try {
    const response = await axiosClient.get('/api/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Org Dashboard Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getDashboardKpis = async (
  token: string,
  params?: { from?: string; to?: string; regionId?: string; areaId?: string }
) => {
  try {
    const response = await axiosClient.get('/api/dashboard/kpis', {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
    return response.data as {
      commissioningCompleted: number; serviceCompleted: number;
      avgResolutionDays: number; overdueCount: number;
    };
  } catch (error: any) {
    console.log('Get Dashboard KPIs Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getEngineerPerformance = async (
  token: string,
  params?: { from?: string; to?: string; areaId?: string }
) => {
  try {
    const response = await axiosClient.get('/api/dashboard/performance/engineers', {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Engineer Performance Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getDealerPerformance = async (
  token: string,
  params?: { from?: string; to?: string; regionId?: string }
) => {
  try {
    const response = await axiosClient.get('/api/dashboard/performance/dealers', {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Dealer Performance Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getRsmPerformance = async (
  token: string,
  params?: { from?: string; to?: string }
) => {
  try {
    const response = await axiosClient.get('/api/dashboard/performance/rsms', {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
    return response.data;
  } catch (error: any) {
    console.log('Get RSM Performance Error:', error.response?.data || error.message);
    throw error;
  }
};

// Audit log of system changes visible to the current user (scoped
// server-side by role). Not wired into any screen yet — this app has no
// Activity Feed/Audit Log view, but the function is ready for one; an
// area_manager wanting to see what changed on their team's tasks is the
// most plausible real use case among this app's actual roles.
export const getChangelog = async (token: string, page?: number, limit?: number) => {
  try {
    const response = await axiosClient.get('/api/changelog', {
      headers: { Authorization: `Bearer ${token}` },
      params: { page, limit },
    });
    return response.data as {
      _id: string;
      entity: 'commissioning' | 'service' | 'asset' | 'user';
      entityId: string;
      action: string;
      actor: { name: string; role: string };
      diff: Record<string, { before: unknown; after: unknown }>;
      createdAt: string;
    }[];
  } catch (error: any) {
    console.log('Get Changelog Error:', error.response?.data || error.message);
    throw error;
  }
};

// Plain paginated asset list (scoped by role) — not currently used by any
// screen in this app, which always finds assets via searchAssets instead
// (every flow is search-first: New Job, New Service Job, Create Asset).
// Implemented per the backend dev guide for completeness/future use, e.g.
// an "all assets" browse screen if one gets built later.
export const getAssets = async (
  token: string,
  params?: { search?: string; status?: string; page?: number; limit?: number }
) => {
  try {
    const response = await axiosClient.get('/api/assets', {
      headers: { Authorization: `Bearer ${token}` },
      params,
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Assets Error:', error.response?.data || error.message);
    throw error;
  }
};

export const searchAssets = async (token: string, query: string) => {
  try {
    const response = await axiosClient.get(`/api/assets/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Search Assets Error:', error.response?.data || error.message);
    throw error;
  }
};

// Historical SAP commissioning records — searched only as a fallback once
// /api/assets/search comes back empty (New Job screen), since a genset can
// have a real SAP dispatch/commissioning history without an Asset ever
// having been created for it in this app yet.
export const searchGensetSapAssets = async (token: string, query: string) => {
  try {
    const response = await axiosClient.get(`/api/genset-sap-assets/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Search Genset SAP Assets Error:', error.response?.data || error.message);
    throw error;
  }
};

// The New Service Request screen's own SAP fallback used to hit a distinct
// /api/commissioning/sap-search endpoint here — confirmed against the
// actual backend API reference that no such route exists (the only SAP-
// related GET under /commissioning is sap-preview, a different thing). It
// was falling through to the generic /commissioning/:id route instead,
// which tried to parse "sap-search" itself as a Mongo id and failed with
// "Invalid entry id". Same data, same GensetSapAsset shape as New Job's own
// fallback, so this now just points at searchGensetSapAssets's endpoint.
export const searchCommissioningSap = searchGensetSapAssets;

// The New Service Request screen's own category/subcategory taxonomy —
// fetched once on mount rather than hardcoded, since the real category C
// ("Out Of Warranty") sub-list turned out to differ from what had been
// guessed locally. Also carries approval-requirement flags this screen
// doesn't currently consume (preApprovalRequired/partApprovalRequired/
// workApprovalAlwaysCategories/etc.) — kept in the response as-is for a
// future pass, not discarded.
export const getServiceCategoryConfig = async (token: string) => {
  try {
    const response = await axiosClient.get('/api/service/category-config', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Service Category Config Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getCommissioningAvailableActions = async (token: string, assetId: string) => {
  try {
    const response = await axiosClient.get(`/api/commissioning/available-actions?assetId=${assetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Available Actions Error:', error.response?.data || error.message);
    throw error;
  }
};

// Unscoped by design (per the backend team's own dev guide) — returns only
// check data (no PII), so it's readable regardless of who the source entry
// is assigned to. Used right when the user picks COMMISSIONING (source
// PRE_COMMISSIONING) or RE_COMMISSIONING (source COMMISSIONING) on New Job,
// to preview/carry over the most recent completed entry's own checks.
export const getCommissioningPrefillChecks = async (token: string, assetId: string, sourceType: string) => {
  try {
    const response = await axiosClient.get(
      `/api/commissioning/prefill-checks?assetId=${assetId}&type=${sourceType}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    console.log('[Prefill Checks] Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error: any) {
    console.log('Get Prefill Checks Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getDealers = async (token: string) => {
  try {
    const response = await axiosClient.get('/api/users?roles=dealer', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Dealers Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getEngineers = async (token: string) => {
  try {
    const response = await axiosClient.get('/api/users?roles=engineer', {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Engineers Error:', error.response?.data || error.message);
    throw error;
  }
};

export const createCommissioningEntry = async (token: string, body: Record<string, any>) => {
  try {
    const response = await axiosClient.post('/api/commissioning', body, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Create Commissioning Entry Error:', error.response?.data || error.message);
    throw error;
  }
};

// Mirrors createCommissioningEntry's POST /api/commissioning — every other
// service endpoint in this file (save-progress, otp, complete, photos) is
// the exact /api/service/{taskId}/... counterpart of its /api/commissioning
// equivalent, so this follows the same pattern for creation.
export const createServiceEntry = async (token: string, body: Record<string, any>) => {
  try {
    const response = await axiosClient.post('/api/service', body, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Create Service Entry Error:', error.response?.data || error.message);
    throw error;
  }
};

// Pre-computed Free Service (category A) window status for one asset —
// replaces client-side date math with the backend's own commissioning-date
// + window/grace-period calculation. Always 4 items, First -> Fourth.
export const getFreeServiceAvailability = async (token: string, assetId: string) => {
  try {
    const response = await axiosClient.get('/api/service/free-service-availability', {
      params: { assetId },
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Free Service Availability Error:', error.response?.data || error.message);
    throw error;
  }
};

export const acceptCommissioningTask = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/accept`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Accept Commissioning Task Error:', error.response?.data || error.message);
    throw error;
  }
};

export const startCommissioningTask = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/start`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Start Commissioning Task Error:', error.response?.data || error.message);
    throw error;
  }
};

// Hands a task from the dealer down to one of their engineers — confirmed
// with backend this is the exact same POST /api/commissioning endpoint
// createCommissioningEntry uses, just called again with { assetId, type,
// assignedToId } in the body (no taskId — the backend resolves the task
// itself from the asset + type).
export const reassignCommissioningTask = async (token: string, assetId: string, type: string, assignedToId: string) => {
  try {
    const response = await axiosClient.post(
      '/api/commissioning',
      { assetId, type, assignedToId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Reassign Commissioning Task Error:', error.response?.data || error.message);
    throw error;
  }
};

export const acceptServiceTask = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.put(
      `/api/service/${taskId}/accept`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Accept Service Task Error:', error.response?.data || error.message);
    throw error;
  }
};

export const startServiceTask = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.put(
      `/api/service/${taskId}/start`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Start Service Task Error:', error.response?.data || error.message);
    throw error;
  }
};

// Closes an APPROVED/fully-confirmed entry — the final step once the work
// approval chain reaches CONFIRMED and the customer OTP is verified.
// `comment` is optional — the OTP sheet's own Step 3 (Customer Remark)
// passes it here directly when the task is already close-eligible at that
// point, instead of a separate PUT /:id/feedback call. Nested under
// customerFeedback (not a bare `comment` key) per the confirmed backend
// contract for this endpoint specifically.
export const closeServiceTask = async (token: string, taskId: string, comment?: string) => {
  try {
    const response = await axiosClient.put(
      `/api/service/${taskId}/close`,
      comment ? { customerFeedback: { comment } } : {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Close Service Task Error:', error.response?.data || error.message);
    throw error;
  }
};

// Engineer's Step 6 "Complete" action — the primary completion call for
// the mobile engineer flow. Marks the entry COMPLETED and auto-seeds
// approval objects server-side: partApproval (if partsUsed.length > 0) and
// workApproval (only when the category/subCategory requires it — D/E
// always, B/C only when subCategory is "Goodwill"). workApproval is what
// the Dashboard's SR Approvals list is keyed off, so a category that
// doesn't require approval will never show up there, by design.
export const finishServiceTask = async (
  token: string,
  taskId: string,
  // billingType: only sent when the picked subCategory is Breakdown/BIS —
  // not in the backend dev guide's documented /finish body, sent as a
  // best-effort extra field until the backend confirms/adds official
  // support for it.
  body: { category: string; subCategory: string; notes?: string; billingType?: string }
) => {
  try {
    const response = await axiosClient.put(`/api/service/${taskId}/finish`, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Finish Service Task Error:', error.response?.data || error.message);
    throw error;
  }
};

// Service counterpart of reassignCommissioningTask — same confirmed shape,
// POST /api/service with only { assignedToId }.
export const reassignServiceTask = async (token: string, assetId: string, assignedToId: string) => {
  try {
    const response = await axiosClient.post(
      '/api/service',
      { assetId, assignedToId },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Reassign Service Task Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getCommissioningTaskDetail = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.get(`/api/commissioning/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Task Detail Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getServiceTaskById = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.get(`/api/service/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Service Task Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getAssetById = async (token: string, assetId: string) => {
  try {
    const response = await axiosClient.get(`/api/assets/${assetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Asset Error:', error.response?.data || error.message);
    throw error;
  }
};

export const updateAsset = async (token: string, assetId: string, body: Record<string, any>) => {
  try {
    const response = await axiosClient.put(`/api/assets/${assetId}`, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Update Asset Error:', error.response?.data || error.message);
    throw error;
  }
};

// Roles: admin | rsm. Hard delete — not wired into any screen (this app's
// exercised roles are engineer/dealer/areaManager; admin has no dedicated
// UI in this app per AGENTS.md), implemented for completeness.
export const deleteAsset = async (token: string, assetId: string) => {
  try {
    const response = await axiosClient.delete(`/api/assets/${assetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Delete Asset Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getCommissioningProgress = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.get(`/api/commissioning/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Progress Error:', error.response?.data || error.message);
    throw error;
  }
};

export const saveCommissioningProgress = async (
  token: string,
  taskId: string,
  commissioningChecks: Record<string, string>
) => {
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/progress`,
      { commissioningChecks },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Save Progress Error:', error.response?.data || error.message);
    throw error;
  }
};

export const saveValidationProgress = async (
  token: string,
  taskId: string,
  validationChecks: Record<string, string>
) => {
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/progress`,
      { validationChecks },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Save Validation Progress Error:', error.response?.data || error.message);
    throw error;
  }
};

export const saveCommissioningReadings = async (
  token: string,
  taskId: string,
  readings: Record<string, any>
) => {
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/readings`,
      { readings },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Save Readings Error:', error.response?.data || error.message);
    throw error;
  }
};

export const getFaultCodes = async (token: string) => {
  const response = await axiosClient.get('/api/fault-codes', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const getParts = async (token: string) => {
  const response = await axiosClient.get('/api/parts', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.data;
};

export const saveStepProgress = async (token: string, taskId: string, body: object) => {
  const response = await axiosClient.put(
    `/api/commissioning/${taskId}/save-progress`,
    body,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};

export const generateCommissioningOtp = async (token: string, taskId: string) => {
  const response = await axiosClient.post(
    `/api/commissioning/${taskId}/otp/generate`,
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data; // { code: "1234" }
};

export const verifyCommissioningOtp = async (token: string, taskId: string, code: string) => {
  try {
    const response = await axiosClient.post(
      `/api/commissioning/${taskId}/otp/verify`,
      { code },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data; // { verified: true }
  } catch (error: any) {
    console.log('Verify OTP Error:', error.response?.data || error.message);
    throw error;
  }
};

// No status restriction — works on CLOSED entries too (unlike save-progress,
// which only accepts ASSIGNED/ACCEPTED/IN_PROGRESS). Called from the OTP
// sheet's own optional step 3, after the customer's OTP has already been
// verified.
export const saveCommissioningFeedback = async (
  token: string,
  taskId: string,
  data: { comment?: string; customerName?: string; rating?: number }
) => {
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/feedback`,
      data,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Save Commissioning Feedback Error:', error.response?.data || error.message);
    throw error;
  }
};

export const completeCommissioningTask = async (
  token: string,
  taskId: string,
  body: Record<string, any> = {}
) => {
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/complete`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Complete Task Error:', error.response?.data || error.message);
    throw error;
  }
};

// Roles: admin | rsm | area_manager. Moves COMPLETED → APPROVED. No body.
export const approveCommissioningTask = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/approve`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Approve Commissioning Task Error:', error.response?.data || error.message);
    throw error;
  }
};

// Roles: admin | rsm | dealer | area_manager. Moves APPROVED → CLOSED. No body.
export const closeCommissioningTask = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/close`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Close Commissioning Task Error:', error.response?.data || error.message);
    throw error;
  }
};

// Role: area_manager. Claim an unassigned entry. No body.
export const claimCommissioningTask = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.put(
      `/api/commissioning/${taskId}/claim`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Claim Commissioning Task Error:', error.response?.data || error.message);
    throw error;
  }
};

// Preview what SAP data would look like after commissioning a given asset.
export const getCommissioningSapPreview = async (token: string, assetId: string) => {
  try {
    const response = await axiosClient.get(
      `/api/commissioning/sap-preview?assetId=${encodeURIComponent(assetId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Get Commissioning SAP Preview Error:', error.response?.data || error.message);
    throw error;
  }
};

// Save GCS photo URLs after a direct upload — the primary upload path per
// the backend dev guide (uploadCommissioningPhotos below is the multipart
// fallback, kept as the app's currently-wired path since it already works
// end-to-end; this exists so the direct-GCS route is available too).
export const confirmCommissioningPhotos = async (token: string, taskId: string, gcsUrls: string[]) => {
  try {
    const response = await axiosClient.post(
      `/api/commissioning/${taskId}/photos/confirm`,
      { gcsUrls },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data; // { photos: [...] }
  } catch (error: any) {
    console.log('Confirm Commissioning Photos Error:', error.response?.data || error.message);
    throw error;
  }
};

export const uploadCommissioningPhotos = async (
  token: string,
  taskId: string,
  photos: { uri: string; fileName: string }[],
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
) => {
  const formData = new FormData();

  photos.forEach((photo, index) => {
    const fileName = photo.fileName || `photo_${index}.jpg`;
    const extMatch = fileName.match(/\.(\w+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
    // iOS HEIC captures (and any other extension we don't explicitly know)
    // fall back to a generic binary type rather than lying and calling them
    // image/jpeg — the bytes aren't actually JPEG, and mislabeling them can
    // trip content-type validation or corrupt downstream image processing.
    const mimeType =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'png' ? 'image/png' :
      ext === 'webp' ? 'image/webp' :
      'application/octet-stream';

    // React Native FormData expects this exact shape (uri/name/type)
    formData.append('photos', {
      uri: photo.uri,
      name: fileName,
      type: mimeType,
    } as any);
  });

  try {
    const response = await axiosClient.post(
      `/api/commissioning/${taskId}/photos`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: onProgress
          ? (event) => onProgress(event.total ? clampPercent(Math.round((event.loaded / event.total) * 100)) : 0)
          : undefined,
        signal,
      }
    );
    return response.data; // { photos: ["https://storage..."] }
  } catch (error: any) {
    // A user-initiated cancel (AbortSignal) isn't a real failure — don't log
    // it as one. Callers distinguish this via error.code, same check used
    // throughout the media-upload path (see useMediaUploadQueue.ts).
    if (error.code !== 'ERR_CANCELED') {
      console.log('Upload Photos Error:', error.response?.data || error.message);
    }
    throw error;
  }
};

export const saveServiceStepProgress = async (token: string, taskId: string, body: Record<string, any>) => {
  try {
    const response = await axiosClient.put(
      `/api/service/${taskId}/save-progress`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Save Service Step Progress Error:', error.response?.data || error.message);
    throw error;
  }
};

export const requestServiceWorkApproval = async (
  token: string,
  taskId: string,
  body: {
    category: string; subCategory: string;
    // Only sent by the SR Detail screen's Edit & Resubmit flow — a rejected
    // request being revised and resent, not the srTaskForm wizard's own
    // first-time request (which only ever sends category/subCategory, since
    // it already saved these separately via save-progress earlier).
    faultCodes?: { codeId: string; observation?: string; rootCause?: string; correctiveAction?: string }[];
    partsUsed?: { partId: string; quantity: number }[];
    notes?: string;
    // Only sent when subCategory is Breakdown/BIS — same best-effort extra
    // field as finishServiceTask's own billingType (not in the dev guide's
    // documented body, sent regardless until the backend confirms support).
    billingType?: string;
  }
) => {
  try {
    const response = await axiosClient.put(
      `/api/service/${taskId}/work-approval/request`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Request Work Approval Error:', error.response?.data || error.message);
    throw error;
  }
};

// The two work-approval decision steps — distinct from reviewServiceParts
// below (that's the separate partApproval gate). Only relevant for
// categories D/E (always) or B/C+Goodwill, once workApproval.status is
// PENDING_AM / PENDING_RSM respectively.
export const submitAmWorkApproval = async (
  token: string, taskId: string, decision: 'APPROVED' | 'REJECTED', note?: string
) => {
  try {
    const response = await axiosClient.put(
      `/api/service/${taskId}/work-approval/am-review`,
      { decision, note },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('AM Work Approval Review Error:', error.response?.data || error.message);
    throw error;
  }
};

// RSM's own decision values are CONFIRMED/REJECTED, not APPROVED/REJECTED
// like the AM step — confirmed against the API reference doc's
// work-approval/rsm-confirm body: { "decision": "CONFIRMED", ... }.
export const submitRsmWorkApproval = async (
  token: string, taskId: string, decision: 'CONFIRMED' | 'REJECTED', note?: string
) => {
  try {
    const response = await axiosClient.put(
      `/api/service/${taskId}/work-approval/rsm-confirm`,
      { decision, note },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('RSM Work Approval Confirm Error:', error.response?.data || error.message);
    throw error;
  }
};

// AM's own decision on individual pending parts — distinct from
// work-approval (am-review/rsm-confirm) above, which is a separate gate
// that only exists for categories D/E (always) or B/C+Goodwill. This is
// what srDetail.tsx's "Parts Awaiting Review" ✓/✗ buttons actually need.
export const reviewServiceParts = async (
  token: string,
  taskId: string,
  decisions: { partId: string; decision: 'APPROVED' | 'REJECTED'; reason?: string }[]
) => {
  try {
    const response = await axiosClient.put(
      `/api/service/${taskId}/parts/review`,
      { decisions },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Review Service Parts Error:', error.response?.data || error.message);
    throw error;
  }
};

export const uploadServicePhotos = async (
  token: string,
  taskId: string,
  photos: { uri: string; fileName: string }[],
  onProgress?: (percent: number) => void,
  signal?: AbortSignal
) => {
  const formData = new FormData();

  photos.forEach((photo, index) => {
    const fileName = photo.fileName || `photo_${index}.jpg`;
    const extMatch = fileName.match(/\.(\w+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
    // Same HEIC/unknown-extension fallback as uploadCommissioningPhotos —
    // don't mislabel non-JPEG bytes as image/jpeg.
    const mimeType =
      ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
      ext === 'png' ? 'image/png' :
      ext === 'webp' ? 'image/webp' :
      'application/octet-stream';

    formData.append('photos', {
      uri: photo.uri,
      name: fileName,
      type: mimeType,
    } as any);
  });

  try {
    const response = await axiosClient.post(
      `/api/service/${taskId}/photos`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: onProgress
          ? (event) => onProgress(event.total ? clampPercent(Math.round((event.loaded / event.total) * 100)) : 0)
          : undefined,
        signal,
      }
    );
    return response.data;
  } catch (error: any) {
    if (error.code !== 'ERR_CANCELED') {
      console.log('Upload Service Photos Error:', error.response?.data || error.message);
    }
    throw error;
  }
};

// Videos have no multipart fallback endpoint (unlike photos' POST
// /service/:id/photos) — per the backend dev guide, they only go through
// the two-step GCS direct-upload flow: get a signed uploadUrl, PUT the raw
// file bytes straight to GCS, then confirm the resulting gcsUrl with the
// backend. getGcsUploadUrl + putFileToGcsUrl + confirmServiceVideos below
// are that flow's three steps.
export const getGcsUploadUrl = async (
  token: string,
  folder: 'commissioning' | 'service' | 'service-videos' | 'profiles',
  filename: string,
  contentType: string,
  signal?: AbortSignal
) => {
  try {
    const response = await axiosClient.post(
      '/api/gcs/upload-url',
      { folder, filename, contentType },
      { headers: { Authorization: `Bearer ${token}` }, signal }
    );
    return response.data as { uploadUrl: string; gcsUrl: string };
  } catch (error: any) {
    if (error.code !== 'ERR_CANCELED') {
      console.log('Get GCS Upload URL Error:', error.response?.data || error.message);
    }
    throw error;
  }
};

// Plain XMLHttpRequest, not axiosClient/axios — uploadUrl is an absolute
// storage.googleapis.com URL with its own signed query string, so it must
// skip axiosClient's baseURL/JSON content-type defaults and its 401-refresh
// interceptor (which only makes sense for our own backend's tokens, not a
// GCS signature).
//
// Deliberately NOT fetch(fileUri).blob() + axios.put(blob, ...) — that
// route reads the whole file into JS memory and base64-encodes it across
// the RN bridge (the "Response.blob() is using React Native's Blob..."
// warning), which for a large video file can stall for a very long time or
// hang outright rather than just being "slow". Passing this
// { uri, type, name } shape straight to XHR.send() is React Native's own
// built-in file-upload path — it streams the file directly from disk on
// the native side and never materializes it as a JS Blob/base64 string at
// all, the same mechanism FormData.append(field, { uri, ... }) uses under
// the hood for multipart uploads (see uploadServicePhotos above), just
// applied to a raw (non-multipart) PUT body here instead.
// `signal` lets a caller abort the PUT mid-flight (see useMediaUploadQueue's
// Cancel button) — XHR has no native AbortSignal support, so this wires
// signal.abort straight to xhr.abort() itself. Per the XHR spec, calling
// abort() suppresses onload/onerror and fires onabort instead; the local
// `aborted` flag additionally guards against a same-tick race where an
// already-queued onload/onerror event could still fire after abort() was
// called. The rejected error is tagged name: 'AbortError' so callers can
// tell "user canceled" apart from a real network/server failure (see the
// same check in useMediaUploadQueue.ts and the other upload functions'
// error.code === 'ERR_CANCELED' check above).
const putFileToGcsUrl = (uploadUrl: string, fileUri: string, contentType: string, fileName: string, onProgress?: (percent: number) => void, signal?: AbortSignal): Promise<void> => {
  return new Promise((resolve, reject) => {
    const abortError = () => {
      const err: any = new Error('Upload canceled');
      err.name = 'AbortError';
      return err;
    };

    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const xhr = new XMLHttpRequest();
    let aborted = false;
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', contentType);
    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) onProgress(clampPercent(Math.round((event.loaded / event.total) * 100)));
      };
    }
    xhr.onload = () => {
      if (aborted) return;
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`GCS video upload failed with status ${xhr.status}`));
    };
    xhr.onerror = () => {
      if (aborted) return;
      reject(new Error('GCS video upload network error'));
    };
    xhr.onabort = () => {
      aborted = true;
      reject(abortError());
    };
    if (signal) {
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }
    xhr.send({ uri: fileUri, type: contentType, name: fileName } as any);
  });
};

const videoMimeType = (fileName: string): string => {
  const ext = (fileName.match(/\.(\w+)$/)?.[1] || 'mp4').toLowerCase();
  // PDFs from the SR form's Documents card deliberately ride this same
  // GCS-sign + confirm call as videos (same array, same URL mechanism —
  // not the photos multipart endpoint), so this needs to tag them
  // correctly too instead of mislabeling them video/mp4.
  if (ext === 'pdf') return 'application/pdf';
  return ext === 'mov' ? 'video/quicktime' : ext === 'webm' ? 'video/webm' : 'video/mp4';
};

// Uploads one file (video or PDF, either can ride this call — see
// videoMimeType) straight to GCS (folder: "service-videos"/"commissioning")
// and confirms it immediately after its own upload finishes — per the dev
// guide's own pitfall warning: confirming only on a final button tap loses
// URLs if the user exits mid-upload. Called once per item, directly by
// useMediaUploadQueue (each picked photo/video/PDF uploads immediately,
// not batched) — see uploadOneServiceVideoOrPdf/
// uploadOneCommissioningVideoOrPdf below, the thin per-kind wrappers around
// this. onProgress (0-100) covers just this one file. Logs its own outcome
// either way, so a failure shows WHICH file (a video? a PDF?) and WHICH of
// the 3 steps (get signed URL / PUT to GCS / confirm) actually failed.
async function uploadOneMediaFile(
  token: string,
  confirmUrl: string,
  folder: 'service-videos' | 'commissioning',
  file: { uri: string; fileName: string },
  index: number,
  total: number,
  logLabel: string,
  onFileProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  const contentType = videoMimeType(file.fileName);
  const kind = file.fileName.toLowerCase().endsWith('.pdf') ? 'PDF' : 'video';
  console.log(`[${logLabel}] ${index + 1}/${total} starting (${kind}):`, file.fileName);
  try {
    const { uploadUrl, gcsUrl } = await getGcsUploadUrl(token, folder, file.fileName, contentType, signal);
    await putFileToGcsUrl(uploadUrl, file.uri, contentType, file.fileName, onFileProgress, signal);
    // Don't confirm a GCS upload that was actually meant to be canceled —
    // the PUT above can resolve successfully in the brief window between
    // its own completion and the abort signal propagating.
    if (signal?.aborted) {
      const err: any = new Error('Upload canceled');
      err.name = 'AbortError';
      throw err;
    }
    await axiosClient.post(confirmUrl, { gcsUrls: [gcsUrl] }, { headers: { Authorization: `Bearer ${token}` }, signal });
    console.log(`[${logLabel}] ${index + 1}/${total} succeeded (${kind}):`, file.fileName);
    return gcsUrl;
  } catch (error: any) {
    if (error.name !== 'AbortError' && error.code !== 'ERR_CANCELED') {
      console.log(`[${logLabel}] ${index + 1}/${total} FAILED (${kind}):`, file.fileName, '— status:', error.response?.status, '— data:', error.response?.data || error.message);
    }
    throw error;
  }
}

// Single-item wrappers — used by useMediaUploadQueue.ts, which uploads one
// picked file at a time (not a batch) so real per-item progress and
// mid-batch cancellation both work. Replaces the old uploadServiceVideos/
// uploadCommissioningVideos batch-loop functions (which buried per-file
// failures inside an aggregate failedFileNames array — the queue hook needs
// to react between items, not after the whole batch finishes).
export const uploadOneServiceVideoOrPdf = (
  token: string, taskId: string, file: { uri: string; fileName: string },
  onProgress?: (percent: number) => void, signal?: AbortSignal
) => uploadOneMediaFile(token, `/api/service/${taskId}/videos/confirm`, 'service-videos', file, 0, 1, 'Service Media Upload', onProgress, signal);

// Commissioning has no dedicated videos/confirm route (confirmed via a live
// 404) — its one /photos/confirm endpoint accepts photo AND video/PDF
// gcsUrls both, which is why this still targets that URL despite the name.
export const uploadOneCommissioningVideoOrPdf = (
  token: string, taskId: string, file: { uri: string; fileName: string },
  onProgress?: (percent: number) => void, signal?: AbortSignal
) => uploadOneMediaFile(token, `/api/commissioning/${taskId}/photos/confirm`, 'commissioning', file, 0, 1, 'Commissioning Media Upload', onProgress, signal);

const photoMimeType = (fileName: string): string => {
  const ext = (fileName.match(/\.(\w+)$/)?.[1] || 'jpg').toLowerCase();
  // Same HEIC/unknown-extension fallback as the multipart upload helpers
  // above — don't mislabel non-JPEG bytes as image/jpeg.
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
};

// The primary photo-upload path per the backend dev guide (direct-to-GCS,
// then confirm) — not currently wired into the commissioning form's Save
// Photos action, which uses the multipart fallback (uploadCommissioningPhotos
// above) since that already works end-to-end. Available for either
// commissioning or service (folder is a parameter, unlike the
// video/photo-specific helpers above) so callers don't need a near-duplicate
// per entry kind. Same per-file-confirm-immediately pattern as
// uploadServiceVideos, for the same reason (don't lose already-uploaded
// URLs if the user exits mid-batch).
export const uploadPhotosViaGcs = async (
  token: string,
  kind: 'commissioning' | 'service',
  taskId: string,
  photos: { uri: string; fileName: string }[],
  onProgress?: (percent: number) => void
) => {
  const confirmedUrls: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    const fileName = photo.fileName || `photo_${confirmedUrls.length}.jpg`;
    const contentType = photoMimeType(fileName);
    const { uploadUrl, gcsUrl } = await getGcsUploadUrl(token, kind, fileName, contentType);
    await putFileToGcsUrl(uploadUrl, photo.uri, contentType, fileName, onProgress
      ? (filePercent) => onProgress(Math.round(((i * 100) + filePercent) / photos.length))
      : undefined);
    await axiosClient.post(
      `/api/${kind}/${taskId}/photos/confirm`,
      { gcsUrls: [gcsUrl] },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    confirmedUrls.push(gcsUrl);
  }
  return { photos: confirmedUrls };
};

// GCS is a private bucket — task.videos/task.photos come back as raw
// storage.googleapis.com URLs that 403 if rendered/played directly. This
// turns one of those raw URLs into the "path" /gcs/sign actually wants
// (everything after the bucket segment) — https://storage.googleapis.com/
// <bucket>/<path> → <path>.
export const gcsUrlToPath = (url: string): string => {
  const match = url.match(/^https?:\/\/storage\.googleapis\.com\/[^/]+\/(.+)$/);
  return match ? match[1] : url;
};

// Short-lived (15 min) signed read URL for a private GCS file — fetched
// fresh on each play tap per the dev guide's own rule ("don't cache it, it
// expires in 15 min"), never stored/reused across sessions.
export const getGcsSignedUrl = async (token: string, gcsUrl: string): Promise<string> => {
  const path = gcsUrlToPath(gcsUrl);
  try {
    const response = await axiosClient.post(
      '/api/gcs/sign',
      { paths: [path] },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data?.[path] || '';
  } catch (error: any) {
    console.log('Get GCS Signed URL Error:', error.response?.data || error.message);
    throw error;
  }
};

// Batch variant — one /gcs/sign round-trip for a whole gallery's worth of
// raw URLs (photos, or photos+videos together) instead of one call per
// item, per the backend dev guide's own "batch-sign the whole gallery"
// rule. Returns a map keyed by the ORIGINAL raw url (not the bucket path)
// so callers can look a signed url up by whatever they already have.
export const getGcsSignedUrls = async (token: string, gcsUrls: string[]): Promise<Record<string, string>> => {
  if (gcsUrls.length === 0) return {};
  const paths = gcsUrls.map(gcsUrlToPath);
  try {
    const response = await axiosClient.post(
      '/api/gcs/sign',
      { paths },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const byPath: Record<string, string> = response.data || {};
    const byRawUrl: Record<string, string> = {};
    gcsUrls.forEach((rawUrl, i) => { byRawUrl[rawUrl] = byPath[paths[i]] || rawUrl; });
    return byRawUrl;
  } catch (error: any) {
    console.log('Get GCS Signed URLs (batch) Error:', error.response?.data || error.message);
    throw error;
  }
};

export const generateServiceOtp = async (token: string, taskId: string) => {
  try {
    const response = await axiosClient.post(
      `/api/service/${taskId}/otp/generate`,
      {},
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data; // { code: "1234" }
  } catch (error: any) {
    console.log('Generate Service OTP Error:', error.response?.data || error.message);
    throw error;
  }
};

export const verifyServiceOtp = async (token: string, taskId: string, code: string) => {
  try {
    const response = await axiosClient.post(
      `/api/service/${taskId}/otp/verify`,
      { code },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    // Per the backend dev guide: the full updated entry, with
    // status === 'CLIENT_APPROVED' and completionOtp.verified === true —
    // not just a bare { verified: true } ack.
    return response.data;
  } catch (error: any) {
    console.log('Verify Service OTP Error:', error.response?.data || error.message);
    throw error;
  }
};

export const completeServiceTask = async (token: string, taskId: string, body: Record<string, any> = {}) => {
  try {
    const response = await axiosClient.put(
      `/api/service/${taskId}/complete`,
      body,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return response.data;
  } catch (error: any) {
    console.log('Complete Service Task Error:', error.response?.data || error.message);
    throw error;
  }
};

// Looks up city/district/state/post-office for a 6-digit Indian PIN code —
// called automatically once the Create Asset screen's PIN Code field
// reaches 6 digits. Returns null (not an error) when the PIN isn't found.
//
// Uses `search`, not `pincode` — per the backend dev guide, /location-master
// only documents search/state/district as valid query params (pincode isn't
// one of them). The guide also describes this as returning a filtered
// *list*, not a single record — the caller (createAssetCommissionController)
// unwraps the first match rather than assuming a bare object shape.
export const getLocationMaster = async (token: string, pincode: string) => {
  try {
    const response = await axiosClient.get(`/api/location-master?search=${encodeURIComponent(pincode)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Get Location Master Error:', error.response?.data || error.message);
    throw error;
  }
};

// Creates a new Asset — the Create Asset screen's "Confirm & Create". When
// a SAP commissioning date is present and dispatch-eligible (auto/
// revalidation dispatchType), the caller also includes the
// sapCommissioningDate/commissioningType/commissioningEntryDate/
// commissioningNotes fields so the server auto-creates the matching
// commissioning entry in this same request.
export const createAsset = async (token: string, body: Record<string, any>) => {
  try {
    const response = await axiosClient.post('/api/assets', body, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
  } catch (error: any) {
    console.log('Create Asset Error:', error.response?.data || error.message);
    throw error;
  }
};
