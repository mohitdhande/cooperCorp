import { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { TASK_TYPE_BADGE, DEFAULT_TASK_TYPE_BADGE, formatTaskType } from '../../utils/reportFormatters';

// History row's status pill — same status vocabulary/colors TaskPreviewCard
// uses (ASSIGNED blue, COMPLETED/CLOSED green, everything else amber).
const HISTORY_STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Assigned',
  ACCEPTED: 'Acknowledged',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
};
const HISTORY_STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  ASSIGNED: { bg: '#DBEAFE', text: '#2563EB' },
  COMPLETED: { bg: '#DCFCE7', text: '#15803D' },
  CLOSED: { bg: '#DCFCE7', text: '#15803D' },
};
const DEFAULT_HISTORY_STATUS_COLOR = { bg: '#FFE3D4', text: '#FB7C42' };

type Props = {
  // asset.history off GET /api/assets/:id — mixes commissioning-type
  // entries (PRE_COMMISSIONING/COMMISSIONING/REVALIDATION/RE_COMMISSIONING)
  // and service entries for this same asset, oldest to newest as the
  // backend returns them.
  history: any[];
};

// Collapsible "HISTORY (N)" card — past commissioning/service activity for
// the asset currently being searched. Originally only on New Job
// (commissioning); extracted here so New Service Job shows the exact same
// card instead of a second hand-rolled copy.
export function AssetHistorySection({ history }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={[styles.header, expanded && styles.headerExpanded]}
        onPress={() => setExpanded((v) => !v)}
      >
        <Text style={styles.title}>HISTORY ({history.length})</Text>
        {expanded ? <ChevronUp size={18} color="#9CA3AF" /> : <ChevronDown size={18} color="#9CA3AF" />}
      </TouchableOpacity>
      {expanded && (
        <View style={styles.body}>
          {history.length === 0 ? (
            <Text style={styles.infoText}>No past activity yet.</Text>
          ) : (
            history.map((h, i) => {
              const typeBadge = TASK_TYPE_BADGE[h.type] || DEFAULT_TASK_TYPE_BADGE;
              const statusColor = (h.status && HISTORY_STATUS_COLOR[h.status]) || DEFAULT_HISTORY_STATUS_COLOR;
              return (
                <View key={i} style={styles.row}>
                  <View style={[styles.typePill, { backgroundColor: typeBadge.bg }]}>
                    <Text style={[styles.typePillText, { color: typeBadge.text }]} numberOfLines={1}>
                      {formatTaskType(h.type)}
                    </Text>
                  </View>
                  <Text style={styles.name} numberOfLines={1}>{h.assignedTo?.name || '—'}</Text>
                  {!!h.status && (
                    <View style={[styles.statusPill, { backgroundColor: statusColor.bg }]}>
                      <Text style={[styles.statusPillText, { color: statusColor.text }]} numberOfLines={1}>
                        {(HISTORY_STATUS_LABEL[h.status] || h.status).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, paddingHorizontal: 20,
  },
  headerExpanded: { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 14, fontWeight: '700', color: '#6B7280', letterSpacing: 0.4 },
  body: { padding: 16, paddingTop: 12, gap: 12 },
  infoText: { fontSize: 14, fontWeight: '600', color: '#1F2937', flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  typePill: { borderRadius: 100, paddingVertical: 6, paddingHorizontal: 12, flexShrink: 0 },
  typePillText: { fontSize: 12, fontWeight: '700' },
  name: { flex: 1, fontSize: 14, fontWeight: '600', color: '#4B5563' },
  statusPill: { borderRadius: 100, paddingVertical: 5, paddingHorizontal: 10, flexShrink: 0 },
  statusPillText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
});
