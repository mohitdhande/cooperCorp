import { useEffect, useRef, useState } from 'react';
import { getToken } from '../../utils/tokenStore';
import { getServiceTaskById } from '../../viewModel/commisionAPi';

type ApprovalTimestamps = { completedAt?: string; requestedAt?: string };

// The approval-list data both dashboard.tsx's SR Approvals card and
// srApprovals.tsx's own list read from (GET /me/dashboard's approvalList,
// GET /api/service's list items) never carries a real "when was this
// actually sent for approval" timestamp — confirmed via a real pasted
// response: no completedAt, no workApproval.requestedAt, only status
// fields and a bare calendar `date` (midnight, not a real time — which is
// why "X hours ago" was really just "hours since midnight today"). The
// real completedAt/workApproval.requestedAt only exist on the full task
// detail (GET /api/service/:id, the same call srDetail.tsx already makes
// and already shows correct times from). This fetches just that, once per
// entry, and caches it locally so re-renders (pagination, carousel paging)
// don't refetch what's already known.
export function useApprovalTimestamps(entryIds: string[]) {
  const [timestamps, setTimestamps] = useState<Record<string, ApprovalTimestamps>>({});
  const fetchedIds = useRef<Set<string>>(new Set());

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const idsToFetch = entryIds.filter((id) => id && !fetchedIds.current.has(id));
    if (idsToFetch.length === 0) return;
    idsToFetch.forEach((id) => fetchedIds.current.add(id));

    (async () => {
      const token = await getToken();
      if (!token) return;
      await Promise.all(idsToFetch.map(async (id) => {
        try {
          const detail = await getServiceTaskById(token, id);
          setTimestamps((prev) => ({
            ...prev,
            [id]: { completedAt: detail?.completedAt, requestedAt: detail?.workApproval?.requestedAt },
          }));
        } catch (error) {
          // Best-effort — a failed fetch just leaves this entry without a
          // real timestamp, falling back to whatever the caller already had
          // (the misleading bare `date` field, same as before this fix).
          console.log('[Approval Timestamps] Failed to fetch detail for', id, error);
        }
      }));
    })();
    // entryIds.join(',') is the real dependency — a new array reference
    // every render shouldn't refetch already-known ids, only a genuine
    // change in which ids are being asked for should.
  }, [entryIds.join(',')]);

  return timestamps;
}
