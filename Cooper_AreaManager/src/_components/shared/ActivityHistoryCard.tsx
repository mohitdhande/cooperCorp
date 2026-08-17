import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { ChevronRight, FileText, Flag, MessageSquare, User } from 'lucide-react-native';
import { formatDuration, getActivityStages, getActivitySummary } from '../../utils/reportFormatters';

const STAGE_STYLE: Record<string, { icon: React.ComponentType<{ size?: number; color?: string }>; color: string }> = {
  created: { icon: User, color: '#EF4444' },
  assigned: { icon: Flag, color: '#F59E0B' },
  accepted: { icon: ChevronRight, color: '#3B82F6' },
  inProgress: { icon: FileText, color: '#16A34A' },
  completed: { icon: MessageSquare, color: '#16A34A' },
};

// The "Activity History" card on a completed task's report: three headline
// durations (Resolution/Response/Completion) plus a horizontal timeline of
// how long the task sat in each status before moving to the next — both
// derived purely from the task's own lifecycle timestamps.
export function ActivityHistoryCard({ task }: { task: any }) {
  const summary = getActivitySummary(task);
  const stages = getActivityStages(task);

  return (
    <View style={styles.card}>
      <View style={styles.headerPill}>
        <Text style={styles.headerText}>Activity History</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{formatDuration(summary.resolutionMs)}</Text>
          <Text style={styles.statLabel}>Resolution</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{formatDuration(summary.responseMs)}</Text>
          <Text style={styles.statLabel}>Response</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statValue}>{formatDuration(summary.completionMs)}</Text>
          <Text style={styles.statLabel}>Completion</Text>
        </View>
      </View>

      {/* All 5 stages fit in one fixed row now (no horizontal scroll) —
          equal-width flexible columns instead of a fixed 84px each, and the
          connector chevrons dropped since there's no longer room to spare
          for a purely decorative element. */}
      <View style={styles.timelineRow}>
        {stages.map((stage) => {
          const style = STAGE_STYLE[stage.key];
          const Icon = style.icon;
          return (
            <View key={stage.key} style={styles.stageCol}>
              <View style={[styles.stageCircle, { backgroundColor: style.color }]}>
                <Icon size={16} color="#FFFFFF" />
              </View>
              <Text style={[styles.stageDuration, { color: style.color }]}>{formatDuration(stage.durationMs)}</Text>
              <Text style={styles.stageLabel} numberOfLines={2}>{stage.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 20,
  },
  headerPill: {
    alignSelf: 'stretch',
    // Same light blue as taskForm.tsx's own Step 1 GroupHeader pill /
    // ReportSectionCard's header, not the previous lavender.
    backgroundColor: '#DBEAFE',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  headerText: { fontSize: 15, fontWeight: '700', color: '#1E1951' },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  statCol: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#000000' },
  statLabel: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', marginTop: 4 },

  timelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
  // flex:1 (not a fixed width) — 5 equal columns always share whatever
  // width the card has, so all 5 fit without needing to scroll.
  stageCol: { flex: 1, alignItems: 'center', paddingHorizontal: 2 },
  stageCircle: {
    width: 32, height: 32, borderRadius: 16,
    justifyContent: 'center', alignItems: 'center',
  },
  stageDuration: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  // What the duration above actually measures (e.g. "Accepted → Started")
  // — without this, the icon+number alone doesn't say what gap it's
  // timing, which is what prompted this label in the first place.
  stageLabel: { fontSize: 9, color: '#9CA3AF', marginTop: 3, textAlign: 'center', lineHeight: 11 },
});
