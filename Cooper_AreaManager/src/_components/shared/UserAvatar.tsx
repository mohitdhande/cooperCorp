import { useEffect, useState } from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/_components/AppText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getToken } from '../../utils/tokenStore';
import { API_URL } from '../../constants/StringConstants';
import { initials } from '../../utils/reportFormatters';

type Props = {
  // GET /api/me/avatar/:userId is an authenticated proxy in front of the
  // private GCS bucket — undefined/null just means "no photo," same as an
  // absent profilePic used to.
  userId?: string | null;
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  bg?: string;
  // Changing this forces a fresh fetch instead of whatever's cached under
  // the same /api/me/avatar/:userId URL — the endpoint's own URL never
  // changes when the photo itself does (upload/remove), so without this a
  // just-uploaded photo could keep showing the previous cached image.
  // Pass something that changes when the photo does, e.g. myProfile's own
  // profilePic/updatedAt field (still useful as a change signal even
  // though its URL value itself is never rendered directly anymore).
  cacheKey?: string | number | null;
};

// Per the backend dev guide: avatar URLs must never be rendered directly
// from a person's own record (task.assignedTo.profilePic, TeamMember.
// profilePic, ...) — those are raw/signed GCS URLs that expire and the app
// has no way to refresh. GET /api/me/avatar/:userId is the one stable,
// authenticated source for every avatar in the app; this component is the
// only place that should ever build that URL, so any future avatar spot
// stays correct by construction instead of re-discovering this rule.
export function UserAvatar({ userId, name, size = 40, style, bg = '#1E1951', cacheKey }: Props) {
  const [authHeader, setAuthHeader] = useState<Record<string, string> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getToken().then((token) => {
      if (!cancelled && token) setAuthHeader({ Authorization: `Bearer ${token}` });
    });
    return () => { cancelled = true; };
  }, []);

  // A fresh userId (e.g. this same avatar slot recycled for a different
  // person in a list) or a changed cacheKey (this exact person's photo was
  // just updated) deserves a fresh attempt, not a stuck failed state from
  // before.
  useEffect(() => { setFailed(false); }, [userId, cacheKey]);

  const showPhoto = !!userId && !!authHeader && !failed;
  const circleStyle = [
    styles.circle,
    { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
    style,
  ];

  if (!showPhoto) {
    return (
      <View style={circleStyle}>
        <Text style={[styles.initialsText, { fontSize: size * 0.35 }]}>{initials(name)}</Text>
      </View>
    );
  }

  const uri = `${API_URL}/api/me/avatar/${userId}${cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : ''}`;

  return (
    <View style={circleStyle}>
      <Image
        source={{ uri, headers: authHeader }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        onError={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  initialsText: { color: '#FFFFFF', fontWeight: '700' },
});
