import { useCallback, useState } from 'react';

// Same state shape as taskForm.tsx's own hand-rolled showToast, pulled out
// here so screens that don't already have one (taskReportController.ts,
// srTaskReportController.ts) can reuse it instead of re-typing the same
// three-state-variables-plus-timeout pattern. Pair with shared/Toast.tsx.
export function useToast() {
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  }, []);

  return { toastMessage, toastType, toastVisible, showToast };
}
