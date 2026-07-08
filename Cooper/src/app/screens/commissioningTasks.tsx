import React, { useEffect, useState } from 'react';
import { View, Text, Image,TouchableOpacity, StyleSheet, Dimensions, Alert, ActivityIndicator  } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosClient from '@/viewModel/axiosClient';
import { getMyTasksByStatus, acceptCommissioningTask, startCommissioningTask } from '@/viewModel/commisionAPi';
import { ScrollView, TextInput,  Modal, Pressable   } from 'react-native';
import { Ionicons } from '@expo/vector-icons';


const { width } = Dimensions.get('window');



const StatCard = ({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) => {
  return (
    <View
      style={{
        backgroundColor: color,
        width: width * 0.22,
height: 100,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: '#fff',
          fontSize: 24,
          fontWeight: '700',
        }}
      >
        {value}
      </Text>

      <Text
        style={{
          color: '#fff',
          marginTop: 4,
        }}
      >
        {title}
      </Text>
    </View>
  );
};




export default function CommissioningTasksScreen() {
  const [drawerVisible, setDrawerVisible] = useState(false);
const [userProfilePic, setUserProfilePic] = useState<string | null>(null);

    const [taskStatusOverrides, setTaskStatusOverrides] = useState<Record<string, string>>({});
const [taskActionLoading, setTaskActionLoading] = useState<Record<string, boolean>>({});
const [taskActionError, setTaskActionError] = useState<Record<string, string>>({});
    
    const [isLoading, setIsLoading] = useState(true);
    const [selectedBottomTab, setSelectedBottomTab] = useState('Commissioning Task');
const [srTasks, setSrTasks] = useState<any[]>([]);
const [srDashboard, setSrDashboard] = useState({
  total: 0, active: 0, completed: 0, closed: 0,
});
const [activeTasks, setActiveTasks] = useState<any[]>([]);
const [completedTasks, setCompletedTasks] = useState<any[]>([]);
const [closedTasks, setClosedTasks] = useState<any[]>([]);

  const router = useRouter();
  const [searchText, setSearchText] = useState('');

  const [userName, setUserName] = useState('');

const [dashboard, setDashboard] = useState({
  total: 0,
  active: 0,
  completed: 0,
  closed: 0,
});

const [selectedStatusTab, setSelectedStatusTab] =
  useState('Active');

useEffect(() => {
  loadUser();
  loadAllData();
}, []);

const loadAllData = async () => {
  setIsLoading(true);
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    const [activeData, completedData, closedData] = await Promise.all([
      getMyTasksByStatus(token, 'active'),
      getMyTasksByStatus(token, 'completed'),
      getMyTasksByStatus(token, 'closed'),
    ]);

    setActiveTasks(activeData.commissioning || []);
    setCompletedTasks(completedData.commissioning || []);
    setClosedTasks(closedData.commissioning || []);

    setDashboard({
      total: activeData.counts.commissioning.total,
      active: activeData.counts.commissioning.active,
      completed: activeData.counts.commissioning.completed,
      closed: activeData.counts.commissioning.closed,
    });

  } catch (error) {
    console.log(error);
  } finally {
    setIsLoading(false);
  }
};

const handleAcceptTask = async (taskId: string) => {
  setTaskActionLoading(prev => ({ ...prev, [taskId]: true }));
  setTaskActionError(prev => ({ ...prev, [taskId]: '' }));
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    await acceptCommissioningTask(token, taskId);
    setTaskStatusOverrides(prev => ({ ...prev, [taskId]: 'ACCEPTED' }));
  } catch (error: any) {
    const msg = error.response?.data?.message || 'Failed to accept task. Please try again.';
    setTaskActionError(prev => ({ ...prev, [taskId]: msg }));
  } finally {
    setTaskActionLoading(prev => ({ ...prev, [taskId]: false }));
  }
};

const handleStartTask = async (taskId: string) => {
  setTaskActionLoading(prev => ({ ...prev, [taskId]: true }));
  setTaskActionError(prev => ({ ...prev, [taskId]: '' }));
  try {
    const token = await AsyncStorage.getItem('token');
    if (!token) return;

    await startCommissioningTask(token, taskId);
    setTaskStatusOverrides(prev => ({ ...prev, [taskId]: 'IN_PROGRESS' }));
  } catch (error: any) {
    const msg = error.response?.data?.message || 'Failed to start task. Please try again.';
    setTaskActionError(prev => ({ ...prev, [taskId]: msg }));
  } finally {
    setTaskActionLoading(prev => ({ ...prev, [taskId]: false }));
  }
};

const getFilteredActiveTasks = () => activeTasks;

const getSrTasks = async () => {
  const token = await AsyncStorage.getItem('token');
  const data: any[] = [];
  setSrTasks(data);
  calculateSrDashboard(data);
};

const calculateSrDashboard = (tasks: any[]) => {
  setSrDashboard({
    total: tasks.length,
    active: tasks.filter(t => t.status === 'ACTIVE').length,
    completed: tasks.filter(t => t.status === 'COMPLETED').length,
    closed: tasks.filter(t => t.status === 'CLOSED').length,
  });
};

const getFilteredSrTasks = () => {
  const statusMap : Record<string, string> = { Active: 'ACTIVE', Completed: 'COMPLETED', Closed: 'CLOSED' };
  return srTasks.filter(task => task.status === statusMap[selectedStatusTab]);
};



const loadUser = async () => {
  try {
    const savedUser = await AsyncStorage.getItem('userData');

     if (savedUser) {
      const user = JSON.parse(savedUser);
      setUserName(user.name);
      setUserProfilePic(user.profilePic || null);
    }
  } catch (error) {
    console.log(error);
  }
};

const getFilteredTasks = () => {
  if (selectedStatusTab === 'Active') return activeTasks;
  if (selectedStatusTab === 'Completed') return completedTasks;
  if (selectedStatusTab === 'Closed') return closedTasks;
  return [];
};

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            router.replace('/screens/login');
          },
        },
      ]
    );
  };


