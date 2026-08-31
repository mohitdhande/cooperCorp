// Shared asset dropdown options used by both the Commissioning and SR task forms.
export const ENGINE_TYPE_OPTIONS = ['TC 3000', 'NA 3000', 'TC 1500', 'NA 1500', 'Other'];

export const ENGINE_FAMILY_OPTIONS = [
  'Single cylinder', 'V Twin', '2 cylinder CRDI', '2 cylinder MECH',
  '3 cylinder Bosch', '3 cylinder stanadyne',
  '4 cylinder 4.5 Ltr', '6 cylinder 6.8 Ltr', '6 cylinder 7.8 Ltr',
  'Escort Kubota', 'VECV',
];

export const FUEL_TYPE_OPTIONS = ['Diesel', 'CNG', 'LNG', 'LPG', 'PNG', 'Biogas'];

export const APPLICATION_OPTIONS = [
  'Genset', 'G-Drive', 'Fire Pump', 'Marine', 'APU',
  'Pump Set', 'Compressor', 'Lighting Tower', 'Other'
];

export const PHASE_OPTIONS = ['Single Phase', 'Three Phase'];

export const PANEL_TYPE_OPTIONS = ['STD', 'ASAS', 'AMF', 'SYNC'];

export const CPCB_NORM_OPTIONS = ['CPCB II', 'CPCB IV+'];

// New Service Request's "Financing Bank" field — only shown for the two
// Cooper-managed AMC/CAMC categories (letters D/E), which are the ones
// financed through a bank tie-up rather than paid directly by the customer.
export const FINANCING_BANK_OPTIONS = [
  'HDFC Bank', 'ICICI Bank', 'IndusInd Bank', 'IDBI Bank',
  'IDFC Bank', 'Jana Bank', 'Reliance Retail Ltd',
];

// New Service Request's "Category" field — a flat, grouped taxonomy (group
// header + leaf item) distinct from SERVICE_CATEGORIES below (which covers
// complaint/fault codes, not the job's own category). Request body sends
// group as `category` and the tapped leaf as `subCategory`.
export const SERVICE_REQUEST_CATEGORY_GROUPS: { group: string; items: string[] }[] = [
  { group: 'General', items: ['Free Service'] },
  { group: 'Standard', items: ['Warranty Repair', 'Out Of Warranty'] },
  { group: 'AMC / CAMC', items: ['AMC (Annual Maintenance Contract)', 'CAMC (Comprehensive AMC)'] },
  { group: 'Special', items: ['Campaign', 'Other'] },
];

