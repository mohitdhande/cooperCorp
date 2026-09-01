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

// getDealers/getEngineers return response.data as-is, with no unwrapping —
// fine as long as the backend really does answer with a bare array, but
// other list endpoints in this same API (e.g. service category config)
// answer wrapped in a named field instead. Accept either shape here so a
// real roster never silently turns into an empty one just because this
// particular endpoint happens to wrap its array under a key.
function extractMemberList(result: unknown): TeamMember[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    for (const key of ['data', 'users', 'dealers', 'engineers', 'results', 'items', 'members']) {
      if (Array.isArray(obj[key])) return obj[key] as TeamMember[];
    }
  }
  return [];
}

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
      const list = extractMemberList(result);
      setMembers(list);
    } catch (error) {
      // Silent by design — an expired/invalid token here (same cause as
      // the roster coming back empty) is already surfaced to the user by
      // the app's own session-expiry handling elsewhere (axios interceptor
      // → redirect to Login with "Your session has expired"); this is just
      // one of several screens that independently wants the roster, so it
      // shouldn't also throw up its own separate error for the same event.
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
