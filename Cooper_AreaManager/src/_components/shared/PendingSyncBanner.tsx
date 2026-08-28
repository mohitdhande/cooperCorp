import { useEffect, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Text } from '@/_components/AppText';
import { CloudOff, AlertTriangle } from 'lucide-react-native';
import { subscribeToSyncQueue, subscribeToSyncFailures, subscribeToSyncingStatus, clearSyncFailures, getSyncFailures } from '../../utils/syncEngine';
import { subscribeToMediaQueueCount, subscribeToMediaSyncingStatus } from '../../utils/mediaSyncEngine';

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
  const [isSyncing, setIsSyncing] = useState(false);
  // Same shape, one level up — pendingMediaQueue.ts/mediaSyncEngine.ts's
  // own counterpart for offline photo/video/PDF uploads. Combined into one
  // total below so the engineer sees a single, honest "N changes" number
  // covering both saved fields and saved media, rather than two banners
  // that could show at slightly different moments for what's really one
  // "not everything's synced yet" state.
  const [mediaPendingCount, setMediaPendingCount] = useState(0);
  const [isMediaSyncing, setIsMediaSyncing] = useState(false);

  useEffect(() => subscribeToSyncQueue(setPendingCount), []);
  useEffect(() => subscribeToSyncFailures(setFailedCount), []);
  useEffect(() => subscribeToSyncingStatus(setIsSyncing), []);
  useEffect(() => subscribeToMediaQueueCount(setMediaPendingCount), []);
  useEffect(() => subscribeToMediaSyncingStatus(setIsMediaSyncing), []);

  const totalPending = pendingCount + mediaPendingCount;
  const syncing = isSyncing || isMediaSyncing;

  // "Genset Identification (Task 68f2a91c...)" — the raw Mongo id suffix
  // means nothing to an engineer reading this on-site, so it's stripped
  // down to just the section name they'll actually recognize.
  const humanizeDescription = (description: string) =>
    description.replace(/\s*\((?:Task|Asset)\s+[a-f0-9]+\)\s*$/i, '').trim();

  // Shows exactly which sections were rejected, before actually clearing
  // them — tapping used to just wipe the count with no way to ever see
  // what "2 changes" even meant. The server's own rejection message
  // (whatever raw validation text it happens to send back) isn't shown
  // here either — that's backend-internal wording an engineer can't act
  // on; one plain, actionable instruction covers every case instead.
  const showFailureDetails = async () => {
    const failures = await getSyncFailures();
    if (failures.length === 0) { setFailedCount(0); return; }
    const sectionList = failures.map((f) => `• ${humanizeDescription(f.description)}`).join('\n');
    Alert.alert(
      `${failures.length} change${failures.length > 1 ? 's' : ''} couldn't be saved`,
      `${sectionList}\n\nPlease open the task again, re-enter this information, and save it again.`,
      [{ text: 'Dismiss', onPress: () => { clearSyncFailures(); setFailedCount(0); } }]
    );
  };

  return (
    <>
      {failedCount > 0 && (
        <TouchableOpacity
          style={[styles.banner, styles.failureBanner]}
          onPress={showFailureDetails}
        >
          <AlertTriangle size={16} color="#B91C1C" />
          <Text style={[styles.text, styles.failureText]}>
            {failedCount} change{failedCount > 1 ? 's' : ''} failed to sync and {failedCount > 1 ? 'were' : 'was'} not saved to the server — tap to view
          </Text>
        </TouchableOpacity>
      )}
      {syncing ? (
        // Shown the moment either sync engine actually starts replaying its
        // queue (both only flip their own flag once they've found a
        // non-empty queue), so this only ever appears right as connectivity
        // comes back with real changes to push — not on every silent
        // foreground/20s check that finds nothing to do.
        <View style={[styles.banner, styles.syncingBanner]}>
          <ActivityIndicator size="small" color="#1D4ED8" />
          <Text style={[styles.text, styles.syncingText]}>
            Back online — syncing {totalPending} change{totalPending > 1 ? 's' : ''}...
          </Text>
        </View>
      ) : totalPending > 0 && (
        <View style={styles.banner}>
          <CloudOff size={16} color="#B45309" />
          <Text style={styles.text}>
            {totalPending} change{totalPending > 1 ? 's' : ''} saved on this device — will sync once you're back online
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
  syncingBanner: { backgroundColor: '#DBEAFE' },
  syncingText: { color: '#1D4ED8' },
});
