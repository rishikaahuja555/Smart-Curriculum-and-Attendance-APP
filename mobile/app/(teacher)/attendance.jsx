import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/feather';
import { colors, fonts } from '../../src/theme';

const roster = [
	{ id: 'a1', name: 'Aarav Mehta', roll: 'CSE-301', attendance: 92 },
	{ id: 'a2', name: 'Ananya Rao', roll: 'CSE-302', attendance: 86 },
	{ id: 'a3', name: 'Dev Shah', roll: 'CSE-303', attendance: 78 },
	{ id: 'a4', name: 'Ishita Nair', roll: 'CSE-304', attendance: 96 },
	{ id: 'a5', name: 'Kabir Singh', roll: 'CSE-305', attendance: 74 }
];
const statusOrder = ['present', 'late', 'absent'];
const statusColors = { present: colors.success, late: colors.warning, absent: '#C05746' };
const labels = { present: 'P', late: 'L', absent: 'A' };

export default function Attendance() {
	const insets = useSafeAreaInsets();
	const [topic, setTopic] = useState('Normalization');
	const [saved, setSaved] = useState(false);
	const [status, setStatus] = useState(() => Object.fromEntries(roster.map((student) => [student.id, 'present'])));
	const counts = useMemo(() => roster.reduce((result, student) => { const value = status[student.id]; result[value] += 1; return result; }, { present: 0, late: 0, absent: 0 }), [status]);
	const bulk = (value) => setStatus(Object.fromEntries(roster.map((student) => [student.id, value])));

	return <View style={styles.screen}>
		<View style={[styles.header, { paddingTop: insets.top + 14 }]}>
			<View style={styles.headerRow}><View><Text style={styles.subject}>DBMS · Section A</Text><Text style={styles.time}>09:00 AM · LT-204</Text></View><View style={styles.summary}><Text style={styles.summaryText}><Text style={{ color: colors.success }}>{counts.present}</Text><Text style={{ color: colors.muted }}> · </Text><Text style={{ color: colors.warning }}>{counts.late}</Text><Text style={{ color: colors.muted }}> · </Text><Text style={{ color: '#C05746' }}>{counts.absent}</Text></Text><Text style={styles.summaryLabel}>P · L · A</Text></View></View>
			<Text style={styles.topicLabel}>Topic taught</Text>
			<TextInput value={topic} onChangeText={setTopic} placeholder="What did you teach today?" placeholderTextColor={colors.muted} style={styles.topicInput} />
			<View style={styles.bulkRow}><Pressable onPress={() => bulk('present')} style={styles.bulkChip}><Icon name="check-circle" size={15} color={colors.success} /><Text style={styles.bulkText}>All present</Text></Pressable><Pressable onPress={() => bulk('absent')} style={styles.bulkChip}><Icon name="x-circle" size={15} color="#C05746" /><Text style={styles.bulkText}>All absent</Text></Pressable></View>
		</View>
		<ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
			{saved && <View style={styles.saved}><Icon name="check-circle" size={16} color={colors.success} /><Text style={styles.savedText}>Attendance and topic saved.</Text></View>}
			{roster.map((student) => <View key={student.id} style={styles.row}><View style={styles.avatar}><Text style={styles.initials}>{student.name.split(' ').map((part) => part[0]).join('')}</Text></View><View style={styles.student}><Text style={styles.name}>{student.name}</Text><Text style={styles.meta}>{student.roll} · {student.attendance}%</Text></View><View style={styles.markers}>{statusOrder.map((value) => <Pressable key={value} onPress={() => setStatus((current) => ({ ...current, [student.id]: value }))} style={[styles.marker, { backgroundColor: status[student.id] === value ? statusColors[value] : colors.surfaceSecondary, borderColor: status[student.id] === value ? statusColors[value] : colors.border }]}><Text style={[styles.markerText, { color: status[student.id] === value ? '#FFFFFF' : statusColors[value] }]}>{labels[value]}</Text></Pressable>)}</View></View>)}
		</ScrollView>
		<View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}><Pressable onPress={() => { setSaved(true); setTimeout(() => setSaved(false), 2500); }} style={styles.save}><Text style={styles.saveText}>Save attendance & topic</Text><Icon name="arrow-up-right" size={17} color="#FFFFFF" /></Pressable></View>
	</View>;
}

const styles = StyleSheet.create({
	screen: { backgroundColor: colors.surface, flex: 1 }, header: { backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1, paddingBottom: 18, paddingHorizontal: 20 }, headerRow: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' }, subject: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 22, fontWeight: '700' }, time: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, marginTop: 3 }, summary: { alignItems: 'flex-end' }, summaryText: { fontFamily: fonts.display, fontSize: 21 }, summaryLabel: { color: colors.muted, fontSize: 10, marginTop: 2 }, topicLabel: { color: colors.onSurface, fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 20 }, topicInput: { backgroundColor: colors.surfaceSecondary, borderColor: '#D9E8E1', borderRadius: 12, borderWidth: 1, color: colors.onSurface, fontFamily: fonts.text, fontSize: 14, height: 48, paddingHorizontal: 13 }, bulkRow: { flexDirection: 'row', gap: 8, marginTop: 12 }, bulkChip: { alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderColor: colors.border, borderRadius: 99, borderWidth: 1, flexDirection: 'row', gap: 6, height: 34, paddingHorizontal: 12 }, bulkText: { color: colors.onSurface, fontSize: 12, fontWeight: '600' }, list: { gap: 10, padding: 20, paddingBottom: 120 }, saved: { alignItems: 'center', backgroundColor: '#E7F3EC', borderColor: '#B7DAC1', borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 8, marginBottom: 4, padding: 13 }, savedText: { color: colors.success, fontSize: 12, fontWeight: '600' }, row: { alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderColor: '#D9E8E1', borderRadius: 12, borderWidth: 1, elevation: 2, flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 12, shadowColor: colors.brandPrimary, shadowOpacity: .05, shadowRadius: 8 }, avatar: { alignItems: 'center', backgroundColor: colors.brandSecondary, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 }, initials: { color: colors.brandPrimary, fontSize: 12, fontWeight: '700' }, student: { flex: 1 }, name: { color: colors.onSurface, fontSize: 14, fontWeight: '700' }, meta: { color: colors.muted, fontSize: 10, marginTop: 3 }, markers: { flexDirection: 'row', gap: 5 }, marker: { alignItems: 'center', borderRadius: 18, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 }, markerText: { fontSize: 13, fontWeight: '800' }, footer: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, bottom: 0, elevation: 10, left: 0, paddingHorizontal: 20, paddingTop: 12, position: 'absolute', right: 0, shadowColor: colors.brandPrimary, shadowOpacity: .1, shadowRadius: 12 }, save: { alignItems: 'center', backgroundColor: colors.brandPrimary, borderRadius: 10, elevation: 3, flexDirection: 'row', height: 49, justifyContent: 'center', gap: 8, shadowColor: colors.brandPrimary, shadowOpacity: .25, shadowRadius: 10 }, saveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' }
});
