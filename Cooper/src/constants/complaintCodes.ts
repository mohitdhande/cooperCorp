import { ComplaintCategoryDef, Priority } from '@/models/taskForm.types';

export const COMPLAINT_CATEGORIES: ComplaintCategoryDef[] = [
 {
    name: 'AMC',
    subcategories: [
      {
        name: 'AMC Visit',
        codes: [
          { code: 'AMC001', priority: 'P4', title: 'AMC Visit' },
          { code: 'AMC002', priority: 'P4', title: 'AMC Visit Retail Dealer Scope' },
        ],
      },
    ],
  },
  {
    name: 'Battery & Accessories',
    subcategories: [
      {
        name: 'Battery',
        codes: [
          { code: 'EBR001', priority: 'P2', title: 'Battery Failed / Discharge' },
          { code: 'EBR002', priority: 'P1', title: 'Battery Cable Short' },
          { code: 'GSP011', priority: 'P2', title: 'Battery Terminal Loose / Battery Low' },
        ],
      },
      {
        name: 'Canopy & Base Frame',
        codes: [
          { code: 'GCQ006', priority: 'P3', title: 'Canopy Rusting Issue' },
          { code: 'GCQ011', priority: 'P1', title: 'Genset Caught Fire' },
          { code: 'GCQ014', priority: 'P1', title: 'Genset Replacement' },
        ],
      },
      {
        name: 'Diesel Tank',
        codes: [
          { code: 'GCQ012', priority: 'P2', title: 'Diesel Leakage From Tank Drain Plug' },
          { code: 'GFT001', priority: 'P1', title: 'Fuel Leakage From Tank' },
        ],
      },
    ],
  },
  {
    name: 'Electrical',
    subcategories: [
      {
        name: 'AMF Panel',
        codes: [
          { code: 'AMF001', priority: 'P1', title: 'AMF Mode Not Working' },
          { code: 'AMF004', priority: 'P1', title: 'Mains Contactor Failed' },
          { code: 'AMF011', priority: 'P1', title: 'AMF Control Panel Burnt' },
        ],
      },
      {
        name: 'Control Panel',
        codes: [
          { code: 'GSP007', priority: 'P1', title: 'DG Controller Failure / Setting Disturb' },
          { code: 'GSP015', priority: 'P1', title: 'SPU Burnt / Not Working' },
          { code: 'GSP084', priority: 'P1', title: 'DSE Controller Failure' },
        ],
      },
      {
        name: 'Engine Electrical',
        codes: [
          { code: 'GSP018', priority: 'P1', title: 'ECU Failed' },
          { code: 'GSP019', priority: 'P1', title: 'Starter Failed' },
          { code: 'GSP024', priority: 'P2', title: 'Charging Alternator Failure' },
        ],
      },
      {
        name: 'Main Alternator',
        codes: [
           { code: 'GMA001', priority: 'P1', title: 'No Output From Main Alternator' },
          { code: 'GMA002', priority: 'P2', title: 'AVR Failure' },
          { code: 'GMA004', priority: 'P1', title: 'Over Voltage' },// TODO: add the 3 codes for Main Alternator here
        ],
      },
    ],
  },
  {
    name: 'Engine',
    subcategories: [
      {
        name: 'Block & Cylinder Head',
        codes: [
          { code: 'BBP003', priority: 'P1', title: 'Crankshaft Damage' },
          { code: 'BBP006', priority: 'P1', title: 'Piston Failed' },
          { code: 'EHG001', priority: 'P1', title: 'Head Gasket Failed' },
        ],
      },
      {
        name: 'Cooling System',
        codes: [
          { code: 'ECS001', priority: 'P2', title: 'Cooling System Not Ok / Chock' },
          { code: 'ECS004', priority: 'P2', title: 'Radiator Leakage' },
          { code: 'ECS015', priority: 'P2', title: 'Radiator Fan Damage' },
          { code: 'ECS028', priority: 'P2', title: 'Thermostat Valve Not Working' },
          { code: 'GSP119', priority: 'P1', title: 'High Coolant Temperature' },
        ],
      },
      {
        name: 'EATS System',
        codes: [
          { code: 'ATS001', priority: 'P2', title: 'Ambient Temp Sensor Fail' },
          { code: 'ATS005', priority: 'P1', title: 'Urea Supply Module Fail' },
          { code: 'ATS012', priority: 'P1', title: 'ATS Choked / Fail' },
        ],
      },
      {
        name: 'Exhaust System',
        codes: [
          { code: 'ECS031', priority: 'P2', title: 'EGR Cooler Leakage' },
          { code: 'GSP043', priority: 'P2', title: 'EGR Pipe Crack' },
          { code: 'GSP062', priority: 'P2', title: 'Exhaust Piping Damage' },
        ],
      },
      {
        name: 'Fuel System',
        codes: [
          { code: 'EFI001', priority: 'P2', title: 'Fuel System Issue' },
          { code: 'EFI006', priority: 'P1', title: 'Injector Failure Delphi' },
          { code: 'EFI018', priority: 'P1', title: 'Motorpal Fuel Pump Not Working' },
          { code: 'EFI028', priority: 'P1', title: 'Fuel Leakage From Fuel Line' },
          { code: 'EFI029', priority: 'P2', title: 'Fuel Filter Bracket Broken' },
        ],
      },
      {
        name: 'Gas Train System',
        codes: [
          { code: 'GSP034', priority: 'P1', title: 'Starting Problem, Spark Plug Failure' },
        ],
      },
      {
        name: 'Intake System',
        codes: [
          { code: 'AIS001', priority: 'P2', title: 'CAC Hose Leakage' },
          { code: 'AIS002', priority: 'P2', title: 'CAC / Radiator Chocked' },
          { code: 'AIS003', priority: 'P1', title: 'Turbo Charger Failed' },
          { code: 'AIS004', priority: 'P1', title: 'Turbo Red Hot' },
          { code: 'AIS005', priority: 'P2', title: 'CAC Leakage / Damage' },
        ],
      },
      {
        name: 'Lubrication System',
        codes: [
          { code: 'ELS001', priority: 'P2', title: 'Oil Leakage From Lubrication System' },
          { code: 'ELS012', priority: 'P1', title: 'Low Lub Oil' },
          { code: 'ELS021', priority: 'P1', title: 'Oil Pressure Drop' },
          { code: 'ELS029', priority: 'P1', title: 'Oil Pump Failure' },
          { code: 'EPQ003', priority: 'P1', title: 'Dilution, Coolant Mixed In Oil' },
        ],
      },
      {
        name: 'Valve Train',
        codes: [
          { code: 'GSP010', priority: 'P1', title: 'Starting Problem Camshaft Failure' },
          { code: 'RSA001', priority: 'P2', title: 'Rocker Arm Boot Broken' },
        ],
      },
    ],
  },
  {
    name: 'General',
    subcategories: [
      {
        name: 'Inspection',
        codes: [
          { code: 'GCV001', priority: 'P3', title: 'General Inspection' },
          { code: 'GCV002', priority: 'P3', title: 'Load Calculation' },
          { code: 'GCV006', priority: 'P2', title: 'Campaign Work' },
          { code: 'HOTO001', priority: 'P3', title: 'Site Handover Takeover' },
        ],
      },
      {
        name: 'Installation',
        codes: [
          { code: 'GIC001', priority: 'P3', title: 'Installation Commissioning New Set' },
          { code: 'GIC001A', priority: 'P3', title: 'Reinstallation' },
          { code: 'GIC002', priority: 'P3', title: 'Recommissioning' },
        ],
      },
    ],
  },

    // ... paste the entire array verbatim from AMC through General/Installation
];

export const countCategoryCodes = (cat: ComplaintCategoryDef): number =>
  cat.subcategories.reduce((sum, sg) => sum + sg.codes.length, 0);

export const PRIORITY_COLORS: Record<Priority, { bg: string; text: string }> = {
  P1: { bg: '#FEE2E2', text: '#DC2626' },
  P2: { bg: '#FFEDD5', text: '#C2410C' },
  P3: { bg: '#DBEAFE', text: '#1D4ED8' },
  P4: { bg: '#F3F4F6', text: '#6B7280' },
};