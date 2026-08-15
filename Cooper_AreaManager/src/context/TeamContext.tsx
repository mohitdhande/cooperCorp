import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../utils/tokenStore';
import { getDealers, getEngineers } from '../viewModel/commisionAPi';
import { TeamMember } from '../models/myTeam.types';
import { UserProfile } from '../models/Login';
import { getPermissions } from '../constants/permissions';

type TeamState = {
  // The assign-picker roster — a dealer's engineers, or an area manager's
  // dealers. Deliberately only one level deep: an area manager assigns
  // DOWN to a dealer, never straight to an engineer (the dealer re-assigns
  // it from there), so this must never include engineers for an area
  // manager or the assign picker would offer an invalid direct target.
  members: TeamMember[];
  loading: boolean;
  // Re-fetches for whichever user is currently in AsyncStorage — called
  // once right after login (authController.ts) so the roster is already
  // warm by the time the user reaches a screen that needs it, and on
  // mount here for the cold-start-already-logged-in case.
  refresh: () => void;
};

const TeamContext = createContext<TeamState | null>(null);

// The current user's subordinate roster (a dealer's engineers, or an area
// manager's dealers) — fetched once here instead of every screen with an
// assign picker (Dashboard, Commissioning, Services, New Job, New Service
// Job) independently re-fetching the same GET /api/users list on its own
// mount. Engineer/admin/rsm have no subordinates, so this stays empty for
// them without ever calling the API.
//
// This used to also maintain a photoRoster/photoCache for backfilling
// avatar photos onto task cards, whenever a task's own embedded
// assignedTo/createdBy snapshot lacked one — that whole mechanism existed
// to work around raw profilePic URLs (signed GCS URLs) being unreliable.
// Per the backend dev guide, every avatar now loads through the
// authenticated GET /api/me/avatar/:userId proxy instead (see UserAvatar),
// keyed only by userId — no roster/cache of photo URLs needed at all
// anymore, so that entire mechanism was removed rather than left unread.
export function TeamProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [token, savedProfile] = await Promise.all([
        getToken(),
        AsyncStorage.getItem('userData'),
      ]);
      if (!token || !savedProfile) {
        setMembers([]);
        return;
      }
      const profile: UserProfile = JSON.parse(savedProfile);

      const subordinateRole = getPermissions(profile.role).subordinateRole;
      if (!subordinateRole) {
        setMembers([]);
        return;
      }
      setLoading(true);
      // Dealers manage engineers, area managers manage dealers.
      const fetchFn = subordinateRole === 'dealer' ? getDealers : getEngineers;
      const result = await fetchFn(token);
      const list = Array.isArray(result) ? result : [];
      setMembers(list);
    } catch (error) {
      console.log('[Team] Failed to load team:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <TeamContext.Provider value={{ members, loading, refresh }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used inside TeamProvider');
  return ctx;
}
