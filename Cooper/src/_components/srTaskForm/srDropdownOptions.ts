export const ENGINE_TYPE_OPTIONS = ['TC 3000', 'NA 3000', 'TC 1500', 'NA 1500', 'Other'];

export const ENGINE_FAMILY_OPTIONS = [
  'Cyl', 'V Twin', '3Cycl Bosch', '3 Cyl Stanadyne',
  '4 Cyl 4.5 Ltr', '6 Cyl 6.8 Ltr', '6 Cyl 7.8 Ltr',
  'Escort Kubota', 'VECV',
];

export const SERVICE_CATEGORIES = [
  {
    letter: 'A',
    name: 'Free Service',
    subCategories: ['First Free Service', 'Second Free Service', 'Third Free Service', 'Fourth Free Service'],
    bg: '#DBEAFE', border: '#93C5FD', text: '#1D4ED8',
  },
  {
    letter: 'B',
    name: 'Warranty Repair',
    subCategories: ['Breakdown', 'BIS', 'Goodwill', 'Campaign'],
    bg: '#FEE2E2', border: '#FCA5A5', text: '#DC2626',
  },
  {
    letter: 'C',
    name: 'Paid Service',
    subCategories: ['Under Warranty', 'Out of Warranty', 'PM Service', 'Breakdown', 'Goodwill', 'Accidental Repair'],
    bg: '#DCFCE7', border: '#86EFAC', text: '#16A34A',
  },
  {
    letter: 'D',
    name: 'AMC',
    subCategories: ['AMC Visit', 'PM Service', 'Diesel Filling Rental Genset', 'Breakdown'],
    bg: '#F3E8FF', border: '#D8B4FE', text: '#7E22CE',
  },
  {
    letter: 'E',
    name: 'CAMC',
    subCategories: ['AMC In Scope', 'AMC Out Of Scope', 'Breakdown', 'Demonstration', 'PM Service'],
    bg: '#E0E7FF', border: '#C7D2FE', text: '#4338CA',
  },
  {
    letter: 'F',
    name: 'Campaign',
    subCategories: ['Genset', 'Engine', 'Alternator', 'Control System'],
    bg: '#FFEDD5', border: '#FDBA74', text: '#C2410C',
  },
  {
    letter: 'G',
    name: 'Other',
    subCategories: [
      'Load Calculation & Site Inspection', 'Installation', 'Demonstration & Load Trial',
      'Shifting', 'Rental Diesel Filling', 'CCPL Inhouse',
    ],
    bg: '#F3F4F6', border: '#D1D5DB', text: '#374151',
  },
];

export const FUEL_TYPE_OPTIONS = ['Diesel', 'CNG', 'LNG', 'LPG', 'PNG', 'Biogas'];

export const APPLICATION_OPTIONS = [
  'Genset', 'G-Drive', 'Fire Pump', 'Marine', 'APU',
  'Pump Set', 'Tractor', 'Compressor', 'Lighting Tower',
];

export const PHASE_OPTIONS = ['Single Phase', 'Three Phase'];

export const PANEL_TYPE_OPTIONS = ['STD', 'ASAS', 'AMF', 'SYNC'];

export const CPCB_NORM_OPTIONS = ['CPCB I', 'CPCB II', 'CPCB IV+'];

export const TYPE_OF_SERVICE_OPTIONS = ['Warranty', 'Paid'];

export const WARRANTY_STATUS_OPTIONS = ['Under Warranty', 'Out of Warranty'];