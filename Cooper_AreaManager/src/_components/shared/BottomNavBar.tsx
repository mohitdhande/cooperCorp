import React from 'react';
import { View, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LayoutGrid, Wrench, User } from 'lucide-react-native';
import Svg, { Path, Rect } from 'react-native-svg';

// Same 420px Figma reference frame the Dashboard/Commissioning screens
// scale their paddings off.
const REF_WIDTH = 420;

// The reference design's own genset icon (assets/genset.svg), redrawn here
// as react-native-svg primitives instead of requiring the file directly —
// this project has no react-native-svg-transformer/metro.config.js set up,
// so a bare `require('../../assets/genset.svg')` wouldn't compile into a
// usable component. Path/Rect data copied verbatim from that file; stroke
// takes `color` instead of the file's hardcoded black, so it responds to
// the same active/inactive tint the other nav icons already use.
function GensetIcon({ size = 20, color = '#9CA3AF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 12.5L10.75 5L16.5 5.5L12.75 9.5H19L8.5 19.5L10.5 12.5H6Z"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x="1.75" y="1.75" width="20.5" height="20.5" rx="2.25" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

export type BottomNavTab = 'home' | 'commissioning' | 'services' | 'profile';

type Props = { active: BottomNavTab };

// The persistent 4-icon + center-logo bottom bar, shared by Dashboard,
// Commissioning, Services, and Profile so any of the four is reachable
// from any of the others. The center logo is purely decorative — it used
// to open jobCards.tsx (the old pre-redesign tabbed screen), but this bar
// is meant to have no connectivity to that old UI at all except the
// Profile icon (the last icon), so the logo no longer navigates anywhere.
export function BottomNavBar({ active }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomBarPad = width * (12 / REF_WIDTH);

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: bottomBarPad }]}>
      <View style={styles.bar}>
        <TouchableOpacity style={styles.navIcon} onPress={() => router.replace('/screens/dashboard' as any)}>
          <LayoutGrid size={20} color={active === 'home' ? '#E76124' : '#9CA3AF'} />
        </TouchableOpacity>
          <TouchableOpacity style={styles.navIcon} onPress={() => router.replace('/screens/serviceTasks' as any)}>
          <Wrench size={20} color={active === 'services' ? '#E76124' : '#9CA3AF'} />
        </TouchableOpacity>
        <View style={styles.navCenterButton}>
          <Image source={require('@/assets/logo_circular.png')} style={styles.navCenterLogo} />
        </View>

        <TouchableOpacity style={styles.navIcon} onPress={() => router.replace('/screens/commissioningTasks' as any)}>
          <GensetIcon size={20} color={active === 'commissioning' ? '#E76124' : '#9CA3AF'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navIcon} onPress={() => router.replace('/screens/profile' as any)}>
          <User size={20} color={active === 'profile' ? '#E76124' : '#9CA3AF'} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingTop: 8 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#11101C',
    borderRadius: 100,
    padding: 8,
  },
  navIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#24222E',
    borderWidth: 1, borderColor: '#43404E',
    justifyContent: 'center', alignItems: 'center',
  },
  navCenterButton: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: '#E76124',
    justifyContent: 'center', alignItems: 'center',
  },
  navCenterLogo: { width: 44, height: 44, borderRadius: 22 },
});
