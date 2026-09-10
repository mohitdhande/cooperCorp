import React from 'react';
import { View, TouchableOpacity, StyleSheet, FlatList, RefreshControl, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Text } from '@/_components/AppText';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { ChevronLeft, Bell, CheckCheck } from 'lucide-react-native';
import { useNotificationsController, NotificationItem } from '../../controllers/notificationsController';
import { formatTimeAgoLabel } from '../../utils/reportFormatters';
import { LoadingOverlay } from '../../_components/shared/LoadingOverlay';
import { BottomNavBar } from '../../_components/shared/BottomNavBar';

const REF_WIDTH = 420;

// Same peach->light radial gradient backdrop as Dashboard/Commissioning/
// Services/SR Approvals (duplicated, not extracted — small, screen-specific
// visual, matches this codebase's existing convention of not sharing it).
function ScreenBackground() {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [size, setSize] = React.useState({ width: windowWidth, height: windowHeight });
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setSize({ width, height });
      }}
    >
      <Svg width={size.width} height={size.height}>
        <Defs>
          <RadialGradient id="notificationsBg" cx={size.width / 2} cy={size.height} r={size.height / 2} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#F5BC9D" stopOpacity={1} />
            <Stop offset="100%" stopColor="#F6F6F6" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#notificationsBg)" />
      </Svg>
    </View>
  );
}

function NotificationRow({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.row, !item.read && styles.rowUnread]} onPress={onPress}>
      {!item.read && <View style={styles.unreadDot} />}
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={2}>{item.title}</Text>
        {!!item.body && <Text style={styles.rowBody} numberOfLines={3}>{item.body}</Text>}
        <Text style={styles.rowTime}>{formatTimeAgoLabel(item.createdAt)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// The header bell's real destination (§16) — a persisted, per-user
// notification history, independent of whether push ever actually arrives.
export default function NotificationsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const headerPad = width * (30 / REF_WIDTH);

  const {
    items, loading, loadingMore, refreshing, error, hasMore,
    onRefresh, loadMore, handleOpenNotification,
    markingAllRead, handleMarkAllRead,
  } = useNotificationsController();

  const hasUnread = items.some((it) => !it.read);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenBackground />
      {loading && <LoadingOverlay />}

      <View style={[styles.header, { paddingHorizontal: headerPad }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <ChevronLeft size={22} color="#979797" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>NOTIFICATIONS</Text>
        <TouchableOpacity
          style={[styles.headerButton, (!hasUnread || markingAllRead) && styles.buttonDisabled]}
          onPress={handleMarkAllRead}
          disabled={!hasUnread || markingAllRead}
        >
          {markingAllRead ? <ActivityIndicator size="small" color="#F26722" /> : <CheckCheck size={20} color={hasUnread ? '#F26722' : '#C6C6C6'} />}
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingHorizontal: headerPad, paddingBottom: 130, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#F26722']} tintColor="#F26722" />}
        onEndReachedThreshold={0.4}
        onEndReached={loadMore}
        renderItem={({ item }) => <NotificationRow item={item} onPress={() => handleOpenNotification(item)} />}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color="#F26722" /> : null}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Bell size={32} color="#C6C6C6" />
              <Text style={styles.emptyText}>{error || 'No notifications yet.'}</Text>
            </View>
          ) : null
        }
      />

      {/* Floats over the FlatList (instead of sitting below it as a normal
          flex sibling) so rows keep visibly scrolling behind this bar rather
          than the scroll area stopping flush above it — same pattern as
          every other screen with this bar. */}
      <View style={styles.floatingFooter} pointerEvents="box-none">
        <BottomNavBar active="home" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6F6' },
  floatingFooter: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16,
  },
  headerButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#000000', letterSpacing: 0.4 },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
  },
  rowUnread: { backgroundColor: '#FFF7F2' },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#F26722',
    marginTop: 6,
  },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  rowBody: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginTop: 4 },
  rowTime: { fontSize: 12, fontWeight: '500', color: '#9CA3AF', marginTop: 6 },
  divider: { height: 10 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 80 },
  emptyText: { fontSize: 14, fontWeight: '500', color: '#9CA3AF' },
});
