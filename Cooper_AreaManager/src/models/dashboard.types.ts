// Shape of GET /api/me/dashboard — the single consolidated fetch behind the
// Dashboard screen. Task entries under activeTasks/recentCompleted carry
// their own embedded `asset` plus the full assignment/reassignment chain,
// same raw shape as GET /api/me/tasks — left as `any` here since the rest
// of the app already treats task objects this way (e.g.
// CompletedCommissioningActivity.task in commissioningRecords.types.ts).
export type DashboardStatusCounts = {
  active: number;
  completed: number;
  closed: number;
  total: number;
};

export type DashboardTeamAvatar = {
  _id: string;
  name: string;
  profilePic: string | null;
  activeCount: number;
  // Drives the handshake badge (dealers) vs the plain active-count badge
  // (everyone else) in the Dashboard's team avatar strip.
  role?: string;
  // Only present for dealer entries — the company name shown under the
  // avatar instead of the individual contact person's own `name`.
  dealerName?: string;
};

// Service (SR) work-approval requests awaiting/past AM+RSM sign-off — shown
// in the Dashboard's own "SR Approvals" carousel, separate from the task's
// own ASSIGNED/IN_PROGRESS/... lifecycle status.
export type DashboardApprovalItem = {
  _id: string;
  title?: string;
  status: string;
  category?: string;
  srNumber?: string;
  date: string;
  workApproval?: {
    status: string; // PENDING_AM | PENDING_RSM | CONFIRMED | REJECTED
    rejectedBy?: string;
    rejectionNote?: string;
  };
  // Only present when the entry has parts pending the AM's individual
  // review (see PUT /service/:id/parts/review) — a separate gate from
  // workApproval, and the more common one in practice.
  partApproval?: {
    status: string; // PENDING | REVIEWED
  };
  asset: {
    gensetNumber: string;
    clientName?: string;
  };
};

export type DashboardSummary = {
  counts: {
    commissioning: DashboardStatusCounts;
    service: DashboardStatusCounts;
  };
  activeTasks: {
    commissioning: any[];
    service: any[];
  };
  recentCompleted: {
    commissioning: any[];
    service: any[];
  };
  recentClosed: {
    commissioning: any[];
    service: any[];
  };
  summaryCounts: {
    myActive: number;
    teamActive: number;
    overdue: number;
    pendingApproval: number;
    completed: number;
  };
  teamAvatars: DashboardTeamAvatar[];
  approvalList: DashboardApprovalItem[];
};
