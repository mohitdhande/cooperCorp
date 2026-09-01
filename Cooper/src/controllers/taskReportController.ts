import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { getCommissioningTaskDetail, getAssetById } from '../viewModel/commisionAPi';

function parseTaskParam(raw?: string): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.log('[Task Report] Failed to parse task param:', error);
    return null;
  }
}

// Loads a commissioning task report: seeds from the route param, then refreshes
// with live task + asset detail from the API. Also owns the per-section
// expand/collapse state used by the accordion layout.
export function useTaskReportScreenController() {
  const params = useLocalSearchParams<{ task: string }>();
  const initialTask = parseTaskParam(params.task);

  const [detail, setDetail] = useState<any>(null);
  const [asset, setAsset] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [userName, setUserName] = useState('');
  const [userProfilePic, setUserProfilePic] = useState<string | null>(null);

  const [gensetExpanded, setGensetExpanded] = useState(true);
  const [engineExpanded, setEngineExpanded] = useState(false);
  const [alternatorExpanded, setAlternatorExpanded] = useState(false);
  const [checksExpanded, setChecksExpanded] = useState(false);
  const [complaintExpanded, setComplaintExpanded] = useState(false);
  const [partsExpanded, setPartsExpanded] = useState(false);
  const [readingsExpanded, setReadingsExpanded] = useState(false);
  const [photosExpanded, setPhotosExpanded] = useState(false);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);

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
    console.log('[REPORT] Loading report for task:', initialTask?._id);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token || !initialTask?._id) {
        console.log('[REPORT] Missing token or task id, aborting');
        return;
      }

      const data = await getCommissioningTaskDetail(token, initialTask._id);
      console.log('[REPORT] Commissioning detail response:', JSON.stringify(data));
      setDetail(data);

      const assetIdToFetch = data.assetId || initialTask.assetId;
      if (assetIdToFetch) {
        console.log('[REPORT] Loading asset:', assetIdToFetch);
        try {
          const assetData = await getAssetById(token, assetIdToFetch);
          console.log('[REPORT] Asset response:', JSON.stringify(assetData));
          setAsset(assetData);
        } catch (assetErr) {
          console.log('[REPORT] Failed to load asset:', assetErr);
        }
      } else {
        console.log('[REPORT] No assetId found on task, skipping asset fetch');
      }
    } catch (error) {
      console.log('[REPORT] Failed to load task detail:', error);
      setLoadError('Could not refresh this report. Showing the data available offline.');
    } finally {
      setIsLoading(false);
      console.log('[REPORT] Load complete');
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
    engineExpanded, setEngineExpanded,
    alternatorExpanded, setAlternatorExpanded,
    checksExpanded, setChecksExpanded,
    complaintExpanded, setComplaintExpanded,
    partsExpanded, setPartsExpanded,
    readingsExpanded, setReadingsExpanded,
    photosExpanded, setPhotosExpanded,
    feedbackExpanded, setFeedbackExpanded,
  };
}
