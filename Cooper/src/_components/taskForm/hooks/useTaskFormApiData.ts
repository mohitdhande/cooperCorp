import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFaultCodes, getParts, saveStepProgress } from '@/viewModel/commisionAPi';
import { ApiFaultCode, ApiPart, SelectedComplaintCode, SelectedPart } from '@/models/taskForm.types';

type UseTaskFormApiDataArgs = {
  taskId: string;
  showToast: (message: string, type: 'success' | 'error') => void;
};

// Encapsulates the API interactions for fault codes, parts, and step-level save operations.
export function useTaskFormApiData({ taskId, showToast }: UseTaskFormApiDataArgs) {
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
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const data = await getFaultCodes(token);
      setApiFaultCodes(data);
    } catch (error) {
      console.log('Failed to load fault codes:', error);
    } finally {
      setFaultCodesLoading(false);
    }
  }, []);

  const loadParts = useCallback(async () => {
    setPartsLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      const data = await getParts(token);
      setApiParts(data);
    } catch (error) {
      console.log('Failed to load parts:', error);
    } finally {
      setPartsLoading(false);
    }
  }, []);

  const saveFaultCodes = useCallback(async (selectedComplaintCodes: SelectedComplaintCode[]) => {
    if (!taskId) return;
    setStep3Saving(true);
    setStep3Error('');
    setStep3Success(false);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      await saveStepProgress(token, taskId, {
        faultCodes: selectedComplaintCodes.map(item => ({
          codeId: item.codeId,
          observation: item.observation,
          rootCause: item.rootCause,
        })),
      });
      setStep3Success(true);
      showToast('Fault codes saved!', 'success');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to save. Please try again.';
      setStep3Error(msg);
      showToast(msg, 'error');
    } finally {
      setStep3Saving(false);
    }
  }, [showToast, taskId]);

  const savePartsUsed = useCallback(async (selectedParts: SelectedPart[]) => {
    if (!taskId) return;
    setStep4Saving(true);
    setStep4Error('');
    setStep4Success(false);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;
      await saveStepProgress(token, taskId, {
        partsUsed: selectedParts.map(part => ({
          partId: part.partId,
          quantity: part.quantity,
        })),
      });
      setStep4Success(true);
      showToast('Parts saved!', 'success');
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to save. Please try again.';
      setStep4Error(msg);
      showToast(msg, 'error');
    } finally {
      setStep4Saving(false);
    }
  }, [showToast, taskId]);

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
