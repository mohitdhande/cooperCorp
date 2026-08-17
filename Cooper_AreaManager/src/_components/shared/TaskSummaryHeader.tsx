import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { Tag, Calendar } from 'lucide-react-native';
import { getTaskPeople } from '../../utils/reportFormatters';
import { AssetIdentityHeader } from './AssetIdentityHeader';

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
// re-implementing that markup a second time — both branches used to be
// fully separate, slightly-diverged copies (different pill colors, smaller
// avatars, no tap-to-reveal tooltip, no gensetModel-first bold line).
// Service adds the category/status/date row underneath; Commissioning adds
// just its own "Comm" type badge above — that badge is real information on
// this screen specifically, since the Task Form's own header just says
// "TASK", not "COMMISSIONING" the way the SR form's header says "SERVICE".
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

  // Commissioning — AssetIdentityHeader owns the SR ribbon + identity pill +
  // avatar cluster here too (same as the Service branch above).
  return (
    <View style={styles.card}>
      <AssetIdentityHeader
        task={task}
        isService={false}
        taskPeople={taskPeople}
        gensetNumberOverride={gensetNumber}
        engineNumberOverride={engineNumber}
      />
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
