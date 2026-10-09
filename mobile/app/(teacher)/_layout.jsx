import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import Icon from '@react-native-vector-icons/feather';
import { colors, fonts } from '../../src/theme';

export default function TeacherTabsLayout() {
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: colors.brandPrimary,
    tabBarInactiveTintColor: colors.muted,
    tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.textMedium, fontWeight: '600', marginBottom: 4 },
    tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, elevation: 8, ...(Platform.OS === 'web' ? { height: 64 } : {}) },
    tabBarItemStyle: { alignSelf: 'center' }
  }}>
    <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color }) => <Icon name="sun" color={color} size={22} /> }} />
    <Tabs.Screen name="attendance" options={{ title: 'Attendance', tabBarIcon: ({ color }) => <Icon name="check-square" color={color} size={22} /> }} />
    <Tabs.Screen name="approvals" options={{ title: 'Approvals', tabBarIcon: ({ color }) => <Icon name="inbox" color={color} size={22} /> }} />
    <Tabs.Screen name="syllabus" options={{ title: 'Syllabus', tabBarIcon: ({ color }) => <Icon name="layers" color={color} size={22} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Icon name="user" color={color} size={22} /> }} />
  </Tabs>;
}
