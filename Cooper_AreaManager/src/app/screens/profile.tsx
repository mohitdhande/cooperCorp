import React from 'react';
import { View, TouchableOpacity, StyleSheet, ScrollView, Alert, Modal, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Text } from '@/_components/AppText';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { ChevronLeft, Bell, Camera, User, Mail, Phone, MapPin, Key, LogOut, ChevronRight } from 'lucide-react-native';
import { useProfileScreenController } from '../../controllers/profileController';
import { BottomNavBar } from '../../_components/shared/BottomNavBar';
import { LoadingOverlay } from '../../_components/shared/LoadingOverlay';
import { formatRole, formatAddress, ROLE_BADGE, DEFAULT_ROLE_BADGE } from '../../utils/reportFormatters';
import { useAvatarTooltip, AvatarTooltipBubble } from '../../_components/shared/AvatarTooltip';
import { UserAvatar } from '../../_components/shared/UserAvatar';

const REF_WIDTH = 420;

// Cycled by index — team members don't carry a color of their own, same
// as every other avatar-initials fallback in this app, just varied here
// since several show up together in one list.
const AVATAR_PALETTE = ['#8B5E34', '#F97316', '#2563EB', '#16A34A', '#7C3AED', '#DB2777'];

// Same peach->light radial gradient backdrop as Dashboard/Commissioning.
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
          <RadialGradient id="profileBg" cx={size.width / 2} cy={size.height} r={size.height / 2} gradientUnits="userSpaceOnUse">
            <Stop offset="0%" stopColor="#F5BC9D" stopOpacity={1} />
            <Stop offset="100%" stopColor="#F6F6F6" stopOpacity={1} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#profileBg)" />
      </Svg>
    </View>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; color?: string }>; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconChip}>
        <Icon size={18} color="#6B7280" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || '--'}</Text>
      </View>
    </View>
  );
}

