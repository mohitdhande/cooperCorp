import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { RefreshCw, Settings, Tag, Calendar } from 'lucide-react-native';
import { getTaskPeople } from '../../utils/reportFormatters';
import { UserAvatar } from './UserAvatar';
import { AssetIdentityHeader } from './AssetIdentityHeader';
import { SrNumberText } from './SrNumberText';

type Props = {
  task: any;
  // The task detail endpoint (getCommissioningTaskDetail) has no embedded
  // `asset` object — only an `assetId` string — so genset/engine numbers
  // come from the screen's own asset fetch (getAssetById), not from `task`.
  // Forwarded straight through to AssetIdentityHeader's own override props.
  gensetNumber?: string;
  engineNumber?: string;
};

// "07 Aug '26" — distinct from every other short-date helper in this app
// (formatShortDate/formatDate), which don't use the apostrophe-year form
// this card specifically wants. Scoped here rather than added to the
// shared formatters for one caller's own exact style.
function formatAposDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  const year = String(d.getFullYear()).slice(2);
  return `${day} ${month} '${year}`;
}

// Same status vocabulary as TaskCardFooter's own TASK_STATUS_LABEL, just
// with colors attached too — this card shows the pill standalone, not next
// to a dark time-pill background, so it needs its own bg/text tokens
// rather than TaskCardFooter's on-dark-pill white text.
const STATUS_INFO: Record<string, { label: string; bg: string; text: string }> = {
  ASSIGNED: { label: 'Assigned', bg: '#DBEAFE', text: '#2563EB' },
  ACCEPTED: { label: 'Acknowledged', bg: '#FEF3C7', text: '#92400E' },
  IN_PROGRESS: { label: 'In Progress', bg: '#FEF3C7', text: '#92400E' },
  COMPLETED: { label: 'Completed', bg: '#DCFCE7', text: '#15803D' },
  CLOSED: { label: 'Closed', bg: '#DCFCE7', text: '#15803D' },
};

// Wraps AssetIdentityHeader (the SAME SR-ribbon + identity-pill + avatar
// cluster used by TaskPreviewCard/Dashboard's SR Approvals card) instead of
// re-implementing that markup a second time — this used to be a fully
// separate, slightly-diverged copy (different pill colors, different
// avatar size, no tap-to-reveal tooltip). Adds only what's genuinely new
// here: the service-only category/status/date row underneath.
//
// Commissioning keeps its own separate layout below (inline "Comm" badge
// next to the SR pill) — that badge is real information on this screen
// specifically, since the Task Form's own header just says "TASK", not
// "COMMISSIONING" the way the SR form's header says "SERVICE". Merging it
// into AssetIdentityHeader too would mean adding type-badge support there,
// which no other caller of that component needs.
export function TaskSummaryHeader({ task, gensetNumber, engineNumber }: Props) {
  if (!task) return null;
  const taskPeople = getTaskPeople(task);
  // Service tasks never carry a `type` — same tell TaskPreviewCard uses.
  const isService = !task.type;

  if (isService) {
    const statusInfo = STATUS_INFO[task.status] || STATUS_INFO.ASSIGNED;
    const aposDate = formatAposDate(task.date);
    return (
      <View style={styles.card}>
        <AssetIdentityHeader
          task={task}
          isService
          taskPeople={taskPeople}
          gensetNumberOverride={gensetNumber}
          engineNumberOverride={engineNumber}
        />

        {/* Service tasks only carry a `title` (e.g. "accept_1") — same field
            TaskPreviewCard shows via its own taskTitleText, just not yet
            wired up here. */}
        {!!task.title && <Text style={styles.taskTitleText}>{task.title}</Text>}

        {(!!task.subCategory || !!task.category || !!task.status || !!aposDate) && (
          <View>
            {!!task.subCategory && <Text style={styles.subCategoryText}>{task.subCategory}</Text>}
            <View style={styles.metaRow}>
              {!!task.category && (
                <View style={styles.categoryTag}>
                  <Tag size={12} color="#2563EB" />
                  <Text style={styles.categoryTagText}>{task.category}</Text>
                </View>
              )}
              <View style={[styles.statusPill, { backgroundColor: statusInfo.bg }]}>
                <Text style={[styles.statusPillText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
              </View>
              {!!aposDate && (
                <View style={styles.dateRow}>
                  <Calendar size={14} color="#9CA3AF" />
                  <Text style={styles.dateText}>{aposDate}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  }

  // Commissioning — unchanged from before. Always the short "Comm" label
  // (matching TaskPreviewCard's own pill), regardless of the task's actual
  // PRE_COMMISSIONING/COMMISSIONING/REVALIDATION/RE_COMMISSIONING type.
  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <View style={styles.typePill}>
            <RefreshCw size={16} color="#FFFFFF" />
            <Text style={styles.typePillText}>Comm</Text>
          </View>
          {!!task.srNumber && (
            <View style={styles.srNumberPill}>
              <SrNumberText srNumber={task.srNumber} style={styles.srNumberPillText} numberOfLines={1} />
            </View>
          )}
        </View>
        {taskPeople.length > 0 && (
          <View style={styles.avatarCluster}>
            {taskPeople.map((person, idx) => (
              <View key={person.userId || idx} style={idx > 0 && styles.clusterAvatarOverlap}>
                <UserAvatar userId={person.userId} name={person.name} size={32} style={styles.clusterAvatarBorder} />
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.idPillRow}>
        <View style={styles.idIconChip}>
          <Settings size={16} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 8 }}>
          <Text style={styles.gensetNumber} numberOfLines={1}>{gensetNumber}</Text>
          <Text style={styles.engineNumber} numberOfLines={1}>{engineNumber}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 16,
    gap: 16,
    marginBottom: 16,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typePill: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    backgroundColor: '#454545',
    borderRadius: 40,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  typePillText: { color: '#FFFFFF', fontSize: 15, fontWeight: '500' },
  srNumberPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E1951',
    borderRadius: 40,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  srNumberPillText: { color: '#FFFFFF', fontSize: 12, fontFamily: 'monospace', letterSpacing: 0.5 },
  avatarCluster: { flexDirection: 'row' },
  clusterAvatarOverlap: { marginLeft: -10 },
  clusterAvatarBorder: { borderWidth: 2, borderColor: '#FFFFFF' },

  idPillRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F3F1FD',
    borderRadius: 24,
    paddingVertical: 6, paddingHorizontal: 8,
  },
  idIconChip: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#1E1951',
    justifyContent: 'center', alignItems: 'center',
  },
  gensetNumber: { fontSize: 17, fontWeight: '600', color: '#000000' },
  engineNumber: { fontSize: 17, fontWeight: '500', color: '#686868' },

  taskTitleText: { fontSize: 16, fontWeight: '700', color: '#000000' },

  // Service-only meta row — sub-category caption, then category tag +
  // status pill + date, all inline and wrapping if the screen is narrow.
  subCategoryText: { fontSize: 13, fontWeight: '600', color: '#6B7280', marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
  categoryTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#DBEAFE',
    borderRadius: 100,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  categoryTagText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  statusPill: { borderRadius: 100, paddingVertical: 5, paddingHorizontal: 12 },
  statusPillText: { fontSize: 13, fontWeight: '700' },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
});
