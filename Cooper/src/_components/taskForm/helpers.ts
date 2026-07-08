import { CheckItem, LoadStage } from '@/models/taskForm.types';

export const makeCheckItem = (id: string, question: string, hasNA = false): CheckItem => ({
  id, question, hasNA, status: null, issueDescription: '', itemSaved: false, editingComment: false,
});

export const makeLoadStage = (id: string, label: string, duration: string): LoadStage => ({
  id, label, duration,
  loadAmps: { r: '', y: '', b: '' },
  voltageVolts: { r: '', y: '', b: '' },
  freqHz: '', batteryV: '', remarks: '', saved: false,
});