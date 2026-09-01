import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  getMyTasksByStatus, acceptCommissioningTask, startCommissioningTask,
  acceptServiceTask, startServiceTask,
} from '../viewModel/commisionAPi';
import { parseApiError } from '../utils/apiError';

const PAGE_SIZE = 10;

type StatusKey = 'active' | 'completed' | 'closed';

// Shared accept/start implementation used by both the commissioning and SR
// task handlers below — same try/catch/finally shape, parametrized by which
// API call to make, which status to move the task to, and which per-task
// loading/error/status-override maps to update.
async function runTaskAction(
  taskId: string,
  actionFn: (token: string, taskId: string) => Promise<any>,
  nextStatus: string,
  fallbackMessage: string,
  setLoading: (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => void,
  setError: (updater: (prev: Record<string, string>) => Record<string, string>) => void,
  setStatusOverride: (updater: (prev: Record<string, string>) => Record<string, string>) => void,
) {
  setLoading(prev => ({ ...prev, [taskId]: true }));
  setError(prev => ({ ...prev, [taskId]: '' }));
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    await actionFn(token, taskId);
    setStatusOverride(prev => ({ ...prev, [taskId]: nextStatus }));
  } catch (error: any) {
    const { message } = parseApiError(error, fallbackMessage);
    setError(prev => ({ ...prev, [taskId]: message }));
  } finally {
    setLoading(prev => ({ ...prev, [taskId]: false }));
  }
}

