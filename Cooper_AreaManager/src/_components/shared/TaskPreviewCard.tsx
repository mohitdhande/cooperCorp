import { formatDate, formatTimeAgoLabel, initials, taskTypeLabel, getTaskPeople } from '../../utils/reportFormatters';
import { View, TouchableOpacity, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '@/_components/AppText';
import { ArrowRight, BookmarkCheck, CalendarCheck, Check, ChevronRight, Clock, FileText, RefreshCw, Settings, UserCog } from 'lucide-react-native';
import { SERVICE_CATEGORIES } from '../srTaskForm/srDropdownOptions';
import { AssetIdentityHeader } from './AssetIdentityHeader';
import { AssetLocationContact } from './AssetLocationContact';
import { TaskNotesBlock } from './TaskNotesBlock';
import { TaskCardFooter } from './TaskCardFooter';

type Props = {
  task: any;
  // Defaults to the task's own status — pass this when a caller tracks a
  // client-side override after an accept/start action (optimistic update
  // before the list re-fetches).
  effectiveStatus?: string;
  isLoading?: boolean;
  errorMsg?: string;
  // What the arrow button does differs per caller — e.g. the Dashboard just
  // navigates away, while the Commissioning list screen runs the task's
  // real start/continue/report action.
  onArrowPress?: () => void;
  // Accept — while the task is still ASSIGNED, this replaces the arrow
  // button itself (a bookmark-check icon) rather than a separate thumb
  // button next to it. Opt-in: only passed by callers that wire real
  // actions.
  onAcceptPress?: () => void;
  // Dealer-only: replaces the arrow button with a text "ASSIGN" button that
  // opens the engineer picker, instead of Start/Continue — for a task
  // that's actually been handed off to one of the dealer's engineers
  // (dealers don't fill the form for their team's tasks). A task the dealer
  // assigned to *themselves* skips this entirely — callers only pass
  // onAssignPress for a dealer's team tasks, not their own, so the arrow's
  // normal Start/Continue/Complete behavior takes over instead. Available
  // at any pre-done status, including while still ASSIGNED — a dealer can
  // reassign a team task to a different engineer even before the original
  // one has accepted it.
  onAssignPress?: () => void;
  // Area-manager-only: area managers can BOTH fill the form themselves
  // (canFillTaskForm: true) AND assign the task down to one of their
  // dealers, so this adds a separate full-width "ASSIGN" row below the
  // existing footer instead of replacing the arrow — the arrow keeps doing
  // its normal Start/Continue job.
  onManagerAssignPress?: () => void;
  // Whole-card tap — opt-in, only passed when a caller needs it (e.g. the
  // Service Active tab opening SR Detail for a task awaiting RSM
  // confirmation). Fires alongside the existing tooltip-dismiss behavior,
  // never instead of it.
  onCardPress?: () => void;
  // Commissioning/Services want just the current assignee's avatar in the
  // top cluster, not the full createdBy->reassignments->assignedTo chain
  // the Dashboard shows — opt-in per screen rather than a global default,
  // since it's a real UX difference, not a bug either side.
  assigneeOnlyCluster?: boolean;
};

// The task-preview card design shared by the Dashboard's "Active Task"
// carousel and the Commissioning task list screen: an orange SR-number
// ribbon overlapping the card's top edge, a peach identity pill (icon +
// genset/engine + the real assignment-chain avatars), pin+address block,
// divided contact rows, a full-width dark type pill, a yellow note box, and
// a footer of time-pill/status-pill/arrow-button.
export function TaskPreviewCard({ task, effectiveStatus, isLoading, errorMsg, onArrowPress, onAcceptPress, onAssignPress, onManagerAssignPress, onCardPress, assigneeOnlyCluster }: Props) {
  const status = effectiveStatus || task.status;
  // Service tasks never carry a `type` (commissioning's PRE_COMMISSIONING/
  // COMMISSIONING/... enum) — that absence is the reliable tell, since not
  // every caller tags __kind the way the Dashboard's combined list does.
  const isService = task.__kind === 'service' || !task.type;
  // Service's COMPLETED status means work is done but OTP sign-off is still
  // pending (per the backend dev guide) — it's still an active, actionable
  // task, not done. Only CLIENT_APPROVED (OTP verified) or CLOSED count as
  // done for service. Commissioning's own COMPLETED really is done there.
  const isDone = isService
    ? (status === 'CLIENT_APPROVED' || status === 'CLOSED')
    : (status === 'COMPLETED' || status === 'CLOSED');
  // Service's own OTP-pending state — still active, but needs a call-out
  // since there's a real outstanding action (collect the customer's OTP)
  // rather than just "in progress" like the other active statuses.
  const isOtpPending = isService && status === 'COMPLETED';
  const isAssigned = status === 'ASSIGNED';
  // Accept only ever makes sense while a task is still literally ASSIGNED
  // (you can't "accept" something already in progress or done), so that
  // status check stays. Assign/Reassign has no equivalent status
  // restriction — a dealer needs to be able to reassign a task to a
  // different engineer even before that engineer has accepted it, not just
  // afterward. Callers already decide *whether* to pass onAssignPress at
  // all based on task ownership (never for a dealer's own self-assigned
  // task, only for one actually handed to a team member) — see
  // isMyOwnTask in dashboard.tsx/commissioningTasks.tsx/serviceTasks.tsx —
  // so this component doesn't need its own extra status gate on top of
  // that; Accept and Assign are already mutually exclusive at the prop
  // level for any single card.
  const showAcceptButton = !isDone && isAssigned && !!onAcceptPress;
  const showAssignButton = !isDone && !!onAssignPress;
  const showManagerAssignRow = !isDone && !!onManagerAssignPress;
  // Some callers (the Dashboard's Active Task preview) are read-only —
  // time + status only, no action circle at all — rather than a disabled
  // ghost button, when literally none of the action handlers were passed.
  const showActionButton = showAcceptButton || showAssignButton || !!onArrowPress;
  // Every avatar now loads from the authenticated /api/me/avatar/:userId
  // proxy (see UserAvatar) — userId + name is all AssetIdentityHeader/
  // TaskCardFooter need, so no photo resolution/caching happens here
  // anymore (task.assignedTo/createdBy/reassignments' own profilePic
  // fields, wherever still present in the raw task data, are simply
  // unused).
  const rawTaskPeople = getTaskPeople(task);
  const assignedTo = task.assignedTo;
  const taskPeople = assigneeOnlyCluster
    ? (assignedTo?.userId ? [assignedTo] : [])
    : rawTaskPeople;
  // Service tasks show their category on the full-width pill and their
  // subCategory on its own secondary pill below it — two separate labels,
  // not one combined string. Commissioning tasks show their full type name
  // ("Commissioning", "Pre-Comm", ...) on the full-width pill and have no
  // secondary pill at all. task.category itself only ever carries the
  // single-letter code (e.g. "B") — SERVICE_CATEGORIES is the same lookup
  // the New Service Request form uses to turn that into "Warranty Repair".
  const typePillLabel = isService
    ? (SERVICE_CATEGORIES.find((c) => c.letter === task.category)?.name || task.category)
    : taskTypeLabel(task);
  const subCategoryLabel = isService ? task.subCategory : null;

  return (
    <Pressable style={[styles.card, isOtpPending && styles.cardOtpPending]} onPress={onCardPress}>
      {isOtpPending && (
        <View style={styles.otpPendingBanner}>
          <Clock size={18} color="#E76124" />
          <Text style={styles.otpPendingBannerText}>OTP verification pending — collect customer sign-off</Text>
        </View>
      )}

      <AssetIdentityHeader task={task} isService={isService} taskPeople={taskPeople} />

      <AssetLocationContact asset={task.asset} />

      {/* Full type label — "Commissioning", or a service's category (+
          subCategory) — always its own full-width dark pill now, for both
          kinds of task, rather than commissioning's abbreviated "Comm" tag
          up in the top row. */}
      {!!typePillLabel && (
        <View style={[styles.typePillFull, isService && styles.typePillFullService]}>
          {isService ? <RefreshCw size={16} color="#FFFFFF" /> : <Settings size={16} color="#FFFFFF" />}
          <Text style={styles.typePillFullText}>{typePillLabel}</Text>
        </View>
      )}

      {/* Service-only secondary pill — the subCategory, directly below the
          category pill rather than folded into the same string. */}
      {!!subCategoryLabel && (
        <View style={styles.subCategoryPill}>
          <Text style={styles.subCategoryPillText}>{subCategoryLabel}</Text>
        </View>
      )}

      {/* Service tasks only carry a `title` (e.g. "accept_1") — shown above
          whichever status box follows (completed box or the notes box),
          same spot for every status rather than only once done. */}
      {isService && !!task.title && (
        <Text style={styles.taskTitleText}>{task.title}</Text>
      )}

      {/* Notes show regardless of status now — done tasks get both: notes
          above, the completed box below, rather than the completed box
          replacing notes entirely. */}
      <TaskNotesBlock notes={task.notes} />

      {isDone && (
        <View style={styles.completedBox}>
          <View style={styles.completedBoxLeft}>
            <CalendarCheck size={20} color="#16A34A" />
            <View>
              <Text style={styles.completedBoxLabel}>Completed</Text>
              <Text style={styles.completedBoxDate}>{formatDate(task.completedAt || task.date)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* AM -> RSM work-approval chain — a separate gate from the task's own
          ASSIGNED/IN_PROGRESS/COMPLETED lifecycle (a resubmission can be
          mid-approval while the task itself is still active), so this shows
          alongside whatever status the task itself is in, on every tab, not
          just completed cards. Each side shows its own decided-vs-pending
          state independently — AM is done once amDecidedAt exists, RSM is
          done only once the whole chain reaches CONFIRMED. REJECTED has its
          own dedicated UI elsewhere, so it's excluded here. */}
      {isService && !!task.workApproval && task.workApproval.status !== 'REJECTED' && (() => {
        // AM must have already approved for the chain to have ever reached
        // PENDING_RSM/CONFIRMED — treat those statuses as "AM done" too,
        // not just a populated amDecidedAt. Some entries reach CONFIRMED
        // without the backend ever sending amDecidedAt back, which
        // previously left this slot stuck showing "Pending" even once RSM
        // had already signed off (a state that can't actually happen).
        const amDone = !!task.workApproval.amDecidedAt || task.workApproval.status === 'PENDING_RSM' || task.workApproval.status === 'CONFIRMED';
        return (
        <View style={styles.approvalChainBox}>
          <View style={styles.approvalChainSlot}>
            {amDone ? (
              <View style={styles.approvalAvatarDone}>
                <Text style={styles.approvalAvatarDoneText}>{initials(task.workApproval.amDecidedBy?.name || 'AM')}</Text>
                <View style={styles.approvalBadgeDone}>
                  <Check size={9} color="#FFFFFF" strokeWidth={3} />
                </View>
              </View>
            ) : (
              <View style={styles.approvalAvatarPending}>
                <Text style={styles.approvalAvatarPendingText}>AM</Text>
                <View style={styles.approvalBadgePending}>
                  <Clock size={9} color="#FFFFFF" strokeWidth={3} />
                </View>
              </View>
            )}
            <View>
              <Text style={styles.approvalSlotLabel}>AM</Text>
              <Text style={amDone ? styles.approvalSlotTimeDone : styles.approvalSlotPending}>
                {task.workApproval.amDecidedAt
                  ? formatTimeAgoLabel(task.workApproval.amDecidedAt)
                  : amDone ? 'Approved' : 'Pending'}
              </Text>
            </View>
          </View>

          <ChevronRight size={16} color="#D1D5DB" />

          <View style={styles.approvalChainSlot}>
            {task.workApproval.status === 'CONFIRMED' ? (
              <View style={styles.approvalAvatarDone}>
                <Text style={styles.approvalAvatarDoneText}>{initials(task.workApproval.rsmDecidedBy?.name || 'RSM')}</Text>
                <View style={styles.approvalBadgeDone}>
                  <Check size={9} color="#FFFFFF" strokeWidth={3} />
                </View>
              </View>
            ) : (
              <View style={styles.approvalAvatarPending}>
                <Text style={styles.approvalAvatarPendingText}>{initials(task.workApproval.rsmInfo?.name || 'RSM')}</Text>
                <View style={styles.approvalBadgePending}>
                  <Clock size={9} color="#FFFFFF" strokeWidth={3} />
                </View>
              </View>
            )}
            <View>
              <Text style={styles.approvalSlotLabel}>RSM</Text>
              <Text style={task.workApproval.status === 'CONFIRMED' ? styles.approvalSlotTimeDone : styles.approvalSlotPending}>
                {task.workApproval.status === 'CONFIRMED' && task.workApproval.rsmDecidedAt
                  ? formatTimeAgoLabel(task.workApproval.rsmDecidedAt)
                  : 'Pending'}
              </Text>
            </View>
          </View>
        </View>
        );
      })()}

      {!!errorMsg && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      )}

      {/* task.createdAt — matches the reference design's own TaskCardFooter,
          which reads task.createdAt directly (confirmed in its source, not
          assumed). The previous task.date-first order was wrong: task.date
          is a plain calendar-day value (always midnight UTC), so the pill
          was showing time elapsed since UTC midnight rather than since the
          task actually existed — e.g. reading "10 hours ago" for a task
          created minutes earlier, just because it happened to be checked
          late in the day. task.date stays as the fallback for the rare case
          createdAt is missing. */}
      <TaskCardFooter assignee={assignedTo} createdAt={task.createdAt || task.date} status={status} isService={isService}>
        {showActionButton && (
          showAcceptButton ? (
            <TouchableOpacity
              style={[styles.arrowButton, isService && styles.arrowButtonService]}
              onPress={onAcceptPress}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <BookmarkCheck size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          ) : showAssignButton ? (
            <TouchableOpacity
              style={[styles.arrowButton, isService && styles.arrowButtonService]}
              onPress={onAssignPress}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <UserCog size={20} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.arrowButton, isService && !isDone && styles.arrowButtonService, isDone && styles.arrowButtonDone]}
              onPress={onArrowPress}
              disabled={!onArrowPress || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : isDone ? (
                <FileText size={20} color="#FFFFFF" />
              ) : status === 'IN_PROGRESS' || isOtpPending ? (
                // Once started, this same button's next tap continues into
                // the form rather than starting again — the thinner chevron
                // reads as "continue" instead of "begin". OTP-pending is the
                // same "continue" case (back into srTaskForm's Step 5).
                <ChevronRight size={24} color="#FFFFFF" />
              ) : (
                <ArrowRight size={22} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          )
        )}
      </TaskCardFooter>

      {showManagerAssignRow && (
        <TouchableOpacity
          style={styles.managerAssignRow}
          onPress={onManagerAssignPress}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.managerAssignRowText}>ASSIGN</Text>
          )}
        </TouchableOpacity>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 20,
    gap: 16,
  },
  // Service's OTP-pending state — a thin orange outline on the whole card
  // plus the banner below, matching the "still needs an action" treatment
  // ASSIGNED/pending-approval states get elsewhere in the app.
  cardOtpPending: { borderWidth: 1.5, borderColor: '#E76124' },
  otpPendingBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FDECD8',
    borderRadius: 16,
    padding: 14,
  },
  otpPendingBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#B8460E' },

  // Full-width type label — "Commissioning" or a service's category, always
  // its own dark pill (icon + text), same spot for both task kinds.
  typePillFull: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#000000',
    borderRadius: 100,
    paddingVertical: 10, paddingHorizontal: 15,
  },
  // Service tasks use the same navy already established for their icon
  // chip/identity pill/ribbon, instead of commissioning's black.
  typePillFullService: { backgroundColor: '#1E1951' },
  typePillFullText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  // Service-only secondary pill — the subCategory, a lighter/quieter pill
  // directly under the category pill rather than folded into its text.
  subCategoryPill: {
    
    backgroundColor: '#EDEDF2',
    borderRadius: 100,
    paddingVertical: 8, paddingHorizontal: 18,
  },
  subCategoryPillText: { fontSize: 14, fontWeight: '600', color: '#4B4B57' },

  taskTitleText: { fontSize: 16, fontWeight: '700', color: '#000000' },

  // Replaces the notes box once a task is COMPLETED/CLOSED — the completion
  // date, not whatever note was left when the task was created.
  completedBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    backgroundColor: '#E7F7EC',
    borderRadius: 16,
    padding: 16,
  },
  completedBoxLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  completedBoxLabel: { fontSize: 14, fontWeight: '700', color: '#16A34A' },
  completedBoxDate: { fontSize: 15, fontWeight: '700', color: '#166534', marginTop: 2 },

  // AM -> RSM work-approval chain — one box, two slots, a chevron between.
  // Same pink/red tint the old RSM-only pending box used.
  approvalChainBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    backgroundColor: '#FDF2F2',
    borderRadius: 16,
    borderWidth: 1, borderColor: '#F5B5B5',
    padding: 14,
  },
  approvalChainSlot: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Decided — solid navy avatar + green checkmark badge, same "verified"
  // treatment as a messaging app's read-receipt badge.
  approvalAvatarDone: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1E1951',
    justifyContent: 'center', alignItems: 'center',
  },
  approvalAvatarDoneText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  approvalBadgeDone: {
    position: 'absolute', bottom: -2, right: -2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#16A34A',
    borderWidth: 1.5, borderColor: '#FDF2F2',
    justifyContent: 'center', alignItems: 'center',
  },
  // Not decided yet — pale/faded avatar (nobody specific to show, just the
  // role placeholder) + amber clock badge.
  approvalAvatarPending: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  approvalAvatarPendingText: { color: '#9CA3AF', fontWeight: '700', fontSize: 12 },
  approvalBadgePending: {
    position: 'absolute', bottom: -2, right: -2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#F59E0B',
    borderWidth: 1.5, borderColor: '#FDF2F2',
    justifyContent: 'center', alignItems: 'center',
  },
  approvalSlotLabel: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  approvalSlotTimeDone: { fontSize: 11, fontWeight: '600', color: '#166534', marginTop: 1 },
  approvalSlotPending: { fontSize: 14, fontWeight: '700', color: '#DC2626', marginTop: 1 },

  errorBox: { backgroundColor: '#FEE2E2', borderRadius: 12, padding: 10 },
  errorText: { color: '#DC2626', fontSize: 13, fontWeight: '500', textAlign: 'center' },

  arrowButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#E76124',
    borderWidth: 1, borderColor: '#F8BA3B',
    justifyContent: 'center', alignItems: 'center',
  },
  arrowButtonDone: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  arrowButtonService: { backgroundColor: '#1E1951', borderColor: '#1E1951' },
  // Area-manager-only extra row, below the time/status/arrow footer — a
  // full-width bar rather than a circular/pill button since it isn't
  // sharing a row with anything else.
  managerAssignRow: {
    height: 48, borderRadius: 24,
    backgroundColor: '#E76124',
    borderWidth: 1, borderColor: '#F8BA3B',
    justifyContent: 'center', alignItems: 'center',
  },
  managerAssignRowText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', letterSpacing: 0.6 },
});
