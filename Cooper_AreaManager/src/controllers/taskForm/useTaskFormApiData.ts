import { useCallback, useState } from 'react';
import { getToken } from '../../utils/tokenStore';
import { getFaultCodes, getParts } from '../../viewModel/commisionAPi';
import { ApiFaultCode, ApiPart, SelectedComplaintCode, SelectedPart } from '../../models/taskForm.types';
import { parseApiError } from '../../utils/apiError';
import { cacheData, getCachedData } from '../../utils/offlineCache';
import { isNetworkError, putOrQueue } from '../../utils/syncEngine';
import { formatAssetLabel } from '../../utils/reportFormatters';

// Shared with the SR form's own loader (useSrTaskForm.ts) — same backend
// lists, so one cached copy on-device serves both forms.
const FAULT_CODES_CACHE_KEY = 'faultCodes';
const PARTS_CACHE_KEY = 'parts';

type UseTaskFormApiDataArgs = {
  taskId: string;
  showToast: (message: string, type: 'success' | 'error') => void;
  // Threaded into putOrQueue below — same engineer-only offline scoping as
  // every other save in this form (see useTaskForm.ts's own isEngineer
  // comment). Matches the SR form's equivalent saves, which already queue.
  isEngineer: boolean;
  // Just for putOrQueue's own description (see formatAssetLabel) — a
  // failed/pending sync banner showing "Task 68f2a91c..." means nothing to
  // an engineer, the genset/engine serial numbers do.
  gensetNumber?: string;
  engineNumber?: string;
};

// Encapsulates the API interactions for fault codes, parts, and step-level save operations.
export function useTaskFormApiData({ taskId, showToast, isEngineer, gensetNumber, engineNumber }: UseTaskFormApiDataArgs) {
  const [apiFaultCodes, setApiFaultCodes] = useState<ApiFaultCode[]>([]);
  const [apiParts, setApiParts] = useState<ApiPart[]>([]);
  const [faultCodesLoading, setFaultCodesLoading] = useState(false);
  const [partsLoading, setPartsLoading] = useState(false);
  const [step3Saving, setStep3Saving] = useState(false);
  const [step3Error, setStep3Error] = useState('');
  const [step3Success, setStep3Success] = useState(false);
  const [step4Saving, setStep4Saving] = useState(false);
  const [step4Error, setStep4Error] = useState('');
  const [step4Success, setStep4Success] = useState(false);

  const loadFaultCodes = useCallback(async () => {
    setFaultCodesLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getFaultCodes(token);
      setApiFaultCodes(data);
      await cacheData(FAULT_CODES_CACHE_KEY, data);
    } catch (error) {
      console.log('Failed to load fault codes:', error);
      // Offline (or any other failure) — fall back to whatever list was
      // cached from the last successful load, so the picker still has
      // options to select from instead of showing empty.
      if (isNetworkError(error)) {
        const cached = await getCachedData<ApiFaultCode[]>(FAULT_CODES_CACHE_KEY);
        if (cached) setApiFaultCodes(cached.data);
      }
    } finally {
      setFaultCodesLoading(false);
    }
  }, []);

  const loadParts = useCallback(async () => {
    setPartsLoading(true);
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getParts(token);
      setApiParts(data);
      await cacheData(PARTS_CACHE_KEY, data);
    } catch (error) {
      console.log('Failed to load parts:', error);
      if (isNetworkError(error)) {
        const cached = await getCachedData<ApiPart[]>(PARTS_CACHE_KEY);
        if (cached) setApiParts(cached.data);
      }
    } finally {
      setPartsLoading(false);
    }
  }, []);

  // Returns whether the save actually succeeded — the caller (useTaskForm's
  // handleSaveFaultCodes) needs this to know when it's safe to clear each
  // item's isNew flag, since that flag must only drop once the save is
  // actually confirmed, not just attempted.
  const saveFaultCodes = useCallback(async (selectedComplaintCodes: SelectedComplaintCode[]): Promise<boolean> => {
    if (!taskId) return false;
    setStep3Saving(true);
    setStep3Error('');
    setStep3Success(false);
    try {
      const assetLabel = formatAssetLabel(gensetNumber, engineNumber, taskId);
      const { queued } = await putOrQueue(
        `/api/commissioning/${taskId}/save-progress`,
        {
          faultCodes: selectedComplaintCodes.map(item => ({
            codeId: item.codeId,
            observation: item.observation,
            rootCause: item.rootCause,
            correctiveAction: item.correctiveAction,
          })),
        },
        `Fault Codes (${assetLabel})`,
        `commissioning_faultcodes_${taskId}`,
        isEngineer
      );
      setStep3Success(true);
      showToast(queued ? 'Saved on this device — will sync later' : 'Fault codes saved!', 'success');
      return true;
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to save. Please try again.').message;
      setStep3Error(msg);
      showToast(msg, 'error');
      return false;
    } finally {
      setStep3Saving(false);
    }
  }, [showToast, taskId, isEngineer, gensetNumber, engineNumber]);

  const savePartsUsed = useCallback(async (selectedParts: SelectedPart[]) => {
    if (!taskId) return;
    setStep4Saving(true);
    setStep4Error('');
    setStep4Success(false);
    try {
      const assetLabel = formatAssetLabel(gensetNumber, engineNumber, taskId);
      const { queued } = await putOrQueue(
        `/api/commissioning/${taskId}/save-progress`,
        {
          partsUsed: selectedParts.map(part => ({
            partId: part.partId,
            quantity: part.quantity,
          })),
        },
        `Parts Used (${assetLabel})`,
        `commissioning_parts_${taskId}`,
        isEngineer
      );
      setStep4Success(true);
      showToast(queued ? 'Saved on this device — will sync later' : 'Parts saved!', 'success');
    } catch (error: any) {
      const msg = parseApiError(error, 'Failed to save. Please try again.').message;
      setStep4Error(msg);
      showToast(msg, 'error');
    } finally {
      setStep4Saving(false);
    }
  }, [showToast, taskId, isEngineer, gensetNumber, engineNumber]);

  return {
    apiFaultCodes,
    apiParts,
    faultCodesLoading,
    partsLoading,
    step3Saving,
    step3Error,
    step3Success,
    step4Saving,
    step4Error,
    step4Success,
    loadFaultCodes,
    loadParts,
    saveFaultCodes,
    savePartsUsed,
  };
}
