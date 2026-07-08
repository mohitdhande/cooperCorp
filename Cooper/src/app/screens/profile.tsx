
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, Pressable, ActivityIndicator } from 'react-native';
import { useProfileScreenController } from '../../controllers/profileController';

// Renders the profile page and delegates photo and logout actions to the profile controller.
export default function ProfileScreen() {
  const router = useRouter();
  const {
    optionsVisible,
    setOptionsVisible,
    uploading,
    profile,
    imageError,
    setImageError,
    handleLogout,
    handleTakePhoto,
    handleChooseGallery,
    handleRemovePhoto,
  } = useProfileScreenController();

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Text>No profile data available.</Text>
      </View>
    );
  }
  const avatarSource = (profile.profilePic && !imageError)
  ? { uri: profile.profilePic }
  : { uri: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(profile.name) + '&size=200&background=2563EB&color=fff' };

  return (
    <View style={styles.container}>
      {/* ─── CUSTOM APP BAR ─── */}
      <View style={styles.appBar}>
       <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/screens/commissioningTasks')}>
  <Text style={styles.backText}>←</Text>
</TouchableOpacity>
        <Text style={styles.appBarTitle}>Profile</Text>
        <View style={styles.rightSpacer} />
      </View>

      {/* ─── AVATAR CIRCLE ─── */}
    <View style={styles.avatarContainer}>
  <TouchableOpacity onPress={() => setOptionsVisible(true)} activeOpacity={0.8}>
    <View style={styles.circleBorder}>
      {uploading ? (
        <ActivityIndicator size="large" color="#2563EB" />
      ) : (
        <Image 
          source={avatarSource}
          style={styles.avatarImage}
          onError={(e) => {
            console.log('IMAGE LOAD ERROR:', e.nativeEvent.error);
            setImageError(true);
          }}
        />
      )}
    </View>
    <View style={styles.editBadge}>
      <Text style={styles.editBadgeIcon}>📷</Text>
    </View>
  </TouchableOpacity>
  <Modal
  visible={optionsVisible}
  transparent
  animationType="fade"
  onRequestClose={() => setOptionsVisible(false)}
>
  <Pressable style={styles.modalOverlay} onPress={() => setOptionsVisible(false)}>
    <View style={styles.optionsSheet}>
      <Text style={styles.optionsTitle}>Profile Photo</Text>

      <TouchableOpacity style={styles.optionRow} onPress={handleTakePhoto}>
        <Text style={styles.optionText}>📷  Take Photo</Text>
      </TouchableOpacity>

      <View style={styles.optionDivider} />

      <TouchableOpacity style={styles.optionRow} onPress={handleChooseGallery}>
        <Text style={styles.optionText}>🖼️  Choose from Gallery</Text>
      </TouchableOpacity>

      <View style={styles.optionDivider} />

      <TouchableOpacity style={styles.optionRow} onPress={handleRemovePhoto}>
        <Text style={[styles.optionText, { color: 'red' }]}>🗑️  Remove Photo</Text>
      </TouchableOpacity>

      <View style={styles.optionDivider} />

      <TouchableOpacity style={styles.optionRow} onPress={() => setOptionsVisible(false)}>
        <Text style={styles.optionText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  </Pressable>
</Modal>
</View>

      {/* ─── INFORMATION LIST ─── */}
      <View style={styles.infoContainer}>
        <Text style={styles.nameHeader}>{profile.name}</Text>
        <Text style={styles.roleBadge}>{profile.role.toUpperCase()}</Text>

        <View style={styles.infoBox}>
          <Text style={styles.label}>User ID</Text>
          <Text style={styles.value}>{profile.userId}</Text>
          
          <View style={styles.divider} />

          <Text style={styles.label}>Username / Email</Text>
          <Text style={styles.value}>{profile.username}</Text>
          
          <View style={styles.divider} />

          <Text style={styles.label}>Token Issued At (iat)</Text>
          <Text style={styles.value}>{profile.iat}</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>Token Expires At (exp)</Text>
          <Text style={styles.value}>{profile.exp}</Text>

       {profile.dealerName && (
  <>
    <View style={styles.divider} />
    <Text style={styles.label}>Dealer Name</Text>
    <Text style={styles.value}>{profile.dealerName}</Text>
  </>
)}

{profile.areaId && (
  <>
    <View style={styles.divider} />
    <Text style={styles.label}>Area ID</Text>
    <Text style={styles.value}>{profile.areaId}</Text>
  </>
)}

        </View>
      </View>
      {/* ── Account Actions ── */}
<View style={styles.actionsCard}>

  <Text style={styles.sectionLabel}>ACCOUNT</Text>

  {/* Change Password */}
  <TouchableOpacity style={styles.actionRow}>
    <View style={styles.actionIconCircle}>
      <Text style={styles.actionIcon}>🔑</Text>
    </View>
    <Text style={styles.actionText}>Change Password</Text>
    <Text style={styles.actionChevron}>›</Text>
  </TouchableOpacity>

  <View style={styles.rowDivider} />

  {/* Logout */}
  <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
    <View style={[styles.actionIconCircle, { backgroundColor: '#FEE2E2' }]}>
      <Text style={styles.actionIcon}>🚪</Text>
    </View>
    <Text style={[styles.actionText, { color: '#DC2626' }]}>Logout</Text>
    <Text style={[styles.actionChevron, { color: '#DC2626' }]}>›</Text>
  </TouchableOpacity>

</View>

      
    </View>
  );
}

const styles = StyleSheet.create({
  
  actionsCard: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 32,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    paddingTop: 12,
    paddingBottom: 8,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  actionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionIcon: {
    fontSize: 16,
  },
  actionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
  },
  actionChevron: {
    fontSize: 20,
    color: '#9CA3AF',
    fontWeight: '300',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 50,
  },

    editBadge: {
  position: 'absolute',
  bottom: 0,
  right: 0,
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: '#2563EB',
  justifyContent: 'center',
  alignItems: 'center',
  borderWidth: 2,
  borderColor: '#fff',
},
editBadgeIcon: {
  fontSize: 14,
},
modalOverlay: {
  flex: 1,
  backgroundColor: 'rgba(0,0,0,0.4)',
  justifyContent: 'flex-end',
},
optionsSheet: {
  backgroundColor: '#fff',
  borderTopLeftRadius: 20,
  borderTopRightRadius: 20,
  paddingHorizontal: 20,
  paddingTop: 16,
  paddingBottom: 30,
},
optionsTitle: {
  fontSize: 16,
  fontWeight: '700',
  color: '#333',
  textAlign: 'center',
  marginBottom: 10,
},
optionRow: {
  paddingVertical: 14,
},
optionText: {
  fontSize: 16,
  fontWeight: '500',
  color: '#222',
},
optionDivider: {
  height: 1,
  backgroundColor: '#eee',
},
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  /* App Bar Styling */
  appBar: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingHorizontal: 16,
    paddingTop: 10, 
  },
  backButton: {
    padding: 8,
  },
  backText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
  },
  rightSpacer: {
    width: 40, // Keeps the title perfectly centered
  },
  /* Avatar Circle Styling */
  avatarContainer: {
    alignItems: 'center',
    marginTop: 30,
  },
  circleBorder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#000000', // Black border request
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  /* Info Fields Styling */
  infoContainer: {
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 20,
  },
  nameHeader: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
  },
  roleBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    backgroundColor: '#e9ecef',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 6,
    marginBottom: 20,
    letterSpacing: 1,
  },
  infoBox: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 15,
    color: '#333333',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#eeeeee',
    marginVertical: 12,
  },
});