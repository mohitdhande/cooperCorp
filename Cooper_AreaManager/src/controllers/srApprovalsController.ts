import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/tokenStore';
import { useRouter } from 'expo-router';
import { getServiceEntries } from '../viewModel/commisionAPi';
import { UserProfile } from '../models/Login';
import { isApprovalPending } from '../utils/reportFormatters';
import { parseApiError } from '../utils/apiError';

type ScopeTab = 'my' | 'all';
type StatusTab = 'pending' | 'approved';

// Drives the "SR Approvals" full-list screen (reached from the Dashboard's
// SR Approvals — Show all link). Sourced from GET /api/service directly
// (not GET /me/tasks, whose list items don't carry partApproval/
// workApproval) — `mine: true` for the My tab, omitted for All so the
// backend's own role-based visibility rules decide what's broader.
export function useSrApprovalsController() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  useEffect(() => {
    AsyncStorage.getItem('userData')
      .then((saved) => { if (saved) setProfile(JSON.parse(saved)); })
      .catch((error) => console.log('[SR Approvals] Failed to load profile:', error));
  }, []);

  const [scopeTab, setScopeTab] = useState<ScopeTab>('my');
  const [statusTab, setStatusTab] = useState<StatusTab>('pending');
  const [searchText, setSearchText] = useState('');

  const [entries, setEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchEntries = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setIsLoading(true);
    setError('');
    try {
      const token = await getToken();
      if (!token) return;
      const data = await getServiceEntries(token, scopeTab === 'my' ? { mine: true } : undefined);
      const list = Array.isArray(data) ? data : data?.service || data?.entries || [];
      // Only entries actually in an approval flow — this screen isn't a
      // general SR list, just the ones with something to review/decide.
      setEntries(list.filter((e: any) => !!e.workApproval || !!e.partApproval));
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to load SR approvals.');
      setError(message);
    } finally {
      if (!opts?.silent) setIsLoading(false);
    }
  }, [scopeTab]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEntries({ silent: true });
    setRefreshing(false);
  }, [fetchEntries]);

  // Pending/Approved counts computed off the same fetched list regardless
  // of which status tab is currently selected — both numbers show on the
  // toggle at once.
  const pendingCount = useMemo(() => entries.filter(isApprovalPending).length, [entries]);
  const approvedCount = entries.length - pendingCount;

  const visibleEntries = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return entries.filter((e) => {
      const matchesStatus = statusTab === 'pending' ? isApprovalPending(e) : !isApprovalPending(e);
      if (!matchesStatus) return false;
      if (!query) return true;
      const haystack = [e.asset?.gensetNumber, e.asset?.clientName, e.title, e.srNumber]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [entries, statusTab, searchText]);

  const goToDetail = useCallback((entry: any) => {
    router.push({ pathname: '/screens/srDetail', params: { task: JSON.stringify(entry) } } as any);
  }, [router]);

  return {
    profile,
    scopeTab, setScopeTab,
    statusTab, setStatusTab,
    searchText, setSearchText,
    visibleEntries, pendingCount, approvedCount,
    isLoading, error, refreshing, onRefresh,
    goToDetail,
  };
}
