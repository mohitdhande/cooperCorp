import React, { useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/_components/AppText';
import { Wrench, Settings, X } from 'lucide-react-native';
import {
  subscribeToForegroundNotification, navigateFromPushData, getNotificationCategory,
  ForegroundNotificationEvent,
} from '../../utils/pushNotificationHandlers';

const AUTO_DISMISS_MS = 5000;

// Fully custom, app-drawn banner for a push that arrives while the app is
// already open. The OS's own system-tray notification can't be restyled
// per type from this app's code at all — that's Android natively rendering
// whatever the raw FCM payload says, using one single app-wide icon and
// the OS's own fixed title style (see pushNotificationHandlers.ts's own
// comment on getNotificationCategory). This banner is the one place that
// customization IS actually achievable purely client-side, since it's
// ordinary RN UI this app draws itself instead of relying on the OS to
// draw anything — bold title, per-type icon+color, all fully controlled
// here.
export function ForegroundNotificationBanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [banner, setBanner] = useState<ForegroundNotificationEvent | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return subscribeToForegroundNotification((event) => {
      setBanner(event);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setBanner(null), AUTO_DISMISS_MS);
    });
  }, []);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (!banner) return null;

  const category = getNotificationCategory(banner.data?.type, banner.data);
  const Icon = category === 'commissioning' ? Settings : Wrench;
  const iconBg = category === 'commissioning' ? '#6366F1' : '#F26722';

  const dismiss = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setBanner(null);
  };

  return (
    <View style={[styles.container, { top: insets.top + 8 }]} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => {
          dismiss();
          navigateFromPushData(router, banner.data);
        }}
      >
        <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
          <Icon size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>{banner.title}</Text>
          {!!banner.body && <Text style={styles.body} numberOfLines={2}>{banner.body}</Text>}
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={dismiss}>
          <X size={16} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute', left: 12, right: 12,
    zIndex: 999, elevation: 999,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12,
    elevation: 8,
  },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 15, fontWeight: '800', color: '#111827' },
  body: { fontSize: 13, fontWeight: '500', color: '#6B7280', marginTop: 2 },
  closeButton: { padding: 4 },
});