// Post-login account screen. Every displayed field (name/role/email/
// mobile/address/team) comes from GET /api/me/profile (myProfile) — the
// JWT-decoded `profile` cached at login only fills in as an instant-render
// fallback before myProfile arrives, and supplies userId for photo upload/
// remove. The TEAM section is role-dependent per the backend's own shape
// (peers for engineer, subordinates for dealer/areaManager, [] for rsm/
// admin) — not something re-derived from permissions.ts.
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const hPad = width * (20 / REF_WIDTH);
  const headerPad = width * (30 / REF_WIDTH);

  const {
    optionsVisible,
    setOptionsVisible,
    uploading,
    profile,
    myProfile,
    myProfileLoading,
    handleLogout,
    handleTakePhoto,
    handleChooseGallery,
    handleRemovePhoto,
  } = useProfileScreenController();
  const sheetPaddingBottom = Math.max(insets.bottom, 16) + 14;

  // Tapping a team member's avatar reveals their name in a pill next to
  // it, matching every other tappable avatar in the app — flips left/right
  // based on where the avatar actually sits on screen.
  const { revealedId: revealedTeamId, side: teamTooltipSide, toggle: toggleTeamRevealed } = useAvatarTooltip();
  const teamAvatarRefs = React.useRef<Record<string, View | null>>({});

  const team = myProfile?.team || [];

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <ScreenBackground />
        <LoadingOverlay />
      </SafeAreaView>
    );
  }

  const displayName = myProfile?.name || profile.name;
  const displayRole = myProfile?.role || profile.role;
  const displayProfilePic = myProfile?.profilePic ?? profile.profilePic;
  const roleBadge = ROLE_BADGE[displayRole] || DEFAULT_ROLE_BADGE;
  // dealerName is only set for a dealer's own profile — when present, it
  // reads as "which dealership" and sits right under the name, above the
  // role pill. When absent (engineer/areaManager/etc), context.am's own
  // areaNames (only populated with no _id for an area_manager's own
  // profile — see ProfileContextAM) goes after the pill instead.
  const dealerName = myProfile?.dealerName;
  const areaNames = myProfile?.context?.am?.areaNames || [];
  const email = myProfile?.email || profile.username;
  const mobile = myProfile?.mobile || '';
  const address = formatAddress(myProfile?.address);
  const showTeamSection = myProfileLoading || team.length > 0;

  // The real person above this user — an AM (dealer/engineer) and/or a
  // dealer (engineer only) — as opposed to context.am's areaNames-only
  // shape an area_manager's own profile returns for themselves (no _id).
  const superiorAM = myProfile?.context?.am?._id ? myProfile.context.am : null;
  const superiorDealer = myProfile?.context?.dealer;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScreenBackground />
      {uploading && <LoadingOverlay />}

      <View style={[styles.header, { paddingHorizontal: headerPad }]}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.replace('/screens/dashboard' as any)}>
          <ChevronLeft size={22} color="#979797" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>PROFILE</Text>
        <View style={styles.headerButton}>
          <Bell size={22} color="#979797" />
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: hPad, paddingBottom: 130 }}
      >
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={() => setOptionsVisible(true)} activeOpacity={0.8}>
            <View style={styles.avatarCircle}>
              {uploading ? (
                <ActivityIndicator size="large" color="#FFFFFF" />
              ) : (
                // cacheKey=displayProfilePic isn't rendered directly (avatars
                // always go through the authenticated /api/me/avatar proxy
                // now, never a raw profilePic URL) — it's only read here as a
                // change signal, so a just-uploaded/removed photo busts the
                // cached image at the same stable URL instead of the old
                // photo lingering until app restart.
                <UserAvatar userId={profile.userId} name={displayName} size={100} cacheKey={displayProfilePic} style={styles.avatarBorder} />
              )}
            </View>
            <View style={styles.avatarEditBadge}>
              <Camera size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.name}>{displayName}</Text>
          {!!dealerName && <Text style={styles.dealerNameText}>{dealerName}</Text>}
          <View style={[styles.rolePill, { backgroundColor: roleBadge.bg }]}>
            <Text style={[styles.rolePillText, { color: roleBadge.text }]}>{formatRole(displayRole)}</Text>
          </View>
          {!dealerName && areaNames.length > 0 && (
            <View style={styles.regionPillsRow}>
              {areaNames.map((area) => (
                <View key={area} style={styles.regionPill}>
                  <Text style={styles.regionPillText}>{area}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.card}>
          <InfoRow icon={User} label="Full Name" value={displayName} />
          <View style={styles.divider} />
          <InfoRow icon={Mail} label="Email ID" value={email} />
          <View style={styles.divider} />
          <InfoRow icon={Phone} label="Mobile Number" value={mobile} />
          <View style={styles.divider} />
          <InfoRow icon={MapPin} label="Address" value={address === '--' ? '' : address} />
        </View>

        {(!!superiorAM || !!superiorDealer) && (
          <View style={styles.card}>
            {!!superiorAM && (
              <View style={styles.teamRow}>
                <UserAvatar userId={superiorAM._id} name={superiorAM.name || ''} size={40} bg="#7C93B3" style={styles.teamAvatarBorder} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName}>{superiorAM.name}</Text>
                  <Text style={styles.teamCompany}>
                    Area Manager{(superiorAM.areaNames?.length ?? 0) > 0 ? ` · ${superiorAM.areaNames!.join(', ')}` : ''}
                  </Text>
                </View>
              </View>
            )}

            {!!superiorAM && !!superiorDealer && <View style={styles.divider} />}

            {!!superiorDealer && (
              <View style={styles.teamRow}>
                <UserAvatar userId={superiorDealer._id} name={superiorDealer.name} size={40} bg="#7C93B3" style={styles.teamAvatarBorder} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.teamName}>{superiorDealer.name}</Text>
                  <Text style={styles.teamCompany}>
                    Dealer{superiorDealer.dealerName ? ` · ${superiorDealer.dealerName}` : ''}
                  </Text>
                </View>
              </View>
            )}
          </View>
        )}

        {showTeamSection && (
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>TEAM</Text>
            {myProfileLoading ? (
              <ActivityIndicator color="#F26722" style={{ marginVertical: 12 }} />
            ) : team.length === 0 ? (
              <Text style={styles.emptyTeamText}>No team members yet.</Text>
            ) : (
              team.map((member, idx) => (
                <View key={member._id} style={styles.teamRow}>
                  <TouchableOpacity
                    ref={(el) => { teamAvatarRefs.current[member._id] = el; }}
                    style={{ position: 'relative' }}
                    activeOpacity={0.7}
                    onPress={() => toggleTeamRevealed(member._id, { current: teamAvatarRefs.current[member._id] })}
                  >
                    <UserAvatar
                      userId={member._id}
                      name={member.name}
                      size={40}
                      bg={AVATAR_PALETTE[idx % AVATAR_PALETTE.length]}
                      style={styles.teamAvatarBorder}
                    />
                    <AvatarTooltipBubble visible={revealedTeamId === member._id} side={teamTooltipSide} name={member.name} />
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamName}>{member.name}</Text>
                    {!!member.dealerName && <Text style={styles.teamCompany}>{member.dealerName}</Text>}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => Alert.alert('Change Password', 'Please contact your admin to reset your password.')}
          >
            <View style={styles.infoIconChip}>
              <Key size={18} color="#1E1951" />
            </View>
            <Text style={styles.actionText}>Change Password</Text>
            <ChevronRight size={18} color="#9CA3AF" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
            <View style={[styles.infoIconChip, { backgroundColor: '#FEE2E2' }]}>
              <LogOut size={18} color="#DC2626" />
            </View>
            <Text style={[styles.actionText, { color: '#DC2626' }]}>Logout</Text>
            <ChevronRight size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>

        {/* Moved here from the login screen. Reads app.json's own "version"
        field directly (via EAS's remote-managed, auto-incrementing build
        version — see eas.json) rather than a separately hardcoded copy
        that could drift out of sync. */}
        <Text style={styles.versionText}>v{Constants.expoConfig?.version}</Text>
      </ScrollView>

      <Modal visible={optionsVisible} transparent animationType="fade" onRequestClose={() => setOptionsVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setOptionsVisible(false)}>
          <View style={[styles.optionsSheet, { paddingBottom: sheetPaddingBottom }]}>
            <Text style={styles.optionsTitle}>Profile Photo</Text>

            <TouchableOpacity style={styles.optionRow} onPress={handleTakePhoto}>
              <Text style={styles.optionText}>Take Photo</Text>
            </TouchableOpacity>

            <View style={styles.optionDivider} />

            <TouchableOpacity style={styles.optionRow} onPress={handleChooseGallery}>
              <Text style={styles.optionText}>Choose from Gallery</Text>
            </TouchableOpacity>

            <View style={styles.optionDivider} />

            <TouchableOpacity style={styles.optionRow} onPress={handleRemovePhoto}>
              <Text style={[styles.optionText, { color: '#DC2626' }]}>Remove Photo</Text>
            </TouchableOpacity>

            <View style={styles.optionDivider} />

            <TouchableOpacity style={styles.optionRow} onPress={() => setOptionsVisible(false)}>
              <Text style={styles.optionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Floats over the ScrollView (instead of sitting below it as a
          normal flex sibling) so cards keep visibly scrolling behind this
          bar rather than the scroll area stopping flush above it. */}
      <View style={styles.floatingFooter} pointerEvents="box-none">
        <BottomNavBar active="profile" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F6F6' },

  floatingFooter: { position: 'absolute', left: 0, right: 0, bottom: 0 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerButton: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#000000', textTransform: 'uppercase' },

  avatarSection: { alignItems: 'center', marginTop: 12, marginBottom: 24 },
  avatarCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#7C93B3',
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
  },
  avatarBorder: { borderWidth: 3, borderColor: '#FFFFFF' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#F26722',
    borderWidth: 2, borderColor: '#F6F6F6',
    justifyContent: 'center', alignItems: 'center',
  },
  name: { fontSize: 22, fontWeight: '700', color: '#000000', marginTop: 14 },
  dealerNameText: { fontSize: 14, fontWeight: '500', color: '#9CA3AF', marginTop: 2 },
  rolePill: {
    borderRadius: 100,
    paddingHorizontal: 16, paddingVertical: 6,
    marginTop: 10,
  },
  rolePillText: { fontSize: 14, fontWeight: '700' },
  regionPillsRow: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 8, marginTop: 10, paddingHorizontal: 16,
  },
  regionPill: {
    backgroundColor: '#EDE9FE',
    borderRadius: 100,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  regionPillText: { fontSize: 13, fontWeight: '600', color: '#7C3AED' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 8,
    marginBottom: 16,
  },
  cardSectionLabel: {
    fontSize: 12, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.6,
    paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4,
  },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 8 },

  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 12, paddingVertical: 14,
  },
  infoIconChip: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center', alignItems: 'center',
  },
  infoLabel: { fontSize: 12, fontWeight: '500', color: '#9CA3AF' },
  infoValue: { fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 2 },

  teamRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 12, paddingVertical: 12,
  },
  teamAvatarBorder: { borderWidth: 2, borderColor: '#FFFFFF' },
  teamName: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  teamCompany: { fontSize: 13, fontWeight: '500', color: '#9CA3AF', marginTop: 2 },
  emptyTeamText: { fontSize: 13, color: '#9CA3AF', paddingHorizontal: 12, paddingBottom: 12 },

  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 12, paddingVertical: 14,
  },
  actionText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1F2937' },
  versionText: {
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
    fontSize: 12,
    color: '#9CA3AF',
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  optionsSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  optionsTitle: { fontSize: 16, fontWeight: '700', color: '#333', textAlign: 'center', marginBottom: 10 },
  optionRow: { paddingVertical: 14 },
  optionText: { fontSize: 16, fontWeight: '500', color: '#222' },
  optionDivider: { height: 1, backgroundColor: '#eee' },
});
