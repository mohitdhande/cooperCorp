import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { Text } from '@/_components/AppText';
import { useNotifications } from '../../context/NotificationsContext';

type Props = {
  size?: number; // icon size
  containerSize?: number; // circle diameter — screens vary slightly (48 on
  // most headers, 55 on Dashboard's own bigger one)
  iconColor?: string;
};

// Replaces the plain decorative <Bell> every screen's header used to show —
// now a real button, navigating to the Notification Inbox (§16), with an
// unread-count badge sourced from the one shared NotificationsContext
// instead of each screen polling its own copy.
export function NotificationBellButton({ size = 22, containerSize = 48, iconColor = '#979797' }: Props) {
  const router = useRouter();
  const { unreadCount } = useNotifications();

  return (
    <TouchableOpacity
      style={[styles.button, { width: containerSize, height: containerSize, borderRadius: containerSize / 2 }]}
      onPress={() => router.push('/screens/notifications' as any)}
    >
      <Bell size={size} color={iconColor} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  badge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#DC2626',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
});
