// ─── Commissioning Records (list screen) ───
export type RecordStatus = 'Active' | 'Completed' | 'Closed';

// Raw asset shape from GET /api/assets — only the fields this app uses.
export type CommissioningAsset = {
  _id: string;
  gensetNumber: string;
  engineNumber: string;
  dispatchDate: string; // ISO
  assetStatus?: 'not_dispatched' | 'dispatched' | 'commissioned' | 'revalidated' | string;
};

// Response shape from GET /api/commissioning/available-actions?assetId=:id
export type AvailableActionsResponse = {
  assetStatus: string;
  windowStart: string; // ISO
  windowEnd: string; // ISO
  daysLeft: number;
  actions: { action: string; label: string; description: string; available: boolean }[];
};

// ─── Completed tab (grouped by asset) ───
// A single completed commissioning task from GET /api/me/tasks?status=completed.
export type CompletedCommissioningActivity = {
  taskId: string;
  type: string; // PRE_COMMISSIONING | COMMISSIONING | REVALIDATION | RE_COMMISSIONING
  task: any; // full raw task object, handed to the taskReport screen as-is
};

// Multiple completed tasks can share the same assetId — grouped into one
// card per physical asset, matching the reference "Activities" column.
export type CompletedAssetGroup = {
  assetId: string;
  gensetNumber: string;
  engineNumber: string;
  gensetModel?: string;
  kva?: string | null;
  dispatchDate?: string;
  activities: CompletedCommissioningActivity[];
};

// ─── New Commissioning (search / detail screen) ───
// Shape returned by GET /api/assets/search?q=... — only the fields this
// screen displays.
export type CommissioningAssetSearchResult = {
  _id: string;
  gensetNumber: string;
  engineNumber: string;
  gensetModel?: string | null;
  alternatorMake?: string | null;
  alternatorModel?: string | null;
  engineModel?: string | null;
  alternatorSerialNumber?: string | null;
  phase?: string | null;
  batterySerialNumber?: string | null;
  controlPanelSerialNumber?: string | null;
  atsSerialNumber?: string | null;
  dispatchDate?: string;
  clientName?: string | null;
  clientCode?: string | null;
  address?: {
    line1?: string; line2?: string; locality?: string; city?: string;
    taluk?: string; district?: string; state?: string; pinCode?: string; country?: string;
  } | null;
  kva?: string | null;
  cpcb?: string | null;
};

// ─── New Job — SAP fallback (no Asset exists yet for this genset) ───
// Shape returned by GET /api/genset-sap-assets/search?q=... — searched only
// once /api/assets/search comes back empty.
export type GensetSapAsset = {
  _id: string;
  srNo: number;
  billingDate?: string;
  invoiceNumber?: string;
  gensetSerialNo: string;
  engineSerialNo?: string;
  gensetRating?: string; // e.g. "20 KVA"
  cpcbStage?: string; // e.g. "CPCB II"
  materialNo?: string;
  materialDescription?: string;
  shipToParty?: string; // client code
  shipToPartyName?: string; // client name
  endCustomerDetails?: string; // single pre-formatted address string
  pin?: string;
  cityTQ?: string;
  district?: string;
  state?: string;
  zone?: string;
  customerSegment?: string;
  commissioningDate?: string;
};

// ─── New Job (asset detail screen) ───
// Full shape from GET /api/assets/:id — a superset of the search result
// above (same identifying/model fields) plus the contact details and past-
// activity history the search result doesn't carry.
export type AssetDetail = CommissioningAssetSearchResult & {
  primaryContactName?: string | null;
  primaryContactNumber?: string | null;
  alternateContactNumber?: string | null;
  // Only present once this asset's commissioning task has actually been
  // completed — absent (not just falsy) means no commissioning has ever
  // been done on it.
  completedAt?: string | null;
  // Confirmed real field on GET /api/assets/:id — 'commissioned' once a
  // commissioning task has been completed on this asset, something else
  // (e.g. 'pending') otherwise. New Service Job gates on this (not
  // completedAt above): raising an SR for an asset that isn't commissioned
  // yet isn't a valid flow.
  assetStatus?: string | null;
  commissionedBy?: { userId?: string; name?: string; role?: string } | null;
  history?: {
    _id?: string; type: string; date?: string; status?: string; srNumber?: string;
    assignedTo?: { name: string; userId?: string; profilePic?: string | null };
  }[];
};
