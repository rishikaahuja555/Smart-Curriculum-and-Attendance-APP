import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../src/theme';

const rows = [
  ['bell', 'Notifications', 'Class alerts on'],
  ['lock', 'Privacy', 'Manage'],
  ['moon', 'Appearance', 'Follows system'],
  ['help-circle', 'Help centre', 'Support']
];

export default function ProfileScreen() {
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>Student workspace</Text>
    <Text style={styles.title}>Your profile</Text>
    <Text style={styles.copy}>Keep your AIRS workspace aligned with the way you study.</Text>
    <View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>RA</Text></View><View><Text style={styles.name}>Rishika Ahuja</Text><Text style={styles.email}>student@airs.edu</Text><View style={styles.badge}><Text style={styles.badgeText}>Student</Text></View></View></View>
    <View style={styles.meta}><View><Text style={styles.metaLabel}>PROGRAM</Text><Text style={styles.metaValue}>B.Tech Computer Science</Text></View><View><Text style={styles.metaLabel}>SECTION</Text><Text style={styles.metaValue}>CSE-3B</Text></View></View>
    <View style={styles.list}>{rows.map(([icon, label, value]) => <View key={label} style={styles.row}><View style={styles.rowIcon}><Text style={styles.rowIconText}>{icon.slice(0, 1).toUpperCase()}</Text></View><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text><Text style={styles.arrow}>›</Text></View>)}</View>
  </ScrollView>;
}

const styles = StyleSheet.create({ content: { backgroundColor: colors.surface, flexGrow: 1, padding: 24, paddingTop: 38 }, eyebrow: { color: colors.brandPrimary, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' }, title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 36, fontWeight: '700', marginTop: 10 }, copy: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10 }, identity: { alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderColor: '#D9E8E1', borderRadius: 16, borderWidth: 1, elevation: 3, flexDirection: 'row', gap: 14, marginTop: 28, padding: 20, shadowColor: colors.brandPrimary, shadowOpacity: .08, shadowRadius: 14 }, avatar: { alignItems: 'center', backgroundColor: colors.brandSecondary, borderRadius: 34, height: 64, justifyContent: 'center', width: 64 }, avatarText: { color: colors.brandPrimary, fontSize: 18, fontWeight: '800' }, name: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 22, fontWeight: '700' }, email: { color: colors.muted, fontSize: 12, marginTop: 4 }, badge: { alignSelf: 'flex-start', backgroundColor: '#DCEEDF', borderRadius: 99, marginTop: 8, paddingHorizontal: 9, paddingVertical: 4 }, badgeText: { color: colors.success, fontSize: 10, fontWeight: '700' }, meta: { borderBottomColor: colors.border, borderBottomWidth: 1, borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: 36, marginTop: 18, paddingVertical: 18 }, metaLabel: { color: colors.muted, fontSize: 9, fontWeight: '700', letterSpacing: 1 }, metaValue: { color: colors.onSurface, fontSize: 12, fontWeight: '600', marginTop: 6 }, list: { backgroundColor: colors.surfaceSecondary, borderColor: '#D9E8E1', borderRadius: 16, borderWidth: 1, marginTop: 22, overflow: 'hidden' }, row: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', gap: 11, padding: 15 }, rowIcon: { alignItems: 'center', backgroundColor: colors.brandSecondary, borderRadius: 15, height: 30, justifyContent: 'center', width: 30 }, rowIconText: { color: colors.brandPrimary, fontSize: 11, fontWeight: '800' }, rowLabel: { color: colors.onSurface, flex: 1, fontSize: 13, fontWeight: '700' }, rowValue: { color: colors.muted, fontSize: 11 }, arrow: { color: colors.muted, fontSize: 22 }
});
