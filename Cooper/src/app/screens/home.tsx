import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHomeScreenController } from '../../controllers/homeController';

const { width } = Dimensions.get('window');

// Displays the home screen and keeps the drawer actions inside the controller.
export default function HomeScreen() {
  const {
    drawerVisible,
    openDrawer,
    closeDrawer,
    handleProfile,
    handleLogout,
    handleBackToLogin,
  } = useHomeScreenController();

  return (
    <SafeAreaView style={styles.container}>

      {/* ── AppBar ── */}
      <View style={styles.appBar}>
        <TouchableOpacity style={styles.iconButton} onPress={handleBackToLogin}>
          <Text style={styles.backArrow}>{'←'}</Text>
        </TouchableOpacity>

        <Text style={styles.appBarTitle}>Home</Text>

        <TouchableOpacity style={styles.iconButton} onPress={openDrawer}>
          <Text style={styles.menuIcon}>{'☰'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Body ── */}
      <View style={styles.body}>
        <Text style={styles.welcomeText}>Welcome to Home Screen</Text>
      </View>

      {/* ── Drawer (Modal sliding from right) ── */}
      <Modal
        visible={drawerVisible}
        transparent
        animationType="fade"
        onRequestClose={closeDrawer}
      >
        <Pressable style={styles.overlay} onPress={closeDrawer}>
          <View style={styles.drawer}>

            <TouchableOpacity style={styles.drawerItem} onPress={handleProfile}>
              <Text style={styles.drawerItemText}>👤  Profile</Text>
            </TouchableOpacity>

            <View style={styles.drawerDivider} />

            <TouchableOpacity style={styles.drawerItem} onPress={handleLogout}>
              <Text style={[styles.drawerItemText, { color: 'red' }]}>🚪  Logout</Text>
            </TouchableOpacity>

          </View>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2563EB',
    paddingHorizontal: width * 0.04,
    paddingVertical: width * 0.035,
    elevation: 4,
  },
  iconButton: { padding: 6, width: width * 0.1 },
  backArrow: { fontSize: width * 0.06, color: '#fff', fontWeight: '600' },
  menuIcon: { fontSize: width * 0.06, color: '#fff', textAlign: 'right' },
  appBarTitle: { fontSize: width * 0.05, fontWeight: '700', color: '#fff' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  welcomeText: { fontSize: width * 0.045, color: '#333' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: width * 0.6,
    backgroundColor: '#fff',
    paddingTop: width * 0.25,
    paddingHorizontal: width * 0.05,
    elevation: 10,
  },
  drawerItem: { paddingVertical: width * 0.04 },
  drawerItemText: { fontSize: width * 0.042, fontWeight: '600', color: '#222' },
  drawerDivider: { height: 1, backgroundColor: '#eee' },
});