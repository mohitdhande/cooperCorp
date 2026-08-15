import { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from '@/_components/AppText';
import { CloudOff, AlertTriangle } from 'lucide-react-native';
import { subscribeToSyncQueue, subscribeToSyncFailures, clearSyncFailures } from '../../utils/syncEngine';

// Shows "N changes saved offline" whenever the local sync queue isn't
// empty — the only visible sign to the engineer that something they saved
// hasn't actually reached the server yet. Renders nothing once the queue
// drains back to 0, and subscribes/unsubscribes to syncEngine's own
// pub-sub rather than polling, so it updates the moment a save gets
// queued or a sync run clears it.
//
// A second, separate banner covers the case that used to be invisible:
// a queued edit the server actually rejected (not a network error) was
// previously just dropped from the queue with a console.log — clearing
// the "saved offline" banner as if it had synced, when the edit had
// really just vanished. Tap to dismiss once you've seen it (there's no
// retry here — a rejection means the data itself needs fixing, not
// another attempt at the same payload).
export function PendingSyncBanner() {
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  useEffect(() => subscribeToSyncQueue(setPendingCount), []);
  useEffect(() => subscribeToSyncFailures(setFailedCount), []);

  return (
    <>
      {failedCount > 0 && (
        <TouchableOpacity
          style={[styles.banner, styles.failureBanner]}
          onPress={() => { clearSyncFailures(); setFailedCount(0); }}
        >
          <AlertTriangle size={16} color="#B91C1C" />
          <Text style={[styles.text, styles.failureText]}>
            {failedCount} change{failedCount > 1 ? 's' : ''} failed to sync and {failedCount > 1 ? 'were' : 'was'} not saved to the server — tap to dismiss
          </Text>
        </TouchableOpacity>
      )}
      {pendingCount > 0 && (
        <View style={styles.banner}>
          <CloudOff size={16} color="#B45309" />
          <Text style={styles.text}>
            {pendingCount} change{pendingCount > 1 ? 's' : ''} saved on this device — will sync once you're back online
          </Text>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 14,
    marginHorizontal: 20, marginBottom: 12,
  },
  text: { flex: 1, fontSize: 12, fontWeight: '600', color: '#92400E' },
  failureBanner: { backgroundColor: '#FEE2E2' },
  failureText: { color: '#B91C1C' },
});
