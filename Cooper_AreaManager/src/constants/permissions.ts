// Single source of truth for what each role can see/do in the merged app.
// Mirrors the exact capabilities the old standalone Cooper / Cooper_Dealer /
// Cooper_AreaManager apps had — screens should read from this instead of
// hand-rolling role checks.

export type Role = 'engineer' | 'dealer' | 'areaManager' | 'admin';

export type BottomTab = 'Commissioning Task' | 'SR Task' | 'My Team';

export type SubordinateRole = 'engineer' | 'dealer';

export interface RolePermissions {
  landingRoute: '/screens/dashboard';
  bottomTabs: BottomTab[];
  canCreateCommissioning: boolean;
  canCreateServiceRequest: boolean;
  hasTeamOverviewTab: boolean;
  hasMyTeam: boolean;
  subordinateRole: SubordinateRole | null;
  hasDashboard: boolean;
  hasRecordsScreens: boolean;
  // Whether this role fills in a commissioning/SR form (taskForm/
  // srTaskForm) by default. Dealers are false here but get an exception:
  // a task a dealer assigned to *themselves* (self-assign, see
  // newJobController.ts/newServiceJobController.ts) is worked exactly like
  // an engineer's own task — Accept -> Start -> Complete — since it's their
  // own task, not a subordinate's. Only a task actually handed off to one
  // of their engineers stays Assign/Reassign-only. That per-task exception
  // is decided at the screen level (isMyOwnTask, comparing
  // task.assignedTo.userId to the logged-in user), not by this flag —
  // this flag is just the role's own default.
  canFillTaskForm: boolean;
}

export const PERMISSIONS: Record<Role, RolePermissions> = {
  engineer: {
    landingRoute: '/screens/dashboard',
    bottomTabs: ['Commissioning Task', 'SR Task'],
    canCreateCommissioning: false,
    canCreateServiceRequest: false,
    hasTeamOverviewTab: false,
    hasMyTeam: false,
    subordinateRole: null,
    hasDashboard: false,
    hasRecordsScreens: false,
    canFillTaskForm: true,
  },
  dealer: {
    landingRoute: '/screens/dashboard',
    bottomTabs: ['Commissioning Task', 'SR Task'],
    canCreateCommissioning: true,
    canCreateServiceRequest: true,
    hasTeamOverviewTab: false,
    hasMyTeam: true,
    subordinateRole: 'engineer',
    hasDashboard: true,
    hasRecordsScreens: true,
    canFillTaskForm: false,
  },
  areaManager: {
    landingRoute: '/screens/dashboard',
    bottomTabs: ['Commissioning Task', 'SR Task', 'My Team'],
    canCreateCommissioning: true,
    canCreateServiceRequest: true,
    hasTeamOverviewTab: true,
    hasMyTeam: true,
    subordinateRole: 'dealer',
    hasDashboard: true,
    hasRecordsScreens: true,
    canFillTaskForm: true,
  },
  admin: {
    landingRoute: '/screens/dashboard',
    bottomTabs: [],
    canCreateCommissioning: false,
    canCreateServiceRequest: false,
    hasTeamOverviewTab: false,
    hasMyTeam: false,
    subordinateRole: null,
    hasDashboard: false,
    hasRecordsScreens: false,
    canFillTaskForm: true,
  },
};

// Backend role strings weren't consistently exercised client-side before
// this merge (each old app assumed its own single role), so match
// defensively instead of trusting exact casing/formatting — collapses
// 'Area Manager', 'area_manager', 'AREA-MANAGER', etc. to 'areaManager'.
const ROLE_ALIASES: Record<string, Role> = {
  engineer: 'engineer',
  dealer: 'dealer',
  areamanager: 'areaManager',
  admin: 'admin',
};

function normalizeRoleKey(role: string): string {
  return role.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

export function getPermissions(role: string): RolePermissions {
  const normalized = ROLE_ALIASES[normalizeRoleKey(role ?? '')];
  return PERMISSIONS[normalized ?? 'engineer'];
}

// Same defensive normalization getPermissions uses internally, exposed for
// call sites that need to know exactly which role this is (not just what
// it can do) — e.g. branching a screen's behavior specifically for
// engineers vs area managers, where the permissions object alone doesn't
// distinguish them (both have canFillTaskForm: true).
export function getRole(role: string): Role {
  return ROLE_ALIASES[normalizeRoleKey(role ?? '')] ?? 'engineer';
}
