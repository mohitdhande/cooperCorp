// ─── Site Photos (Step 6) ───
export type SitePhoto = {
  id: string;
  uri: string;
  fileName: string;
};

// ─── Parts (Step 4) ───
export type Part = {
  code: string;
  name: string;
  unit: string; // 'Nos', 'Set', 'Litre', 'Pkt', 'Roll'
  category: string;
};

// export type SelectedPart = {
//   code: string;
//   name: string;
//   unit: string;
//   quantity: number;
// };

// ─── Generic Check Items (Step 2, 5) ───
export type CheckItemStatus = 'OK' | 'NOT_OK' | 'NA' | null;

export type CheckItem = {
  id: string;
  question: string;
  hasNA: boolean;
  status: CheckItemStatus;
  issueDescription: string;
  itemSaved: boolean;
  editingComment: boolean;
};

export type NumericField = { id: string; label: string; value: string };

export type NumericGroupItem = {
  id: string;
  title: string;
  subGroups: { label: string; fields: NumericField[] }[];
  saved: boolean;
};

export type TextItem = {
  id: string;
  label: string;
  value: string;
};

export type LoadStage = {
  id: string;
  label: string;
  duration: string;
  loadAmps: { r: string; y: string; b: string };
  voltageVolts: { r: string; y: string; b: string };
  freqHz: string;
  batteryV: string;
  remarks: string;
  saved: boolean;
};

// ─── Complaint Codes (Step 3) ───
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

export type ComplaintCodeDef = {
  code: string;
  priority: Priority;
  title: string;
};

export type ComplaintSubcategoryDef = {
  name: string;
  codes: ComplaintCodeDef[];
};

export type ComplaintCategoryDef = {
  name: string;
  subcategories: ComplaintSubcategoryDef[];
};

// export type SelectedComplaintCode = {
//   uid: string;
//   categoryName: string;
//   subcategoryName: string;
//   code: string;
//   priority: Priority;
//   title: string;
//   observation: string;
//   rootCause: string;
// };

export type PickerLevel =
  | { level: 'categories' }
  | { level: 'subcategories'; category: ComplaintCategoryDef }
  | { level: 'codes'; category: ComplaintCategoryDef; subcategory: ComplaintSubcategoryDef };

  // API-sourced fault code (from /api/fault-codes)
export type ApiFaultCode = {
  _id: string;
  code: string;
  description: string;
  category: string;
  subCategory: string;
  priority: Priority;
};

// API-sourced part (from /api/parts)
export type ApiPart = {
  _id: string;
  code: string;
  name: string;
  unit: string;
  category: string;
  subCategory: string;
};

// Update SelectedComplaintCode to include codeId for API
export type SelectedComplaintCode = {
  uid: string;
  codeId: string;        // ← the _id from /api/fault-codes
  categoryName: string;
  subcategoryName: string;
  code: string;
  priority: Priority;
  title: string;
  observation: string;
  rootCause: string;
};

// Update SelectedPart to include partId for API
export type SelectedPart = {
  partId: string;        // ← the _id from /api/parts
  code: string;
  name: string;
  unit: string;
  category: string;
  subCategory: string;
  quantity: number;
};