// Category badge colors used on the SR task report screen. `description`
// is the one-liner shown in the New Service Request form's info card once
// a category is picked. `subCategoryAtStep6` marks the 4 categories whose
// specific sub-type isn't known yet at creation time — the engineer picks
// it later, at the SR form's Step 6 category/sub-type selection — so the
// New Service Request form skips asking for Sub-category up front for these.
export const SERVICE_CATEGORIES = [
  {
    letter: 'A',
    name: 'Free Service',
    subCategories: ['First Free Service', 'Second Free Service', 'Third Free Service', 'Fourth Free Service'],
    bg: '#DBEAFE', border: '#93C5FD', text: '#1D4ED8',
    description: 'Scheduled free maintenance covered under warranty at predefined service intervals.',
  },
  {
    letter: 'B',
    name: 'Warranty Repair',
    subCategories: ['Breakdown', 'BIS', 'Goodwill', 'Campaign'],
    bg: '#FEE2E2', border: '#FCA5A5', text: '#DC2626',
    description: 'Repairs for defects or failures within the warranty period. Sub-type is confirmed by the engineer at completion.',
    subCategoryAtStep6: true,
  },
  {
    letter: 'C',
    name: 'Out Of Warranty',
    subCategories: ['PM Service', 'Breakdown', 'Goodwill', 'Accidental Repair'],
    bg: '#DCFCE7', border: '#86EFAC', text: '#16A34A',
    description: 'Paid maintenance and repair services for assets beyond their warranty period.',
    subCategoryAtStep6: true,
  },
  {
    letter: 'D',
    name: 'Cooper AMC',
    subCategories: ['AMC Visit', 'PM Service', 'Diesel Filling Rental Genset', 'Breakdown'],
    bg: '#F3E8FF', border: '#D8B4FE', text: '#7E22CE',
    description: 'Preventive and corrective maintenance under a Cooper-managed Annual Maintenance Contract.',
    subCategoryAtStep6: true,
  },
  {
    letter: 'E',
    name: 'Cooper CAMC',
    subCategories: ['AMC In Scope', 'AMC Out Of Scope', 'Breakdown', 'Demonstration', 'PM Service'],
    bg: '#E0E7FF', border: '#C7D2FE', text: '#4338CA',
    description: 'Comprehensive AMC covering parts and labour, managed by Cooper — all in-scope repairs are included.',
    subCategoryAtStep6: true,
  },
  {
    letter: 'F',
    name: 'Campaign',
    subCategories: ['Genset', 'Engine', 'Alternator', 'Control System'],
    bg: '#FFEDD5', border: '#FDBA74', text: '#C2410C',
    description: 'Factory-issued service campaigns and product improvement programs.',
  },
  {
    letter: 'G',
    name: 'Other',
    subCategories: [
      'Load Calculation & Site Inspection', 'Installation', 'Demonstration & Load Trial',
      'Shifting', 'Rental Diesel Filling', 'CCPL Inhouse',
    ],
    bg: '#F3F4F6', border: '#D1D5DB', text: '#374151',
    description: 'Site work that falls outside the standard service categories above.',
  },
  {
    letter: 'H',
    name: 'Dealer AMC',
    subCategories: ['AMC Visit', 'PM Service', 'Diesel Filling Rental Genset', 'Breakdown'],
    bg: '#EDE9FE', border: '#C4B5FD', text: '#6D28D9',
    description: 'Preventive and corrective maintenance under a Dealer-managed Annual Maintenance Contract.',
    subCategoryAtStep6: true,
  },
  {
    letter: 'I',
    name: 'Dealer CAMC',
    subCategories: ['AMC In Scope', 'AMC Out Of Scope', 'Breakdown', 'Demonstration', 'PM Service'],
    bg: '#CFFAFE', border: '#67E8F9', text: '#0E7490',
    description: 'Comprehensive AMC covering parts and labour, managed by the dealer.',
    subCategoryAtStep6: true,
  },
];

// New Service Request's own per-category display metadata — colors,
// description, and the Sub-category-deferred-to-Step-6 flag. Kept separate
// from SERVICE_CATEGORIES above (title/subCategories for that array come
// from the live GET /api/service/category-config instead, which is the
// real source of truth for the taxonomy itself; this map only supplies
// what that endpoint doesn't return).
export const SERVICE_CATEGORY_META: Record<string, {
  bg: string; border: string; text: string; description: string; subCategoryAtStep6?: boolean;
}> = {
  A: {
    bg: '#DBEAFE', border: '#93C5FD', text: '#1D4ED8',
    description: 'Scheduled free maintenance covered under warranty at predefined service intervals.',
  },
  B: {
    bg: '#FEE2E2', border: '#FCA5A5', text: '#DC2626',
    description: 'Repairs for defects or failures within the warranty period. Sub-type is confirmed by the engineer at completion.',
    subCategoryAtStep6: true,
  },
  C: {
    bg: '#DCFCE7', border: '#86EFAC', text: '#16A34A',
    description: 'Paid maintenance and repair services for assets beyond their warranty period.',
    subCategoryAtStep6: true,
  },
  D: {
    bg: '#F3E8FF', border: '#D8B4FE', text: '#7E22CE',
    description: 'Preventive and corrective maintenance under a Cooper-managed Annual Maintenance Contract.',
    subCategoryAtStep6: true,
  },
  E: {
    bg: '#E0E7FF', border: '#C7D2FE', text: '#4338CA',
    description: 'Comprehensive AMC covering parts and labour, managed by Cooper — all in-scope repairs are included.',
    subCategoryAtStep6: true,
  },
  F: {
    bg: '#FFEDD5', border: '#FDBA74', text: '#C2410C',
    description: 'A manufacturer-initiated field campaign to inspect or retrofit a specific component.',
  },
  G: {
    bg: '#F3F4F6', border: '#D1D5DB', text: '#374151',
    description: 'Site work that falls outside the standard service categories above.',
  },
  H: {
    bg: '#EDE9FE', border: '#C4B5FD', text: '#6D28D9',
    description: 'Preventive and corrective maintenance under a Dealer-managed Annual Maintenance Contract.',
    subCategoryAtStep6: true,
  },
  I: {
    bg: '#CFFAFE', border: '#67E8F9', text: '#0E7490',
    description: 'Comprehensive AMC covering parts and labour, managed by the dealer.',
    subCategoryAtStep6: true,
  },
};