const formatTaskType = (type: string) => {
    if (!type) return '';
    const map: Record<string, string> = {
      RE_COMMISSIONING: 'Re-Commissioning',
      REVALIDATION: 'Revalidation',
      COMMISSIONING: 'Commissioning',
      PRE_COMM: 'Pre-Comm',
    };
    return map[type] || type.replace(/_/g, ' ');
  };

  const formatAddress = (address: any) => {
    if (!address) return '—';
    const parts = [address.line1, address.city, address.district, address.state, address.pinCode]
      .filter(Boolean);
    return parts.join(', ');
  };

  // Counts shown inside the tab badges, matching the reference image
  const tabCounts: Record<string, number> = {
    Active: dashboard.active,
    Completed: dashboard.completed,
    Closed: dashboard.closed,
  };

  return (
  <SafeAreaView style={styles.container}>

    {/* ── AppBar ── */}
    <View style={styles.appBar}>
      <View style={styles.brandRow}>
        <Image source={require('../../../assets/logo_circular.png')} style={styles.logoImage} />
        <View>
          <Text style={styles.brandTitle}>Cooper Corp</Text>
          <Text style={styles.brandSubtitle}>Gentset E-FSR</Text>
        </View>
      </View>

      <View style={styles.rightSection}>
  {/* Avatar tap → goes to profile */}
  <TouchableOpacity onPress={() => router.push('/screens/profile' as any)}>
    {userProfilePic ? (
      <Image source={{ uri: userProfilePic }} style={styles.appBarAvatar} />
    ) : (
      <View style={styles.appBarAvatarFallback}>
        <Text style={styles.appBarAvatarText}>
          {userName.charAt(0).toUpperCase()}
        </Text>
      </View>
    )}
  </TouchableOpacity>
</View>
    </View>

    {/* ── Drawer Modal ── */}
    <Modal
      visible={drawerVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setDrawerVisible(false)}
    >
      <Pressable style={styles.drawerOverlay} onPress={() => setDrawerVisible(false)}>
        <Pressable style={styles.drawer} onPress={() => {}}>
          <View style={styles.drawerHeader}>
            {userProfilePic ? (
              <Image source={{ uri: userProfilePic }} style={styles.drawerAvatar} />
            ) : (
              <View style={[styles.drawerAvatar, styles.drawerAvatarFallback]}>
                <Text style={styles.drawerAvatarText}>
                  {userName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.drawerUserName}>{userName}</Text>
          </View>

          <View style={styles.drawerDivider} />

          <TouchableOpacity
            style={styles.drawerItem}
            onPress={() => { setDrawerVisible(false); router.push('/screens/profile' as any); }}
          >
            <Text style={styles.drawerItemIcon}>👤</Text>
            <Text style={styles.drawerItemText}>Profile</Text>
          </TouchableOpacity>

          <View style={styles.drawerDivider} />

          <TouchableOpacity style={styles.drawerItem}>
            <Text style={styles.drawerItemIcon}>🔑</Text>
            <Text style={styles.drawerItemText}>Change Password</Text>
          </TouchableOpacity>

          <View style={styles.drawerDivider} />

          <TouchableOpacity
            style={styles.drawerItem}
            onPress={() => {
              setDrawerVisible(false);
              handleLogout();
            }}
          >
            <Text style={styles.drawerItemIcon}>🚪</Text>
            <Text style={[styles.drawerItemText, { color: '#DC2626' }]}>Logout</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>

    {isLoading ? (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Loading your tasks...</Text>
      </View>
    ) : selectedBottomTab === 'Commissioning Task' ? (

      /* ── Full-screen scrollable with sticky tabs ── */
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}  // makes the status tabs sticky
      >
        {/* ── index 0: Header + Stats + Search (scrolls away) ── */}
        <View>
          <View style={styles.headerContainer}>
            <Text style={styles.heading}>Commissioning Task</Text>
            <Text style={styles.subHeading}>Tasks assigned to you</Text>
          </View>

          <View style={styles.statsContainer}>
            <StatCard title="Total"     value={dashboard.total}     color="#241D67" />
            <StatCard title="Active"    value={dashboard.active}    color="#241D67" />
            <StatCard title="Completed" value={dashboard.completed} color="#241D67" />
            <StatCard title="Closed"    value={dashboard.closed}    color="#241D67" />
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchBox}>
              <Ionicons name="search" size={22} color="#9CA3AF" />
              <TextInput
                placeholder="Search asset S/N, model or client..."
                placeholderTextColor="#9CA3AF"
                value={searchText}
                onChangeText={setSearchText}
                style={styles.searchInput}
              />
            </View>
          </View>
        </View>

        {/* ── index 1: STICKY Status Tabs ── */}
        <View style={styles.stickyTabsWrapper}>
          <View style={styles.stickyTabsRow}>
            {['Active', 'Completed', 'Closed'].map(label => {
              const isActive = selectedStatusTab === label;
              return (
                <TouchableOpacity
                  key={label}
                  onPress={() => setSelectedStatusTab(label)}
                  activeOpacity={0.7}
                  style={[styles.statusTab, isActive && styles.activeStatusTab]}
                >
                  <Text style={[styles.statusTabText, isActive && styles.activeStatusTabText]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── index 2: Task cards ── */}
        <View style={styles.taskContainer}>
          {getFilteredTasks().length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No {selectedStatusTab.toLowerCase()} commissioning tasks — you're all caught up.
              </Text>
            </View>
          ) : (
            getFilteredTasks().map(task => (
              <View key={task._id} style={styles.taskCard}>
                {/* Top Row */}
                <View style={styles.topRow}>
                  <View style={{ flexDirection: 'row' }}>
                    <Text style={styles.taskNumber}>{task.asset?.gensetNumber}</Text>
                    <Text style={styles.assetNumber}>{task.asset?.engineNumber}</Text>
                  </View>
                  <View style={styles.typeBadge}>
                    <Text style={styles.typeText}>●  {formatTaskType(task.type)}</Text>
                  </View>
                </View>
                <Text style={styles.dispatchText}>
                  🚚 Dispatched: {task.asset?.dispatchDate
                    ? new Date(task.asset.dispatchDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'}
                </Text>
                <View style={styles.clientBox}>
                  <Text style={styles.clientName}>🏢 {task.asset?.clientName}</Text>
                  <Text style={styles.address}>{formatAddress(task.asset?.address)}</Text>
                </View>
                <View style={styles.assignedRow}>
                  <Text style={styles.assignedText}>
                    Assigned: {task.assignedTo?.name} - {new Date(task.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                  {task.reassignments?.length > 0 && (
                    <Text style={styles.reassignCount}>↻ ({task.reassignments.length})</Text>
                  )}
                </View>
                <View style={styles.dateRow}>
                  <Text style={styles.dueText}>
                    Due: {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                  {task.isOverdue && (
                    <View style={styles.overdueBadge}>
                      <Text style={styles.overdueBadgeText}>Overdue</Text>
                    </View>
                  )}
                  {selectedStatusTab !== 'Active' && (
                    <Text style={styles.updatedText}>
                      Updated: {new Date(task.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </Text>
                  )}
                </View>
                {selectedStatusTab === 'Active' ? (
                  <>
                    {taskActionError[task._id] ? (
                      <View style={styles.taskErrorBox}>
                        <Text style={styles.taskErrorText}>{taskActionError[task._id]}</Text>
                      </View>
                    ) : null}
                    {(() => {
                      const effectiveStatus = taskStatusOverrides[task._id] || task.status;
                      const isLoading = taskActionLoading[task._id];
                      if (effectiveStatus === 'ASSIGNED') {
                        return (
                          <TouchableOpacity
                            style={[styles.activeActionButton, isLoading && styles.buttonDisabled]}
                            disabled={isLoading}
                            onPress={() => handleAcceptTask(task._id)}
                          >
                            {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.activeActionButtonText}>Accept Task</Text>}
                          </TouchableOpacity>
                        );
                      }
                      if (effectiveStatus === 'ACCEPTED') {
                        return (
                          <TouchableOpacity
                            style={[styles.activeActionButton, { backgroundColor: '#F26722' }, isLoading && styles.buttonDisabled]}
                            disabled={isLoading}
                            onPress={() => handleStartTask(task._id)}
                          >
                            {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.activeActionButtonText}>Start</Text>}
                          </TouchableOpacity>
                        );
                      }
                      return (
                        <TouchableOpacity
                          style={[styles.activeActionButton, { backgroundColor: '#16A34A' }]}
                          onPress={() => router.push({
                            pathname: '/screens/taskForm',
                            params: {
                              taskId: task._id,
                              assetId: task.asset?._id,
                              taskType: formatTaskType(task.type),
                              assignedToName: task.assignedTo?.name || '',
                              assignedToRole: task.assignedTo?.role || '',
                            },
                          } as any)}
                        >
                          <Text style={styles.activeActionButtonText}>Continue →</Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </>
                ) : (
                  <View style={styles.bottomRow}>
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedText}>
                        {task.status === 'COMPLETED' ? 'Completed' : task.status}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push({
                      pathname: '/screens/taskReport',
                      params: { task: JSON.stringify(task) },
                    } as any)}>
                      <Text style={styles.reportText}>📄  View Report</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
          <View style={{ height: 20 }} />
        </View>
      </ScrollView>

    ) : (
      /* ── SR Task tab ── */
      <>
        <View style={styles.headerContainer}>
          <Text style={styles.heading}>SR Job Cards</Text>
          <Text style={styles.subHeading}>Jobs assigned to you</Text>
        </View>

        <View style={styles.stickyTabsWrapper}>
          <View style={styles.stickyTabsRow}>
            {['Active', 'Completed', 'Closed'].map(label => {
              const isActive = selectedStatusTab === label;
              return (
                <TouchableOpacity
                  key={label}
                  onPress={() => setSelectedStatusTab(label)}
                  activeOpacity={0.7}
                  style={[styles.statusTab, isActive && styles.activeStatusTab]}
                >
                  <Text style={[styles.statusTabText, isActive && styles.activeStatusTabText]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
   
        
        <ScrollView style={styles.taskContainer}>
          {getFilteredSrTasks().length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No {selectedStatusTab.toLowerCase()} SR tasks — you're all caught up.
              </Text>
            </View>
          ) : (
            getFilteredSrTasks().map(task => (
              <View key={task._id} style={styles.taskCard} />
            ))
          )}
        </ScrollView>
      </>
    )}

    {/* ── Bottom Tab Bar ── */}
    <View style={styles.bottomBar}>
      <TouchableOpacity style={styles.bottomTab} onPress={() => setSelectedBottomTab('Commissioning Task')}>
        <Text style={selectedBottomTab === 'Commissioning Task' ? styles.activeBottomTab : styles.inactiveBottomTab}>
          Commissioning Task
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.bottomTab} onPress={() => setSelectedBottomTab('SR Task')}>
        <Text style={selectedBottomTab === 'SR Task' ? styles.activeBottomTab : styles.inactiveBottomTab}>
          SR Task
        </Text>
      </TouchableOpacity>
    </View>

  </SafeAreaView>
);
}

const styles = StyleSheet.create({
  // ── Sticky status tabs (Active / Completed / Closed) ──
  // Outer wrapper: full-width, this is what gets pinned by stickyHeaderIndices
  stickyTabsWrapper: {
    width: '100%',
    alignSelf: 'stretch',
    backgroundColor: '#f8f9fa',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  // Inner row: explicit row layout, no `gap` (unsupported on some Android/Hermes builds)
  stickyTabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  // Fallback (non-sticky) wrapper used on the SR Task tab
  statusTabsWrapperStatic: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  statusTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 12,
  },
  activeStatusTab: {
    backgroundColor: '#FFFFFF',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  statusTabText: {
    color: '#667085',
    fontWeight: '600',
    fontSize: 15,
  },
  activeStatusTabText: {
    color: '#241D67',
    fontWeight: '700',
  },
  statusTabBadge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    marginLeft: 6,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusTabBadgeActive: {
    backgroundColor: '#FFEDD5',
  },
  statusTabBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  statusTabBadgeTextActive: {
    color: '#C2410C',
  },

  appBarAvatar: {
    width: 34, height: 34, borderRadius: 17,
    borderWidth: 2, borderColor: '#fff',
    marginRight: 10,
  },
  appBarAvatarFallback: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: '#F26722',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 10,
  },
  appBarAvatarText: {
    color: '#fff', fontWeight: '700', fontSize: 14,
  },
  drawerIconButton: {
    padding: 6, gap: 5, justifyContent: 'center',
  },
  hamburgerLine: {
    width: 22, height: 2.5,
    backgroundColor: '#fff', borderRadius: 2,
    marginVertical: 2,
  },
  drawerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
  },
  drawer: {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: width * 0.65,
    backgroundColor: '#fff',
    paddingTop: 60, paddingHorizontal: 20,
    elevation: 10,
  },
  drawerHeader: {
    alignItems: 'center', marginBottom: 20,
  },
  drawerAvatar: {
    width: 64, height: 64, borderRadius: 32, marginBottom: 10,
  },
  drawerAvatarFallback: {
    backgroundColor: '#F26722', justifyContent: 'center', alignItems: 'center',
  },
  drawerAvatarText: {
    color: '#fff', fontWeight: '700', fontSize: 24,
  },
  drawerUserName: {
    fontSize: 16, fontWeight: '700', color: '#1F2937',
  },
  drawerItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16,
  },
  drawerItemIcon: { fontSize: 20, marginRight: 14 },
  drawerItemText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  drawerDivider: { height: 1, backgroundColor: '#E5E7EB' },
  taskErrorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 10,
    marginTop: 10,
    marginBottom: 6,
  },
  taskErrorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  assignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  reassignCount: {
    color: '#4F46E5',
    fontWeight: '600',
    marginLeft: 8,
  },
  overdueBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 10,
  },
  overdueBadgeText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
  },
  activeActionButton: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  activeActionButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '500',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E1B4B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  logoEmoji: {
    fontSize: 16,
  },
  logoImage: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  activeBadge: {
    backgroundColor: '#FFEDD5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeBadgeText: {
    color: '#C2410C',
    fontWeight: '600',
  },
  continueButton: {
    backgroundColor: '#F26722',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
  },
  continueButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyStateText: {
    color: '#9CA3AF',
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 15,
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskNumber: {
    color: '#241D67',
    fontSize: 18,
    fontWeight: '700',
  },
  assetNumber: {
    marginLeft: 10,
    color: '#98A2B3',
    fontSize: 16,
  },
  typeBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  typeText: {
    color: '#7E22CE',
    fontWeight: '600',
    fontSize: 13,
  },
  dispatchText: {
    marginTop: 12,
    color: '#667085',
    fontSize: 15,
  },
  clientBox: {
    backgroundColor: '#F9FAFB',
    borderRadius: 15,
    padding: 14,
    marginTop: 12,
  },
  clientName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#475467',
  },
  address: {
    marginTop: 8,
    color: '#667085',
    lineHeight: 22,
  },
  assignedText: {
    marginTop: 14,
    color: '#475467',
    fontWeight: '500',
  },
  dateRow: {
    flexDirection: 'row',
    marginTop: 10,
  },
  dueText: {
    color: 'red',
    fontWeight: '600',
  },
  updatedText: {
    marginLeft: 20,
    color: '#667085',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  completedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  completedText: {
    color: '#15803D',
    fontWeight: '600',
  },
  reportText: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 15,
    height: 50,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    paddingVertical: 0,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  mainTabsContainer: {
    marginTop: 20,
    paddingHorizontal: 15,
    maxHeight: 50,
  },
  mainTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 12,
  },
  activeMainTab: {
    backgroundColor: '#FFFFFF',
  },
  mainTabText: {
    color: '#667085',
    fontWeight: '600',
  },
  activeMainTabText: {
    color: '#241D67',
  },
  taskContainer: {
    flex: 1,
    marginTop: 20,
    paddingHorizontal: 20,
  },
  cardText: {
    fontSize: 15,
    marginTop: 8,
    color: '#666',
  },
  bottomBar: {
    height: 70,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  bottomTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBottomTab: {
    color: '#F26722',
    fontWeight: '700',
  },
  inactiveBottomTab: {
    color: '#98A2B3',
    fontWeight: '600',
  },
  headerContainer: {
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  heading: {
    fontSize: 34,
    fontWeight: '700',
    color: '#241D67',
  },
  subHeading: {
    fontSize: 18,
    color: '#6B7280',
    marginTop: 5,
  },
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 15,
    color: '#FFFFFF',
  },
  appBar: {
    height: 70,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#241D67',
    paddingHorizontal: width * 0.04,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  leftSpacer: {
    width: width * 0.18,
  },
  appBarTitle: {
    fontSize: width * 0.045,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 25,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  logoutText: {
    color: '#FFFFFF',
    fontSize: width * 0.035,
    fontWeight: '600',
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  placeholderText: {
    fontSize: width * 0.04,
    color: '#888',
    textAlign: 'center',
  },
});


// import React, { useEffect, useState } from 'react';
// import { View, Text, Image,TouchableOpacity, StyleSheet, Dimensions, Alert, ActivityIndicator  } from 'react-native';
// import { SafeAreaView } from 'react-native-safe-area-context';
// import { useRouter } from 'expo-router';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import axiosClient from '@/viewModel/axiosClient';
// import { getMyTasksByStatus, acceptCommissioningTask, startCommissioningTask } from '@/viewModel/commisionAPi';
// import { ScrollView, TextInput,  Modal, Pressable   } from 'react-native';
// import { Ionicons } from '@expo/vector-icons';


// const { width } = Dimensions.get('window');



// const StatCard = ({
//   title,
//   value,
//   color,
// }: {
//   title: string;
//   value: number;
//   color: string;
// }) => {
//   return (
//     <View
//       style={{
//         backgroundColor: color,
//         width: width * 0.22,
// height: 100,
//         borderRadius: 18,
//         justifyContent: 'center',
//         alignItems: 'center',
//       }}
//     >
//       <Text
//         style={{
//           color: '#fff',
//           fontSize: 24,
//           fontWeight: '700',
//         }}
//       >
//         {value}
//       </Text>

//       <Text
//         style={{
//           color: '#fff',
//           marginTop: 4,
//         }}
//       >
//         {title}
//       </Text>
//     </View>
//   );
// };




// export default function CommissioningTasksScreen() {
//   const [drawerVisible, setDrawerVisible] = useState(false);
// const [userProfilePic, setUserProfilePic] = useState<string | null>(null);

//     const [taskStatusOverrides, setTaskStatusOverrides] = useState<Record<string, string>>({});
// const [taskActionLoading, setTaskActionLoading] = useState<Record<string, boolean>>({});
// const [taskActionError, setTaskActionError] = useState<Record<string, string>>({});
    
//     const [isLoading, setIsLoading] = useState(true);
//     const [selectedBottomTab, setSelectedBottomTab] = useState('Commissioning Task');
// const [srTasks, setSrTasks] = useState<any[]>([]);
// const [srDashboard, setSrDashboard] = useState({
//   total: 0, active: 0, completed: 0, closed: 0,
// });
// const [activeTasks, setActiveTasks] = useState<any[]>([]);
// const [completedTasks, setCompletedTasks] = useState<any[]>([]);
// const [closedTasks, setClosedTasks] = useState<any[]>([]);

//   const router = useRouter();
//   const [searchText, setSearchText] = useState('');

//   const [userName, setUserName] = useState('');

// const [dashboard, setDashboard] = useState({
//   total: 0,
//   active: 0,
//   completed: 0,
//   closed: 0,
// });

// const [selectedStatusTab, setSelectedStatusTab] =
//   useState('Active');

// useEffect(() => {
//   loadUser();
//   loadAllData();
// }, []);

// const loadAllData = async () => {
//   setIsLoading(true);
//   try {
//     const token = await AsyncStorage.getItem('token');
//     if (!token) return;

//     const [activeData, completedData, closedData] = await Promise.all([
//       getMyTasksByStatus(token, 'active'),
//       getMyTasksByStatus(token, 'completed'),
//       getMyTasksByStatus(token, 'closed'),
//     ]);

//     setActiveTasks(activeData.commissioning || []);
//     setCompletedTasks(completedData.commissioning || []);
//     setClosedTasks(closedData.commissioning || []);

//     console.log('ACTIVE IDs:', (activeData.commissioning || []).map((t: any) => t._id));
//     console.log('ACTIVE tasks asset IDs:', (activeData.commissioning || []).map((t: any) => t.assetId));
//     console.log('COMPLETED IDs:', (completedData.commissioning || []).map((t: any) => t._id));
//     console.log('COMPLETED tasks asset IDs:', (completedData.commissioning || []).map((t: any) => t.assetId));
//     console.log('CLOSED IDs:', (closedData.commissioning || []).map((t: any) => t._id));


//     setDashboard({
//       total: activeData.counts.commissioning.total,
//       active: activeData.counts.commissioning.active,
//       completed: activeData.counts.commissioning.completed,
//       closed: activeData.counts.commissioning.closed,
//     });

//   } catch (error) {
//     console.log(error);
//   } finally {
//     setIsLoading(false);
//   }
// };

// const handleAcceptTask = async (taskId: string) => {
//   setTaskActionLoading(prev => ({ ...prev, [taskId]: true }));
//   setTaskActionError(prev => ({ ...prev, [taskId]: '' }));
//   try {
//     const token = await AsyncStorage.getItem('token');
//     if (!token) return;

//     await acceptCommissioningTask(token, taskId);

//     // Success — change button to "Start"
//     setTaskStatusOverrides(prev => ({ ...prev, [taskId]: 'ACCEPTED' }));
//   } catch (error: any) {
//     const msg = error.response?.data?.message || 'Failed to accept task. Please try again.';
//     setTaskActionError(prev => ({ ...prev, [taskId]: msg }));
//   } finally {
//     setTaskActionLoading(prev => ({ ...prev, [taskId]: false }));
//   }
// };

// const handleStartTask = async (taskId: string) => {
//   setTaskActionLoading(prev => ({ ...prev, [taskId]: true }));
//   setTaskActionError(prev => ({ ...prev, [taskId]: '' }));
//   try {
//     const token = await AsyncStorage.getItem('token');
//     if (!token) return;

//     await startCommissioningTask(token, taskId);

//     // Success — change button to "Continue"
//     setTaskStatusOverrides(prev => ({ ...prev, [taskId]: 'IN_PROGRESS' }));
//   } catch (error: any) {
//     const msg = error.response?.data?.message || 'Failed to start task. Please try again.';
//     setTaskActionError(prev => ({ ...prev, [taskId]: msg }));
//   } finally {
//     setTaskActionLoading(prev => ({ ...prev, [taskId]: false }));
//   }
// };

// const getFilteredActiveTasks = () => activeTasks;

// const getSrTasks = async () => {
//   const token = await AsyncStorage.getItem('token');
//   // TODO: Replace with actual API call
//   // const data = await getMySrTasks(token);
//   const data: any[] = []; // Empty for now
//   setSrTasks(data);
//   calculateSrDashboard(data);
// };

// const calculateSrDashboard = (tasks: any[]) => {
//   setSrDashboard({
//     total: tasks.length,
//     active: tasks.filter(t => t.status === 'ACTIVE').length,
//     completed: tasks.filter(t => t.status === 'COMPLETED').length,
//     closed: tasks.filter(t => t.status === 'CLOSED').length,
//   });
// };

// const getFilteredSrTasks = () => {
//   const statusMap : Record<string, string> = { Active: 'ACTIVE', Completed: 'COMPLETED', Closed: 'CLOSED' };
//   return srTasks.filter(task => task.status === statusMap[selectedStatusTab]);
// };



// const loadUser = async () => {
//   try {
//     const savedUser = await AsyncStorage.getItem('userData');

//      if (savedUser) {
//       const user = JSON.parse(savedUser);
//       setUserName(user.name);
//       setUserProfilePic(user.profilePic || null);
//     }
//   } catch (error) {
//     console.log(error);
//   }
// };

// const getFilteredTasks = () => {
//   if (selectedStatusTab === 'Active') return activeTasks;
//   if (selectedStatusTab === 'Completed') return completedTasks;
//   if (selectedStatusTab === 'Closed') return closedTasks;
//   return [];
// };

//   const handleLogout = () => {
//     Alert.alert(
//       'Logout',
//       'Are you sure you want to logout?',
//       [
//         { text: 'Cancel', style: 'cancel' },
//         {
//           text: 'Logout',
//           style: 'destructive',
//           onPress: async () => {
//             await AsyncStorage.clear();
//             router.replace('/screens/login');
//           },
//         },
//       ]
//     );
//   };


// const formatTaskType = (type: string) => {
//     if (!type) return '';
//     const map: Record<string, string> = {
//       RE_COMMISSIONING: 'Re-Commissioning',
//       REVALIDATION: 'Revalidation',
//       COMMISSIONING: 'Commissioning',
//       PRE_COMM: 'Pre-Comm',
//     };
//     return map[type] || type.replace(/_/g, ' ');
//   };

//   const formatAddress = (address: any) => {
//     if (!address) return '—';
//     const parts = [address.line1, address.city, address.district, address.state, address.pinCode]
//       .filter(Boolean);
//     return parts.join(', ');
//   };

//   return (
//   <SafeAreaView style={styles.container}>

//     {/* ── AppBar ── */}
//     <View style={styles.appBar}>
//       <View style={styles.brandRow}>
//         <Image source={require('../../../assets/logo_circular.png')} style={styles.logoImage} />
//         <View>
//           <Text style={styles.brandTitle}>Cooper Corp</Text>
//           <Text style={styles.brandSubtitle}>Gentset E-FSR</Text>
//         </View>
//       </View>

//       <View style={styles.rightSection}>
//         {/* User avatar */}
//         <TouchableOpacity onPress={() => router.push('/screens/profile' as any)}>
//           {userProfilePic ? (
//             <Image
//               source={{ uri: userProfilePic }}
//               style={styles.appBarAvatar}
//             />
//           ) : (
//             <View style={styles.appBarAvatarFallback}>
//               <Text style={styles.appBarAvatarText}>
//                 {userName.charAt(0).toUpperCase()}
//               </Text>
//             </View>
//           )}
//         </TouchableOpacity>

//         {/* Drawer icon */}
//         <TouchableOpacity
//           style={styles.drawerIconButton}
//           onPress={() => setDrawerVisible(true)}
//         >
//           <View style={styles.hamburgerLine} />
//           <View style={styles.hamburgerLine} />
//           <View style={styles.hamburgerLine} />
//         </TouchableOpacity>
//       </View>
//     </View>

//     {/* ── Drawer Modal ── */}
//     <Modal
//       visible={drawerVisible}
//       transparent
//       animationType="fade"
//       onRequestClose={() => setDrawerVisible(false)}
//     >
//       <Pressable style={styles.drawerOverlay} onPress={() => setDrawerVisible(false)}>
//         <Pressable style={styles.drawer} onPress={() => {}}>
//           {/* Profile pic + name header */}
//           <View style={styles.drawerHeader}>
//             {userProfilePic ? (
//               <Image source={{ uri: userProfilePic }} style={styles.drawerAvatar} />
//             ) : (
//               <View style={[styles.drawerAvatar, styles.drawerAvatarFallback]}>
//                 <Text style={styles.drawerAvatarText}>
//                   {userName.charAt(0).toUpperCase()}
//                 </Text>
//               </View>
//             )}
//             <Text style={styles.drawerUserName}>{userName}</Text>
//           </View>

//           <View style={styles.drawerDivider} />

//           <TouchableOpacity
//             style={styles.drawerItem}
//             onPress={() => { setDrawerVisible(false); router.push('/screens/profile' as any); }}
//           >
//             <Text style={styles.drawerItemIcon}>👤</Text>
//             <Text style={styles.drawerItemText}>Profile</Text>
//           </TouchableOpacity>

//           <View style={styles.drawerDivider} />

//           <TouchableOpacity style={styles.drawerItem}>
//             <Text style={styles.drawerItemIcon}>🔑</Text>
//             <Text style={styles.drawerItemText}>Change Password</Text>
//           </TouchableOpacity>

//           <View style={styles.drawerDivider} />

//           <TouchableOpacity
//             style={styles.drawerItem}
//             onPress={() => {
//               setDrawerVisible(false);
//               handleLogout();
//             }}
//           >
//             <Text style={styles.drawerItemIcon}>🚪</Text>
//             <Text style={[styles.drawerItemText, { color: '#DC2626' }]}>Logout</Text>
//           </TouchableOpacity>
//         </Pressable>
//       </Pressable>
//     </Modal>

//     {isLoading ? (
//       <View style={styles.loadingContainer}>
//         <ActivityIndicator size="large" color="#2563EB" />
//         <Text style={styles.loadingText}>Loading your tasks...</Text>
//       </View>
//     ) : selectedBottomTab === 'Commissioning Task' ? (

//       /* ── Full-screen scrollable with sticky tabs ── */
//       <ScrollView
//         style={{ flex: 1 }}
//         showsVerticalScrollIndicator={false}
//         stickyHeaderIndices={[1]}  // makes the status tabs sticky
//       >
//         {/* ── index 0: Header + Stats + Search (scrolls away) ── */}
//         <View>
//           <View style={styles.headerContainer}>
//             <Text style={styles.heading}>Commissioning Task</Text>
//             <Text style={styles.subHeading}>Tasks assigned to you</Text>
//           </View>

//           <View style={styles.statsContainer}>
//             <StatCard title="Total"     value={dashboard.total}     color="#241D67" />
//             <StatCard title="Active"    value={dashboard.active}    color="#F26722" />
//             <StatCard title="Completed" value={dashboard.completed} color="#00B140" />
//             <StatCard title="Closed"    value={dashboard.closed}    color="#7A8395" />
//           </View>

//           <View style={styles.searchContainer}>
//             <View style={styles.searchBox}>
//               <Ionicons name="search" size={22} color="#9CA3AF" />
//               <TextInput
//                 placeholder="Search asset S/N, model or client..."
//                 placeholderTextColor="#9CA3AF"
//                 value={searchText}
//                 onChangeText={setSearchText}
//                 style={styles.searchInput}
//               />
//             </View>
//           </View>
//         </View>

//         {/* ── index 1: STICKY Status Tabs ── */}
//       {/* ── index 1: STICKY Status Tabs ── */}
// <View style={styles.stickyTabsWrapper}>
//   {['Active', 'Completed', 'Closed'].map(label => {
//     const isActive = selectedStatusTab === label;
//     return (
//       <TouchableOpacity
//         key={label}
//         onPress={() => setSelectedStatusTab(label)}
//         style={[styles.statusTab, isActive && styles.activeStatusTab]}
//       >
//         <Text style={[styles.statusTabText, isActive && styles.activeStatusTabText]}>
//           {label}
//         </Text>
//       </TouchableOpacity>
//     );
//   })}
// </View>

//         {/* ── index 2: Task cards ── */}
//         <View style={styles.taskContainer}>
//           {getFilteredTasks().length === 0 ? (
//             <View style={styles.emptyState}>
//               <Text style={styles.emptyStateText}>
//                 No {selectedStatusTab.toLowerCase()} commissioning tasks — you're all caught up.
//               </Text>
//             </View>
//           ) : (
//             getFilteredTasks().map(task => (
//               <View key={task._id} style={styles.taskCard}>
//                 {/* … same task card JSX as before … */}
//                 {/* Top Row */}
//                 <View style={styles.topRow}>
//                   <View style={{ flexDirection: 'row' }}>
//                     <Text style={styles.taskNumber}>{task.asset?.gensetNumber}</Text>
//                     <Text style={styles.assetNumber}>{task.asset?.engineNumber}</Text>
//                   </View>
//                   <View style={styles.typeBadge}>
//                     <Text style={styles.typeText}>●  {formatTaskType(task.type)}</Text>
//                   </View>
//                 </View>
//                 <Text style={styles.dispatchText}>
//                   🚚 Dispatched: {task.asset?.dispatchDate
//                     ? new Date(task.asset.dispatchDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
//                     : '—'}
//                 </Text>
//                 <View style={styles.clientBox}>
//                   <Text style={styles.clientName}>🏢 {task.asset?.clientName}</Text>
//                   <Text style={styles.address}>{formatAddress(task.asset?.address)}</Text>
//                 </View>
//                 <View style={styles.assignedRow}>
//                   <Text style={styles.assignedText}>
//                     Assigned: {task.assignedTo?.name} - {new Date(task.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
//                   </Text>
//                   {task.reassignments?.length > 0 && (
//                     <Text style={styles.reassignCount}>↻ ({task.reassignments.length})</Text>
//                   )}
//                 </View>
//                 <View style={styles.dateRow}>
//                   <Text style={styles.dueText}>
//                     Due: {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
//                   </Text>
//                   {task.isOverdue && (
//                     <View style={styles.overdueBadge}>
//                       <Text style={styles.overdueBadgeText}>Overdue</Text>
//                     </View>
//                   )}
//                   {selectedStatusTab !== 'Active' && (
//                     <Text style={styles.updatedText}>
//                       Updated: {new Date(task.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
//                     </Text>
//                   )}
//                 </View>
//                 {selectedStatusTab === 'Active' ? (
//                   <>
//                     {taskActionError[task._id] ? (
//                       <View style={styles.taskErrorBox}>
//                         <Text style={styles.taskErrorText}>{taskActionError[task._id]}</Text>
//                       </View>
//                     ) : null}
//                     {(() => {
//                       const effectiveStatus = taskStatusOverrides[task._id] || task.status;
//                       const isLoading = taskActionLoading[task._id];
//                       if (effectiveStatus === 'ASSIGNED') {
//                         return (
//                           <TouchableOpacity
//                             style={[styles.activeActionButton, isLoading && styles.buttonDisabled]}
//                             disabled={isLoading}
//                             onPress={() => handleAcceptTask(task._id)}
//                           >
//                             {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.activeActionButtonText}>Accept Task</Text>}
//                           </TouchableOpacity>
//                         );
//                       }
//                       if (effectiveStatus === 'ACCEPTED') {
//                         return (
//                           <TouchableOpacity
//                             style={[styles.activeActionButton, { backgroundColor: '#F26722' }, isLoading && styles.buttonDisabled]}
//                             disabled={isLoading}
//                             onPress={() => handleStartTask(task._id)}
//                           >
//                             {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.activeActionButtonText}>Start</Text>}
//                           </TouchableOpacity>
//                         );
//                       }
//                       return (
//                         <TouchableOpacity
//                           style={[styles.activeActionButton, { backgroundColor: '#16A34A' }]}
//                           onPress={() => router.push({
//                             pathname: '/screens/taskForm',
//                             params: {
//                               taskId: task._id,
//                               assetId: task.asset?._id,
//                               taskType: formatTaskType(task.type),
//                               assignedToName: task.assignedTo?.name || '',
//                               assignedToRole: task.assignedTo?.role || '',
//                             },
//                           } as any)}
//                         >
//                           <Text style={styles.activeActionButtonText}>Continue →</Text>
//                         </TouchableOpacity>
//                       );
//                     })()}
//                   </>
//                 ) : (
//                   <View style={styles.bottomRow}>
//                     <View style={styles.completedBadge}>
//                       <Text style={styles.completedText}>
//                         {task.status === 'COMPLETED' ? 'Completed' : task.status}
//                       </Text>
//                     </View>
//                     <TouchableOpacity onPress={() => router.push({
//                       pathname: '/screens/taskReport',
//                       params: { task: JSON.stringify(task) },
//                     } as any)}>
//                       <Text style={styles.reportText}>📄  View Report</Text>
//                     </TouchableOpacity>
//                   </View>
//                 )}
//               </View>
//             ))
//           )}
//           <View style={{ height: 20 }} />
//         </View>
//       </ScrollView>

//     ) : (
//       /* ── SR Task tab ── */
//       <>
//         <View style={styles.headerContainer}>
//           <Text style={styles.heading}>SR Job Cards</Text>
//           <Text style={styles.subHeading}>Jobs assigned to you</Text>
//         </View>
//         <View style={styles.statusTabsContainer}>
//           {['Active', 'Completed', 'Closed'].map(tab => (
//             <TouchableOpacity
//               key={tab}
//               onPress={() => setSelectedStatusTab(tab)}
//               style={[styles.statusTab, selectedStatusTab === tab && styles.activeStatusTab]}
//             >
//               <Text style={[styles.statusTabText, selectedStatusTab === tab && styles.activeStatusTabText]}>
//                 {tab}
//               </Text>
//             </TouchableOpacity>
//           ))}
//         </View>
//         <ScrollView style={styles.taskContainer}>
//           {getFilteredSrTasks().length === 0 ? (
//             <View style={styles.emptyState}>
//               <Text style={styles.emptyStateText}>
//                 No {selectedStatusTab.toLowerCase()} SR tasks — you're all caught up.
//               </Text>
//             </View>
//           ) : (
//             getFilteredSrTasks().map(task => (
//               <View key={task._id} style={styles.taskCard} />
//             ))
//           )}
//         </ScrollView>
//       </>
//     )}

//     {/* ── Bottom Tab Bar ── */}
//     <View style={styles.bottomBar}>
//       <TouchableOpacity style={styles.bottomTab} onPress={() => setSelectedBottomTab('Commissioning Task')}>
//         <Text style={selectedBottomTab === 'Commissioning Task' ? styles.activeBottomTab : styles.inactiveBottomTab}>
//           Commissioning Task
//         </Text>
//       </TouchableOpacity>
//       <TouchableOpacity style={styles.bottomTab} onPress={() => setSelectedBottomTab('SR Task')}>
//         <Text style={selectedBottomTab === 'SR Task' ? styles.activeBottomTab : styles.inactiveBottomTab}>
//           SR Task
//         </Text>
//       </TouchableOpacity>
//     </View>

//   </SafeAreaView>
// );
// }

// const styles = StyleSheet.create({
// stickyTabsWrapper: {
//   flexDirection: 'row',
//   width: '100%',
//   alignItems: 'center',
//   paddingHorizontal: 20,
//   paddingVertical: 10,
//   backgroundColor: '#f8f9fa',
//   borderBottomWidth: 1,
//   borderBottomColor: '#E5E7EB',
// },

// statusTab: {
//   paddingHorizontal: 14,
//   paddingVertical: 8,
//   marginRight: 20,
//   borderRadius: 12,
// },



// appBarAvatar: {
//   width: 34, height: 34, borderRadius: 17,
//   borderWidth: 2, borderColor: '#fff',
//   marginRight: 10,
// },
// appBarAvatarFallback: {
//   width: 34, height: 34, borderRadius: 17,
//   backgroundColor: '#F26722',
//   justifyContent: 'center', alignItems: 'center',
//   marginRight: 10,
// },
// appBarAvatarText: {
//   color: '#fff', fontWeight: '700', fontSize: 14,
// },
// drawerIconButton: {
//   padding: 6, gap: 5, justifyContent: 'center',
// },
// hamburgerLine: {
//   width: 22, height: 2.5,
//   backgroundColor: '#fff', borderRadius: 2,
//   marginVertical: 2,
// },
// drawerOverlay: {
//   flex: 1, backgroundColor: 'rgba(0,0,0,0.35)',
// },
// drawer: {
//   position: 'absolute', top: 0, right: 0, bottom: 0,
//   width: width * 0.65,
//   backgroundColor: '#fff',
//   paddingTop: 60, paddingHorizontal: 20,
//   elevation: 10,
// },
// drawerHeader: {
//   alignItems: 'center', marginBottom: 20,
// },
// drawerAvatar: {
//   width: 64, height: 64, borderRadius: 32, marginBottom: 10,
// },
// drawerAvatarFallback: {
//   backgroundColor: '#F26722', justifyContent: 'center', alignItems: 'center',
// },
// drawerAvatarText: {
//   color: '#fff', fontWeight: '700', fontSize: 24,
// },
// drawerUserName: {
//   fontSize: 16, fontWeight: '700', color: '#1F2937',
// },
// drawerItem: {
//   flexDirection: 'row', alignItems: 'center',
//   paddingVertical: 16,
// },
// drawerItemIcon: { fontSize: 20, marginRight: 14 },
// drawerItemText: { fontSize: 16, fontWeight: '600', color: '#374151' },
// drawerDivider: { height: 1, backgroundColor: '#E5E7EB' },
//     taskErrorBox: {
//   backgroundColor: '#FEE2E2',
//   borderRadius: 10,
//   padding: 10,
//   marginTop: 10,
//   marginBottom: 6,
// },
// taskErrorText: {
//   color: '#DC2626',
//   fontSize: 13,
//   fontWeight: '500',
//   textAlign: 'center',
// },
// buttonDisabled: {
//   opacity: 0.6,
// },
//     assignedRow: {
//   flexDirection: 'row',
//   alignItems: 'center',
//   marginTop: 14,
// },
// reassignCount: {
//   color: '#4F46E5',
//   fontWeight: '600',
//   marginLeft: 8,
// },
// overdueBadge: {
//   backgroundColor: '#FEE2E2',
//   paddingHorizontal: 10,
//   paddingVertical: 3,
//   borderRadius: 12,
//   marginLeft: 10,
// },
// overdueBadgeText: {
//   color: '#DC2626',
//   fontSize: 12,
//   fontWeight: '700',
// },
// activeActionButton: {
//   backgroundColor: '#2563EB',
//   borderRadius: 14,
//   paddingVertical: 14,
//   alignItems: 'center',
//   marginTop: 16,
// },
// activeActionButtonText: {
//   color: '#fff',
//   fontWeight: '700',
//   fontSize: 16,
// },
//     loadingContainer: {
//   flex: 1,
//   justifyContent: 'center',
//   alignItems: 'center',
// },
// loadingText: {
//   marginTop: 12,
//   color: '#6B7280',
//   fontSize: 15,
//   fontWeight: '500',
// },
//     brandRow: {
//   flexDirection: 'row',
//   alignItems: 'center',
// },
// logoCircle: {
//     width: 36,
//     height: 36,
//     borderRadius: 18,
//     backgroundColor: '#1E1B4B',
//     justifyContent: 'center',
//     alignItems: 'center',
//     marginRight: 10,
//   },
//   logoEmoji: {
//     fontSize: 16,
//   },
//   logoImage: {
//     width: 36,
//     height: 36,
//     marginRight: 10,
//   },
// brandTitle: {
//   fontSize: 16,
//   fontWeight: '700',
//   color: '#FFFFFF',
// },
// brandSubtitle: {
//   fontSize: 12,
//   color: '#FFFFFF',
//   fontWeight: '600',
// },
//     activeBadge: {
//   backgroundColor: '#FFEDD5',
//   paddingHorizontal: 12,
//   paddingVertical: 6,
//   borderRadius: 20,
// },
// activeBadgeText: {
//   color: '#C2410C',
//   fontWeight: '600',
// },
// continueButton: {
//   backgroundColor: '#F26722',
//   paddingHorizontal: 18,
//   paddingVertical: 8,
//   borderRadius: 10,
// },
// continueButtonText: {
//   color: '#fff',
//   fontWeight: '600',
// },
//     emptyState: {
//   paddingVertical: 60,
//   alignItems: 'center',
// },
// emptyStateText: {
//   color: '#9CA3AF',
//   fontSize: 15,
//   textAlign: 'center',
//   paddingHorizontal: 30,
// },
//     taskCard: {
//   backgroundColor: '#FFFFFF',
//   borderRadius: 20,
//   padding: 16,
//   marginBottom: 15,
//   elevation: 2,
// },

// topRow: {
//   flexDirection: 'row',
//   justifyContent: 'space-between',
//   alignItems: 'center',
// },

// taskNumber: {
//   color: '#241D67',
//   fontSize: 18,
//   fontWeight: '700',
// },

// assetNumber: {
//   marginLeft: 10,
//   color: '#98A2B3',
//   fontSize: 16,
// },

// typeBadge: {
//   backgroundColor: '#F3E8FF',
//   paddingHorizontal: 10,
//   paddingVertical: 5,
//   borderRadius: 15,
// },

// typeText: {
//   color: '#7E22CE',
//   fontWeight: '600',
//   fontSize: 13,
// },

// dispatchText: {
//   marginTop: 12,
//   color: '#667085',
//   fontSize: 15,
// },

// clientBox: {
//   backgroundColor: '#F9FAFB',
//   borderRadius: 15,
//   padding: 14,
//   marginTop: 12,
// },

// clientName: {
//   fontSize: 17,
//   fontWeight: '600',
//   color: '#475467',
// },

// address: {
//   marginTop: 8,
//   color: '#667085',
//   lineHeight: 22,
// },

// assignedText: {
//   marginTop: 14,
//   color: '#475467',
//   fontWeight: '500',
// },

// dateRow: {
//   flexDirection: 'row',
//   marginTop: 10,
// },

// dueText: {
//   color: 'red',
//   fontWeight: '600',
// },

// updatedText: {
//   marginLeft: 20,
//   color: '#667085',
// },

// bottomRow: {
//   flexDirection: 'row',
//   justifyContent: 'space-between',
//   alignItems: 'center',
//   marginTop: 16,
//   borderTopWidth: 1,
//   borderTopColor: '#E5E7EB',
//   paddingTop: 12,
// },

// completedBadge: {
//   backgroundColor: '#DCFCE7',
//   paddingHorizontal: 12,
//   paddingVertical: 6,
//   borderRadius: 20,
// },

// completedText: {
//   color: '#15803D',
//   fontWeight: '600',
// },

// reportText: {
//   color: '#4F46E5',
//   fontWeight: '600',
// },
//  searchBox: {
//   flexDirection: 'row',
//   alignItems: 'center',
//   backgroundColor: '#FFFFFF',
//   borderRadius: 15,
//   borderWidth: 1,
//   borderColor: '#E5E7EB',
//   paddingHorizontal: 15,
//   height: 50,
// },

// searchInput: {
//   flex: 1,
//   marginLeft: 10,
//   fontSize: 16,
//   paddingVertical: 0,
// },
//     searchContainer: {
//   paddingHorizontal: 20,
//   marginTop: 20,
// },


//     mainTabsContainer: {
//   marginTop: 20,
//   paddingHorizontal: 15,
//   maxHeight: 50,
 
// },

// mainTab: {
//   paddingHorizontal: 20,
//   paddingVertical: 10,
//   marginRight: 10,
//   borderRadius: 12,
// },

// activeMainTab: {
//   backgroundColor: '#FFFFFF',
// },

// mainTabText: {
//   color: '#667085',
//   fontWeight: '600',
// },

// activeMainTabText: {
//   color: '#241D67',
// },

// statusTabsContainer: {
//   flexDirection: 'row',
//   justifyContent: 'space-around',
//   marginTop: 20,
//   paddingHorizontal: 20,
// },


// statusTabContent: {
//   flexDirection: 'row',
//   alignItems: 'center',
//   gap: 6,
// },
// statusTabBadge: {
//   minWidth: 22,
//   height: 22,
//   borderRadius: 11,
//   paddingHorizontal: 6,
//   backgroundColor: '#E5E7EB',
//   justifyContent: 'center',
//   alignItems: 'center',
// },
// statusTabBadgeActive: {
//   backgroundColor: '#FFEDD5',
// },
// statusTabBadgeText: {
//   fontSize: 12,
//   fontWeight: '700',
//   color: '#6B7280',
// },
// statusTabBadgeTextActive: {
//   color: '#C2410C',
// },

// activeStatusTab: {
//   backgroundColor: '#FFFFFF',
//   elevation: 1,
//   shadowColor: '#000',
//   shadowOpacity: 0.06,
//   shadowRadius: 3,
//   shadowOffset: { width: 0, height: 1 },
// },

// statusTabText: {
//   color: '#667085',
//   fontWeight: '600',
//   fontSize: 15,
// },

// activeStatusTabText: {
//   color: '#241D67',
//   fontWeight: '700',
// },

// taskContainer: {
//   flex: 1,
//   marginTop: 20,
//   paddingHorizontal: 20,

// },



// cardText: {
//   fontSize: 15,
//   marginTop: 8,
//   color: '#666',
// },

// bottomBar: {
//   height: 70,
//   backgroundColor: '#FFFFFF',
//   flexDirection: 'row',
//   borderTopWidth: 1,
//   borderTopColor: '#E5E7EB',
// },

// bottomTab: {
//   flex: 1,
//   justifyContent: 'center',
//   alignItems: 'center',
// },

// activeBottomTab: {
//   color: '#F26722',
//   fontWeight: '700',
// },

// inactiveBottomTab: {
//   color: '#98A2B3',
//   fontWeight: '600',
// },
//     headerContainer: {
//   width: '100%',
//   paddingHorizontal: 20,
//   marginTop: 20,
// },

// heading: {
//   fontSize: 34,
//   fontWeight: '700',
//   color: '#241D67',
// },

// subHeading: {
//   fontSize: 18,
//   color: '#6B7280',
//   marginTop: 5,
// },
//   container: {
//     flex: 1,
//     backgroundColor: '#f8f9fa',
//   },
//   rightSection: {
//   flexDirection: 'row',
//   alignItems: 'center',
// },

// userName: {
//   fontSize: 16,
//   fontWeight: '600',
//   marginRight: 15,
//   color: '#FFFFFF',
// },
// appBar: {
//     height: 70,
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'space-between',
//     backgroundColor: '#241D67',
//     paddingHorizontal: width * 0.04,
//     elevation: 4,
//     shadowColor: '#000',
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.2,
//     shadowRadius: 4,
//   },
//   leftSpacer: {
//     width: width * 0.18, // balances the logout button width so title stays centered
//   },
//   appBarTitle: {
//     fontSize: width * 0.045,
//     fontWeight: '700',
//     color: '#fff',
//     textAlign: 'center',
//   },
//   statsContainer: {
//   flexDirection: 'row',
//   justifyContent: 'space-between',
//   paddingHorizontal: 20,
//   marginTop: 25,
// },
// logoutButton: {
//     paddingHorizontal: 12,
//     paddingVertical: 6,
//     borderRadius: 8,
//     borderWidth: 1,
//     borderColor: '#FFFFFF',
//   },
//   logoutText: {
//     color: '#FFFFFF',
//     fontSize: width * 0.035,
//     fontWeight: '600',
//   },
//   body: {
//     flex: 1,
//     justifyContent: 'center',
//     alignItems: 'center',
//     paddingHorizontal: 20,
//   },
//   placeholderText: {
//     fontSize: width * 0.04,
//     color: '#888',
//     textAlign: 'center',
//   },
  
// });

