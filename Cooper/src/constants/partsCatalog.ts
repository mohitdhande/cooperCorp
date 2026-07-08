import { Part } from '@/models/taskForm.types';

export const PARTS_CATALOG: Part[] = [
  // ALTERNATOR
  { code: 'AL-001', name: 'AVR (Auto Voltage Regulator)', unit: 'Nos', category: 'ALTERNATOR › VOLTAGE REGULATION' },
   { code: 'AL-002', name: 'Alternator Bearing (DE)', unit: 'Nos', category: 'ALTERNATOR › BEARINGS' },
  { code: 'AL-003', name: 'Alternator Bearing (NDE)', unit: 'Nos', category: 'ALTERNATOR › BEARINGS' },
  { code: 'AL-004', name: 'Exciter Diode Kit', unit: 'Set', category: 'ALTERNATOR › RECTIFIER' },
  { code: 'AL-005', name: 'Stator Winding', unit: 'Nos', category: 'ALTERNATOR › WINDINGS' },
  { code: 'AL-006', name: 'Rotor Assembly', unit: 'Nos', category: 'ALTERNATOR › WINDINGS' },

  // CONSUMABLES
  { code: 'CN-001', name: 'Gasket Maker / RTV Sealant', unit: 'Nos', category: 'CONSUMABLES › SEALANTS & ADHESIVES' },
  { code: 'CN-002', name: 'Teflon Tape', unit: 'Roll', category: 'CONSUMABLES › SEALANTS & ADHESIVES' },
  { code: 'CN-003', name: 'Hose Clamp Assorted', unit: 'Set', category: 'CONSUMABLES › FASTENERS' },
  { code: 'CN-004', name: 'Bolt & Nut Kit', unit: 'Set', category: 'CONSUMABLES › FASTENERS' },
  { code: 'CN-005', name: 'Cable Ties', unit: 'Pkt', category: 'CONSUMABLES › FASTENERS' },

  // ELECTRICAL
  { code: 'EL-001', name: 'Battery 12V', unit: 'Nos', category: 'ELECTRICAL › BATTERY & CHARGING' },
  { code: 'EL-002', name: 'Battery 24V', unit: 'Nos', category: 'ELECTRICAL › BATTERY & CHARGING' },
  { code: 'EL-003', name: 'Alternator Charging', unit: 'Nos', category: 'ELECTRICAL › BATTERY & CHARGING' },
  { code: 'EL-004', name: 'Starter Motor', unit: 'Nos', category: 'ELECTRICAL › STARTING SYSTEM' },
  { code: 'EL-005', name: 'Starter Relay', unit: 'Nos', category: 'ELECTRICAL › STARTING SYSTEM' },
  { code: 'EL-006', name: 'Glow Plug', unit: 'Nos', category: 'ELECTRICAL › STARTING SYSTEM' },
  { code: 'EL-007', name: 'Control Panel PCB', unit: 'Nos', category: 'ELECTRICAL › CONTROL PANEL' },
  { code: 'EL-008', name: 'AMF Controller', unit: 'Nos', category: 'ELECTRICAL › CONTROL PANEL' },
  { code: 'EL-009', name: 'Wiring Harness', unit: 'Nos', category: 'ELECTRICAL › WIRING' },
  { code: 'EL-010', name: 'Fuse Kit Assorted', unit: 'Set', category: 'ELECTRICAL › WIRING' },

  // SENSORS & SWITCHES
  { code: 'SS-001', name: 'Oil Pressure Sensor', unit: 'Nos', category: 'ELECTRICAL › SENSORS & SWITCHES' },
  { code: 'SS-002', name: 'Coolant Temperature Sensor', unit: 'Nos', category: 'ELECTRICAL › SENSORS & SWITCHES' },
  { code: 'SS-003', name: 'Speed Sensor (MPU)', unit: 'Nos', category: 'ELECTRICAL › SENSORS & SWITCHES' },
  { code: 'SS-004', name: 'Alternator Voltage Sensor', unit: 'Nos', category: 'ELECTRICAL › SENSORS & SWITCHES' },

  // ENGINE PARTS
  { code: 'EP-001', name: 'Thermostat Valve', unit: 'Nos', category: 'ENGINE PARTS › COOLING SYSTEM' },
  { code: 'EP-002', name: 'Water Pump', unit: 'Nos', category: 'ENGINE PARTS › COOLING SYSTEM' },
  { code: 'EP-003', name: 'Radiator Hose Upper', unit: 'Nos', category: 'ENGINE PARTS › COOLING SYSTEM' },
  { code: 'EP-004', name: 'Radiator Hose Lower', unit: 'Nos', category: 'ENGINE PARTS › COOLING SYSTEM' },
  { code: 'EP-005', name: 'Fan Belt / Drive Belt', unit: 'Nos', category: 'ENGINE PARTS › COOLING SYSTEM' },
  { code: 'EP-006', name: 'Fuel Injector', unit: 'Nos', category: 'ENGINE PARTS › FUEL SYSTEM' },
  { code: 'EP-007', name: 'Fuel Feed Pump', unit: 'Nos', category: 'ENGINE PARTS › FUEL SYSTEM' },
  { code: 'EP-008', name: 'Fuel Injection Pump', unit: 'Nos', category: 'ENGINE PARTS › FUEL SYSTEM' },
  { code: 'EP-009', name: 'Turbocharger Assembly', unit: 'Nos', category: 'ENGINE PARTS › TURBO & INTAKE' },
  { code: 'EP-010', name: 'CAC Hose Assembly', unit: 'Nos', category: 'ENGINE PARTS › TURBO & INTAKE' },
  { code: 'EP-011', name: 'Air Intake Hose', unit: 'Nos', category: 'ENGINE PARTS › TURBO & INTAKE' },
  { code: 'EP-012', name: 'Oil Pressure Switch', unit: 'Nos', category: 'ENGINE PARTS › LUBRICATION' },
  { code: 'EP-013', name: 'Oil Sump Gasket', unit: 'Nos', category: 'ENGINE PARTS › LUBRICATION' },
  { code: 'EP-014', name: 'Cylinder Head Gasket', unit: 'Nos', category: 'ENGINE PARTS › ENGINE ASSEMBLY' },
  { code: 'EP-015', name: 'Rocker Cover Gasket', unit: 'Nos', category: 'ENGINE PARTS › ENGINE ASSEMBLY' },

  // FILTERS
  { code: 'FT-001', name: 'Oil Filter', unit: 'Nos', category: 'FILTERS › ENGINE FILTERS' },
  { code: 'FT-002', name: 'Fuel Filter Primary', unit: 'Nos', category: 'FILTERS › ENGINE FILTERS' },
  { code: 'FT-003', name: 'Fuel Filter Secondary', unit: 'Nos', category: 'FILTERS › ENGINE FILTERS' },
  { code: 'FT-004', name: 'Air Filter Element', unit: 'Nos', category: 'FILTERS › ENGINE FILTERS' },
  { code: 'FT-005', name: 'Coolant Filter', unit: 'Nos', category: 'FILTERS › ENGINE FILTERS' },

  // FLUIDS & LUBRICANTS
  { code: 'FL-001', name: 'Engine Oil 15W40', unit: 'Litre', category: 'FLUIDS & LUBRICANTS › ENGINE OIL' },
  { code: 'FL-002', name: 'Pre-Mixed Coolant', unit: 'Litre', category: 'FLUIDS & LUBRICANTS › COOLANT' },
  { code: 'FL-003', name: 'Diesel / HSD Fuel', unit: 'Litre', category: 'FLUIDS & LUBRICANTS › FUEL' },
  { code: 'FL-004', name: 'Gear Oil EP90', unit: 'Litre', category: 'FLUIDS & LUBRICANTS › GEAR OIL' },
  { code: 'FL-005', name: 'Brake Fluid DOT4', unit: 'Litre', category: 'FLUIDS & LUBRICANTS › BRAKE FLUID' },

];