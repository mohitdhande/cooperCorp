import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { getServiceTaskById, getAssetById } from '../viewModel/commisionAPi';

function parseTaskParam(raw?: string): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.log('[SR Report] Failed to parse task param:', error);
    return null;
  }
}

// Loads an SR/service task report: seeds from the route param, then refreshes
// with live task + asset detail from the API. Also owns the per-section
// expand/collapse state used by the accordion layout.
export function useSrTaskReportScreenController() {
  const params = useLocalSearchParams<{ task: string }>();
  const initialTask = parseTaskParam(params.task);

  const [detail, setDetail] = useState<any>(null);
  const [asset, setAsset] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [userName, setUserName] = useState('');
  const [userProfilePic, setUserProfilePic] = useState<string | null>(null);

  const [gensetExpanded, setGensetExpanded] = useState(true);
  const [alternatorExpanded, setAlternatorExpanded] = useState(false);
  const [serviceExpanded, setServiceExpanded] = useState(false);
  const [readingsExpanded, setReadingsExpanded] = useState(false);
  const [engineParamsExpanded, setEngineParamsExpanded] = useState(false);
  const [complaintExpanded, setComplaintExpanded] = useState(false);
  const [partsExpanded, setPartsExpanded] = useState(false);
  const [photosExpanded, setPhotosExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [approvalExpanded, setApprovalExpanded] = useState(true);

  const loadUser = async () => {
    try {
      const savedUser = await AsyncStorage.getItem('userData');
      if (savedUser) {
        const user = JSON.parse(savedUser);
        setUserName(user.name);
        setUserProfilePic(user.profilePic || null);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const loadDetail = async () => {
    console.log('[SR REPORT] Loading report for task:', initialTask?._id);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !initialTask?._id) {
        console.log('[SR REPORT] Missing token or task id, aborting');
        return;
      }

      const data = await getServiceTaskById(token, initialTask._id);
      console.log('[SR REPORT] Service task detail response:', JSON.stringify(data));
      setDetail(data);

      const assetIdToFetch = data.assetId || initialTask.assetId;
      if (assetIdToFetch) {
        console.log('[SR REPORT] Loading asset:', assetIdToFetch);
        try {
          const assetData = await getAssetById(token, assetIdToFetch);
          console.log('[SR REPORT] Asset response:', JSON.stringify(assetData));
          setAsset(assetData);
        } catch (assetErr) {
          console.log('[SR REPORT] Failed to load asset:', assetErr);
        }
      } else {
        console.log('[SR REPORT] No assetId found on task, skipping asset fetch');
      }
    } catch (error) {
      console.log('[SR REPORT] Failed to load task detail:', error);
      setLoadError('Could not refresh this report. Showing the data available offline.');
    } finally {
      setIsLoading(false);
      console.log('[SR REPORT] Load complete');
    }
  };

  useEffect(() => {
    loadDetail();
    loadUser();
  }, []);

  return {
    initialTask,
    detail,
    asset,
    isLoading,
    loadError,
    userName,
    userProfilePic,
    gensetExpanded, setGensetExpanded,
    alternatorExpanded, setAlternatorExpanded,
    serviceExpanded, setServiceExpanded,
    readingsExpanded, setReadingsExpanded,
    engineParamsExpanded, setEngineParamsExpanded,
    complaintExpanded, setComplaintExpanded,
    partsExpanded, setPartsExpanded,
    photosExpanded, setPhotosExpanded,
    notesExpanded, setNotesExpanded,
    approvalExpanded, setApprovalExpanded,
  };
}
