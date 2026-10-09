import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../src/theme';

const content = {
  Today: {
    eyebrow: 'Tuesday, September 9, 2025',
    title: 'Good morning, Professor',
    copy: 'Here is what needs your attention today.',
    cards: [
      ['09:00 AM', 'DBMS · Section A', 'Normalization', '48 students · Up next'],
      ['02:00 PM', 'Operating Systems · Section B', 'Deadlock recovery', '44 students · Prepared']
    ]
  },
  Attendance: {
    eyebrow: 'Attendance intelligence',
    title: 'Class health',
    copy: 'Understand where your teaching record needs a closer look.',
    cards: [['DBMS', '92%', 'Strong attendance', 'Section A'], ['Operating Systems', '86%', 'On track', 'Section B'], ['Networks', '78%', 'Watch closely', 'Section C']]
  },
  Approvals: {
    eyebrow: 'Activity requests',
    title: 'Requests needing review',
    copy: 'Keep student activities and course progress in conversation.',
    cards: [['National Hackathon', 'September 10', 'Conflicts with DBMS', '1 student request'], ['Research symposium', 'September 18', 'No schedule conflict', '3 student requests']]
  },
  Syllabus: {
    eyebrow: 'Curriculum progress',
    title: 'DBMS syllabus',
    copy: 'Keep the teaching plan aligned with the learning journey.',
    cards: [['Unit 1', 'Foundations of Databases', 'Completed', 'ER model · Relational model'], ['Unit 2', 'Relational Design', '62%', 'Current topic: Normalization']]
  },
  Profile: {
    eyebrow: 'Faculty workspace',
    title: 'Professor Meera',
    copy: 'Computer Science · AIRS faculty account',
    cards: [['Department', 'Computer Science', 'Faculty member', ''], ['Notifications', 'Class alerts on', 'Manage preferences', '']]
  }
};

export default function TeacherScreen({ title }) {
  const screen = content[title];
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <Text style={styles.eyebrow}>{screen.eyebrow}</Text>
    <Text style={styles.title}>{screen.title}</Text>
    <Text style={styles.copy}>{screen.copy}</Text>
    <View style={styles.rule} />
    {screen.cards.map((card, index) => <Pressable key={`${title}-${index}`} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardTop}><Text style={styles.cardLabel}>{card[0]}</Text><Text style={styles.cardMeta}>{card[3]}</Text></View>
      <Text style={styles.cardTitle}>{card[1]}</Text>
      <Text style={styles.cardDetail}>{card[2]}</Text>
      <View style={styles.progress}><View style={[styles.progressFill, { width: `${title === 'Attendance' ? parseInt(card[1], 10) : title === 'Syllabus' ? (index ? 62 : 100) : 72}%` }]} /></View>
    </Pressable>)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { backgroundColor: colors.surface, flexGrow: 1, padding: 24, paddingTop: 38 },
  eyebrow: { color: colors.brandPrimary, fontFamily: fonts.textMedium, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 34, fontWeight: '700', marginTop: 10 },
  copy: { color: colors.muted, fontFamily: fonts.text, fontSize: 14, lineHeight: 21, marginTop: 10, maxWidth: 340 },
  rule: { backgroundColor: colors.border, height: 1, marginVertical: 26 },
  card: { backgroundColor: colors.surfaceSecondary, borderColor: '#D9E8E1', borderRadius: 16, borderWidth: 1, elevation: 3, marginBottom: 16, padding: 20, shadowColor: '#155D47', shadowOffset: { height: 5, width: 0 }, shadowOpacity: 0.08, shadowRadius: 14 },
  cardPressed: { backgroundColor: colors.brandSecondary, transform: [{ scale: 0.99 }] },
  cardTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardLabel: { color: colors.brandPrimary, fontFamily: fonts.textBold, fontSize: 12, fontWeight: '700' },
  cardMeta: { color: colors.muted, fontFamily: fonts.text, fontSize: 11 },
  cardTitle: { color: colors.onSurface, fontFamily: fonts.display, fontSize: 21, fontWeight: '700', marginTop: 15 },
  cardDetail: { color: colors.muted, fontFamily: fonts.text, fontSize: 12, marginTop: 6 },
  progress: { backgroundColor: colors.surfaceTertiary, borderRadius: 99, height: 7, marginTop: 18, overflow: 'hidden' },
  progressFill: { backgroundColor: colors.brandPrimary, borderRadius: 99, height: '100%' }
});