// Owns all state, pagination, and API orchestration for the commissioning
// tasks / SR job cards screen, leaving the view as pure JSX.
export function useCommissioningTasksScreenController() {
  const router = useRouter();

  const [commissioningPages, setCommissioningPages] = useState<Record<StatusKey, number>>({
    active: 1, completed: 1, closed: 1,
  });
  const [commissioningHasMore, setCommissioningHasMore] = useState<Record<StatusKey, boolean>>({
    active: true, completed: true, closed: true,
  });
  const [servicePages, setServicePages] = useState<Record<StatusKey, number>>({
    active: 1, completed: 1, closed: 1,
  });
  const [serviceHasMore, setServiceHasMore] = useState<Record<StatusKey, boolean>>({
    active: true, completed: true, closed: true,
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [srTaskStatusOverrides, setSrTaskStatusOverrides] = useState<Record<string, string>>({});
  const [srTaskActionLoading, setSrTaskActionLoading] = useState<Record<string, boolean>>({});
  const [srTaskActionError, setSrTaskActionError] = useState<Record<string, string>>({});

  const [taskStatusOverrides, setTaskStatusOverrides] = useState<Record<string, string>>({});
  const [taskActionLoading, setTaskActionLoading] = useState<Record<string, boolean>>({});
  const [taskActionError, setTaskActionError] = useState<Record<string, string>>({});

  const [drawerVisible, setDrawerVisible] = useState(false);
  const [userProfilePic, setUserProfilePic] = useState<string | null>(null);
  const [userName, setUserName] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedBottomTab, setSelectedBottomTab] = useState('Commissioning Task');
  const [selectedStatusTab, setSelectedStatusTab] = useState('Active');
  const [searchText, setSearchText] = useState('');

  const [srDashboard, setSrDashboard] = useState({ total: 0, active: 0, completed: 0, closed: 0 });
  const [dashboard, setDashboard] = useState({ total: 0, active: 0, completed: 0, closed: 0 });

  const [activeServiceTasks, setActiveServiceTasks] = useState<any[]>([]);
  const [completedServiceTasks, setCompletedServiceTasks] = useState<any[]>([]);
  const [closedServiceTasks, setClosedServiceTasks] = useState<any[]>([]);
  const [activeTasks, setActiveTasks] = useState<any[]>([]);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [closedTasks, setClosedTasks] = useState<any[]>([]);

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

  const loadAllData = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const [activeData, completedData, closedData] = await Promise.all([
        getMyTasksByStatus(token, 'active', 1, PAGE_SIZE),
        getMyTasksByStatus(token, 'completed', 1, PAGE_SIZE),
        getMyTasksByStatus(token, 'closed', 1, PAGE_SIZE),
      ]);

      const newActiveTasks = activeData.commissioning || [];
      const newCompletedTasks = completedData.commissioning || [];
      const newClosedTasks = closedData.commissioning || [];

      setActiveTasks(newActiveTasks);
      setCompletedTasks(newCompletedTasks);
      setClosedTasks(newClosedTasks);

      setDashboard({
        total: activeData.counts.commissioning.total,
        active: activeData.counts.commissioning.active,
        completed: activeData.counts.commissioning.completed,
        closed: activeData.counts.commissioning.closed,
      });

      setCommissioningPages({ active: 1, completed: 1, closed: 1 });
      setCommissioningHasMore({
        active: newActiveTasks.length === PAGE_SIZE,
        completed: newCompletedTasks.length === PAGE_SIZE,
        closed: newClosedTasks.length === PAGE_SIZE,
      });

      const newActiveService = activeData.service || [];
      const newCompletedService = completedData.service || [];
      const newClosedService = closedData.service || [];

      setActiveServiceTasks(newActiveService);
      setCompletedServiceTasks(newCompletedService);
      setClosedServiceTasks(newClosedService);

      setSrDashboard({
        total: activeData.counts.service.total,
        active: activeData.counts.service.active,
        completed: activeData.counts.service.completed,
        closed: activeData.counts.service.closed,
      });

      setServicePages({ active: 1, completed: 1, closed: 1 });
      setServiceHasMore({
        active: newActiveService.length === PAGE_SIZE,
        completed: newCompletedService.length === PAGE_SIZE,
        closed: newClosedService.length === PAGE_SIZE,
      });
    } catch (error) {
      console.log('[SR/Commissioning] Failed to load tasks:', error);
      setLoadError('Could not load your tasks. Pull down or reopen the screen to try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreTasks = async () => {
    if (isLoadingMore || isLoading) return;

    const statusKey = selectedStatusTab.toLowerCase() as StatusKey;
    const isCommissioning = selectedBottomTab === 'Commissioning Task';
    const pages = isCommissioning ? commissioningPages : servicePages;
    const hasMore = isCommissioning ? commissioningHasMore : serviceHasMore;

    if (!hasMore[statusKey]) return;

    setIsLoadingMore(true);
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) return;

      const nextPage = pages[statusKey] + 1;
      const data = await getMyTasksByStatus(token, statusKey, nextPage, PAGE_SIZE);

      if (isCommissioning) {
        const newItems = data.commissioning || [];
        if (statusKey === 'active') setActiveTasks(prev => [...prev, ...newItems]);
        if (statusKey === 'completed') setCompletedTasks(prev => [...prev, ...newItems]);
        if (statusKey === 'closed') setClosedTasks(prev => [...prev, ...newItems]);

        setCommissioningPages(prev => ({ ...prev, [statusKey]: nextPage }));
        setCommissioningHasMore(prev => ({ ...prev, [statusKey]: newItems.length === PAGE_SIZE }));
      } else {
        const newItems = data.service || [];
        if (statusKey === 'active') setActiveServiceTasks(prev => [...prev, ...newItems]);
        if (statusKey === 'completed') setCompletedServiceTasks(prev => [...prev, ...newItems]);
        if (statusKey === 'closed') setClosedServiceTasks(prev => [...prev, ...newItems]);

        setServicePages(prev => ({ ...prev, [statusKey]: nextPage }));
        setServiceHasMore(prev => ({ ...prev, [statusKey]: newItems.length === PAGE_SIZE }));
      }
    } catch (error) {
      console.log('[Pagination] Failed to load more tasks:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleScroll = ({ nativeEvent }: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const paddingToBottom = 120; // px before the actual bottom to trigger the fetch
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    if (isCloseToBottom) {
      loadMoreTasks();
    }
  };

  const handleAcceptTask = (taskId: string) =>
    runTaskAction(taskId, acceptCommissioningTask, 'ACCEPTED', 'Failed to accept task. Please try again.',
      setTaskActionLoading, setTaskActionError, setTaskStatusOverrides);

  const handleStartTask = (taskId: string) =>
    runTaskAction(taskId, startCommissioningTask, 'IN_PROGRESS', 'Failed to start task. Please try again.',
      setTaskActionLoading, setTaskActionError, setTaskStatusOverrides);

  const handleAcceptSrTask = (taskId: string) =>
    runTaskAction(taskId, acceptServiceTask, 'ACCEPTED', 'Failed to accept task. Please try again.',
      setSrTaskActionLoading, setSrTaskActionError, setSrTaskStatusOverrides);

  const handleStartSrTask = (taskId: string) =>
    runTaskAction(taskId, startServiceTask, 'IN_PROGRESS', 'Failed to start task. Please try again.',
      setSrTaskActionLoading, setSrTaskActionError, setSrTaskStatusOverrides);

  const getFilteredTasks = () => {
    if (selectedStatusTab === 'Active') return activeTasks;
    if (selectedStatusTab === 'Completed') return completedTasks;
    if (selectedStatusTab === 'Closed') return closedTasks;
    return [];
  };

  const getFilteredSrTasks = () => {
    if (selectedStatusTab === 'Active') return activeServiceTasks;
    if (selectedStatusTab === 'Completed') return completedServiceTasks;
    if (selectedStatusTab === 'Closed') return closedServiceTasks;
    return [];
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            router.replace('/screens/login');
          },
        },
      ]
    );
  };

  useEffect(() => {
    loadUser();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAllData();
    }, [])
  );

  return {
    router,
    isLoading,
    loadError,
    isLoadingMore,
    selectedBottomTab, setSelectedBottomTab,
    selectedStatusTab, setSelectedStatusTab,
    searchText, setSearchText,
    drawerVisible, setDrawerVisible,
    userName,
    userProfilePic,
    dashboard,
    srDashboard,
    taskStatusOverrides,
    taskActionLoading,
    taskActionError,
    srTaskStatusOverrides,
    srTaskActionLoading,
    srTaskActionError,
    handleScroll,
    handleAcceptTask,
    handleStartTask,
    handleAcceptSrTask,
    handleStartSrTask,
    getFilteredTasks,
    getFilteredSrTasks,
    handleLogout,
  };
}
