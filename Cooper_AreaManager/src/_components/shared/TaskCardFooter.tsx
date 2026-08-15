import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { formatTimeAgoLabel } from '../../utils/reportFormatters';
import { useAvatarTooltip, AvatarTooltipBubble } from './AvatarTooltip';
import { UserAvatar } from './UserAvatar';

const TASK_STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Assigned',
  // Shown after the Accept API call succeeds — "Acknowledged" reads clearer
  // to the assignee than "Accepted" here, though the underlying status is
  // still literally ACCEPTED.
  ACCEPTED: 'Acknowledged',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
};

// Service's own status vocabulary — COMPLETED means work is done but OTP
// sign-off is still pending (per the backend dev guide), so it reads
// differently than commissioning's COMPLETED (which really is done).
// CLIENT_APPROVED (OTP verified) is service's actual "done" status.
const SERVICE_TASK_STATUS_LABEL: Record<string, string> = {
  ...TASK_STATUS_LABEL,
  COMPLETED: 'OTP Pending',
  CLIENT_APPROVED: 'Client Approved',
};

type Assignee = { name?: string; userId?: string; profilePic?: string | null };

type Props = {
  assignee?: Assignee;
  // Already resolved by the caller (e.g. task.assignedAt || task.date) —
  // this component only formats whichever date it's given, it doesn't
  // decide which field to prefer.
  createdAt?: string;
  status: string;
  // Service's COMPLETED/CLIENT_APPROVED read differently than
  // commissioning's own COMPLETED — see SERVICE_TASK_STATUS_LABEL.
  isService?: boolean;
  // Action button(s) — a caller opts into whichever it needs (Accept,
  // Assign, Start/Continue arrow, ...); this component only lays out
  // whatever's passed, it doesn't know about specific actions.
  children?: React.ReactNode;
};

// Shared footer row — dark time pill (assignee avatar + relative time) +
// status pill, grouped together on the left, plus a children slot on the
// right for the caller's own action button(s). Used by TaskPreviewCard's
// Active Task/Recent Completed cards.
export function TaskCardFooter({ assignee, createdAt, status, isService, children }: Props) {
  const relativeLabel = createdAt ? formatTimeAgoLabel(createdAt) : '';
  const isDone = isService
    ? (status === 'CLIENT_APPROVED' || status === 'CLOSED')
    : (status === 'COMPLETED' || status === 'CLOSED');
  const isAssigned = status === 'ASSIGNED';
  const statusLabel = (isService ? SERVICE_TASK_STATUS_LABEL : TASK_STATUS_LABEL)[status] || status;

  // Tapping the avatar reveals the assignee's name — the pill next to it
  // only ever shows a relative time, never who it actually is.
  const { revealedId, side: tooltipSide, toggle: toggleRevealed } = useAvatarTooltip();
  const avatarRef = React.useRef<View>(null);
  const avatarKey = assignee?.userId || 'assignee';

  return (
    <View style={styles.footerRow}>
      {/* Time + status grouped together on the left, rather than status
          pushed all the way to the far right by the row's own
          space-between — that gap only opens up between this group and
          the action button, when one is present. */}
      <View style={styles.footerLeftGroup}>
        {!!relativeLabel && (
          <View style={styles.timePill}>
            <TouchableOpacity
              ref={avatarRef}
              activeOpacity={0.7}
              onPress={() => assignee?.name && toggleRevealed(avatarKey, avatarRef)}
            >
              <UserAvatar userId={assignee?.userId} name={assignee?.name || ''} size={30} style={styles.timePillAvatarBorder} />
            </TouchableOpacity>
            <Text style={styles.timePillText} allowFontScaling={false}>{relativeLabel}</Text>
            <AvatarTooltipBubble visible={revealedId === avatarKey} side={tooltipSide} name={assignee?.name || ''} />
          </View>
        )}
        <View style={[styles.statusPill, isAssigned && styles.statusPillAssigned, isDone && styles.statusPillDone]}>
          <Text
            style={[styles.statusPillText, isAssigned && styles.statusPillTextAssigned, isDone && styles.statusPillTextDone]}
            allowFontScaling={false}
          >
            {statusLabel}
          </Text>
        </View>
      </View>
      {/* marginLeft: 'auto' (not just the row's own space-between) is what
          keeps the action button pinned to the right even when it's forced
          onto its own wrapped line below the time/status pills — a device
          with a larger system text size (allowFontScaling above only
          covers this row's own labels, not the assignee name driving
          relativeLabel's width) can still push the left group wide enough
          to wrap. Without this, a lone wrapped flex item with no sibling
          to "space between" against collapses to the row's start (left)
          instead, which is what looked broken/floating on a narrow device. */}
      {!!children && <View style={styles.actionSlot}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  // No flexWrap here — the time pill and status pill must always stay on
  // one line together as a single unit. Wrapping only ever needs to happen
  // one level up (footerRow), pushing this whole group above the action
  // button when the card is too narrow for both — not internally splitting
  // the two pills apart from each other.
  footerLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  actionSlot: { marginLeft: 'auto' },
  timePill: {
    position: 'relative',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#1A1A1A',
    borderRadius: 24,
    paddingVertical: 6, paddingHorizontal: 8,
  },
  timePillText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  timePillAvatarBorder: { borderWidth: 2, borderColor: '#FFFFFF' },
  statusPill: {
    backgroundColor: '#FFE3D4',
    borderRadius: 20,
    paddingVertical: 5, paddingHorizontal: 12,
  },
  statusPillText: { color: '#FB7C42', fontSize: 13, fontWeight: '500' },
  // ASSIGNED gets its own blue tint, distinct from the amber default used by
  // every other still-active status (Acknowledged/In Progress).
  statusPillAssigned: { backgroundColor: '#DBEAFE' },
  statusPillTextAssigned: { color: '#2563EB' },
  // Completed/Closed: same green "Completed" tokens used elsewhere in the
  // app — not new colors invented for this card.
  statusPillDone: { backgroundColor: '#DCFCE7' },
  statusPillTextDone: { color: '#15803D' },
});
