import { useCallback, useState } from 'react';
import { getToken } from '../utils/tokenStore';
import { searchAssets } from '../viewModel/commisionAPi';
import { CommissioningAssetSearchResult } from '../models/commissioningRecords.types';
import { parseApiError } from '../utils/apiError';

export type AssetTaskSearchResult = {
  asset: CommissioningAssetSearchResult;
  // The caller's own task for this asset, if one is already loaded — null
  // means either there isn't one, or it hasn't been paginated in yet.
  task: any | null;
};

// Shared by the Commissioning and SR Job Cards controllers: there is no
// backend endpoint that searches *tasks* by text, so this reuses the
// existing /api/assets/search (same one New Commissioning/New Service
// Request already use) to find the asset, then cross-references it against
// the caller's own already-loaded tasks to find "my task for this asset."
export function useAssetTaskSearch(tasks: any[]) {
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<AssetTaskSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = useCallback(async () => {
    const query = searchText.trim();
    setSearched(true);
    if (!query) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError('');
    try {
      const token = await getToken();
      if (!token) return;

      const assets: CommissioningAssetSearchResult[] = await searchAssets(token, query);
      setResults(assets.map((asset) => ({
        asset,
        task: tasks.find((t) => t.asset?._id === asset._id) || null,
      })));
    } catch (error: any) {
      const { message } = parseApiError(error, 'Failed to search. Please try again.');
      setSearchError(message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchText, tasks]);

  const handleClearSearch = useCallback(() => {
    setSearchText('');
    setResults([]);
    setSearched(false);
    setSearchError('');
  }, []);

  return { searchText, setSearchText, handleSearch, handleClearSearch, results, isSearching, searchError, searched };
}
