export const studentSubjects = [
  { name: 'DBMS', short: 'DB', percent: 76, status: 'Caution', trend: 'decreasing', attended: 19, total: 25, color: '#8f4f42' },
  { name: 'Operating Systems', short: 'OS', percent: 84, status: 'Safe', trend: 'stable', attended: 21, total: 25, color: '#527461' },
  { name: 'Artificial Intelligence', short: 'AI', percent: 79, status: 'Caution', trend: 'increasing', attended: 22, total: 28, color: '#a57733' }
];

export const missedTopics = [
  { subject: 'DBMS', topic: 'Normalization', date: 'September 3', detail: 'Notes available', action: 'Start Recovery', state: 'ready' },
  { subject: 'Operating Systems', topic: 'Deadlock', date: 'August 28', detail: 'Practice pending', action: 'Continue Recovery', state: 'pending' }
];

export const curriculum = [
  { subject: 'DBMS', completed: ['ER Model', 'Relational Model'], current: 'Normalization', remaining: ['SQL Queries', 'Transactions'], progress: 62 },
  { subject: 'Operating Systems', completed: ['Processes', 'Memory Management'], current: 'Deadlock', remaining: ['File Systems', 'Security'], progress: 74 }
];

export const students = [
  { name: 'Rishika Ahuja', initials: 'RA', status: 'Present' },
  { name: 'Rahul Sharma', initials: 'RS', status: 'Absent' },
  { name: 'Priya Singh', initials: 'PS', status: 'Present' },
  { name: 'Arjun Mehta', initials: 'AM', status: 'Present' },
  { name: 'Sneha Kapoor', initials: 'SK', status: 'Present' }
];

export const teacherInsights = [
  ['Class attendance', '82%', 'Within expected range', 'green'],
  ['Students requiring attention', '7', '2 new this week', 'amber'],
  ['Declining attendance', '12', 'Across 3 sections', 'red']
];

export const demoUsers = [
  { id: 'stu-1', name: 'Ananya Rao', email: 'student@lumina.edu', enrollment: '22BCS1002', password: 'demo1234', role: 'student', initials: 'AR', program: 'B.Tech Computer Science', section: 'CSE-3B', year: '3rd Year', avatar: 'https://images.unsplash.com/photo-1544168190-79c17527004f?crop=entropy&cs=srgb&fm=jpg&q=85' },
  { id: 'tch-1', name: 'Dr. Meera Iyer', email: 'teacher@lumina.edu', teacherName: 'Dr. Meera Iyer', password: 'demo1234', role: 'teacher', initials: 'MI', department: 'Computer Science', avatar: 'https://images.unsplash.com/photo-1544717305-2782549b5136?crop=entropy&cs=srgb&fm=jpg&q=85' }
];

export const DEMO_USERS = demoUsers;
export const AUTH_HERO = 'https://images.unsplash.com/photo-1769284021492-064a397420dc?crop=entropy&cs=srgb&fm=jpg&q=85';
export const EMPTY_NOTEBOOK = 'https://images.unsplash.com/photo-1531346878377-a5be20888e57?crop=entropy&cs=srgb&fm=jpg&q=85';

export const SUBJECTS = [
  { id: 'sub-dsa', code: 'CS301', name: 'Data Structures', color: '#155D47', attended: 34, total: 40, trend: 'up', syllabusPct: 78 },
  { id: 'sub-os', code: 'CS302', name: 'Operating Systems', color: '#D47C31', attended: 22, total: 36, trend: 'down', syllabusPct: 62 },
  { id: 'sub-dbms', code: 'CS303', name: 'Database Systems', color: '#4A6E7C', attended: 28, total: 34, trend: 'flat', syllabusPct: 70 },
  { id: 'sub-ml', code: 'CS304', name: 'Machine Learning', color: '#7A5B3F', attended: 30, total: 32, trend: 'up', syllabusPct: 55 },
  { id: 'sub-eng', code: 'HU201', name: 'Technical Writing', color: '#8A6E2F', attended: 18, total: 26, trend: 'down', syllabusPct: 84 }
];

export const attendancePct = (subject) => subject.total === 0 ? 0 : Math.round((subject.attended / subject.total) * 100);
export const overallAttendance = () => {
  const attended = SUBJECTS.reduce((sum, subject) => sum + subject.attended, 0);
  const total = SUBJECTS.reduce((sum, subject) => sum + subject.total, 0);
  return total === 0 ? 0 : Math.round((attended / total) * 100);
};
export const riskFor = (percentage) => percentage >= 80 ? 'safe' : percentage >= 70 ? 'caution' : 'critical';

export const MISSED_TOPICS = [
  { id: 'mt-1', subjectId: 'sub-os', topic: 'Deadlock Detection Algorithms', unit: 'Unit 3 · Process Sync', date: '2026-05-04', resources: 3, hasDPP: true },
  { id: 'mt-2', subjectId: 'sub-os', topic: 'Semaphores & Monitors', unit: 'Unit 3 · Process Sync', date: '2026-04-29', resources: 2, hasDPP: true },
  { id: 'mt-3', subjectId: 'sub-eng', topic: 'Argumentation & Rhetoric', unit: 'Unit 2 · Persuasive Writing', date: '2026-04-24', resources: 1, hasDPP: false },
  { id: 'mt-4', subjectId: 'sub-dbms', topic: 'Third Normal Form (3NF)', unit: 'Unit 4 · Normalization', date: '2026-04-18', resources: 4, hasDPP: true }
];

export const DPPS = {
  'mt-1': { id: 'dpp-1', topicId: 'mt-1', title: 'Deadlock Detection · Recovery Set', subject: 'Operating Systems', duration: '12 min', difficulty: 'Medium', questions: [
    { id: 'q1', question: 'In a system with a single resource of each type, deadlock detection is done using:', options: ["Banker's algorithm", 'Wait-for graph', 'Resource allocation graph with cycles allowed', 'Semaphores'], answerIndex: 1, explanation: 'For single instance resources, a cycle in the wait-for graph is both necessary and sufficient for deadlock.' },
    { id: 'q2', question: 'Which of the following is NOT a deadlock recovery strategy?', options: ['Process termination', 'Resource preemption', 'Rollback', 'Priority inversion'], answerIndex: 3, explanation: 'Priority inversion is a scheduling anomaly, not a deadlock recovery technique.' }
  ] },
  'mt-2': { id: 'dpp-2', topicId: 'mt-2', title: 'Semaphores & Monitors · Recovery Set', subject: 'Operating Systems', duration: '10 min', difficulty: 'Easy', questions: [{ id: 'q1', question: 'A binary semaphore differs from a counting semaphore in that it:', options: ['Can be any integer', 'Is limited to values 0 and 1', 'Is used only in kernels', 'Cannot cause blocking'], answerIndex: 1, explanation: 'Binary semaphores hold only 0 or 1 and behave like mutex locks.' }] },
  'mt-4': { id: 'dpp-4', topicId: 'mt-4', title: '3NF · Recovery Set', subject: 'Database Systems', duration: '8 min', difficulty: 'Easy', questions: [{ id: 'q1', question: 'A relation is in 3NF if it is in 2NF and:', options: ['Has no partial dependencies', 'Has no transitive dependencies on the primary key', 'Has no multi-valued dependencies', 'Is fully denormalized'], answerIndex: 1, explanation: '3NF removes transitive dependencies from a 2NF schema.' }] }
};

export const ACTIVITIES = [
  { id: 'act-1', title: 'Inter-college Hackathon', club: 'Cypher Coding Club', date: '2026-05-14', time: '09:00 – 18:00', location: 'Auditorium A', status: 'pending', conflicts: 2 },
  { id: 'act-2', title: 'Robotics Workshop', club: 'Robotics Society', date: '2026-05-09', time: '14:00 – 16:00', location: 'Lab 4C', status: 'approved', conflicts: 1 },
  { id: 'act-3', title: 'Cultural Fest Rehearsal', club: 'Rhapsody Cultural', date: '2026-05-06', time: '11:00 – 13:00', location: 'Open Air Theatre', status: 'rejected', conflicts: 3 }
];

export const TODAYS_CLASSES = [
  { id: 'c-1', subjectId: 'sub-dsa', section: 'CSE-3B', time: '09:00', duration: '50 min', room: 'Room 204', topic: 'Balanced BSTs · AVL rotations', studentsCount: 48, atRisk: 6, marked: true },
  { id: 'c-2', subjectId: 'sub-dsa', section: 'CSE-3A', time: '11:00', duration: '50 min', room: 'Room 208', topic: 'Balanced BSTs · AVL rotations', studentsCount: 46, atRisk: 4, marked: false },
  { id: 'c-3', subjectId: 'sub-ml', section: 'CSE-4A', time: '14:30', duration: '60 min', room: 'Lab 1', topic: 'Gradient Descent variants', studentsCount: 40, atRisk: 3, marked: false }
];

export const ROSTER = [
  ['Aarav Sharma', '22BCS1001', 92], ['Ananya Rao', '22BCS1002', 85], ['Devansh Menon', '22BCS1003', 68], ['Isha Kulkarni', '22BCS1004', 74], ['Kabir Nair', '22BCS1005', 88], ['Meher Kapoor', '22BCS1006', 62], ['Nikhil Verma', '22BCS1007', 79], ['Priya Balan', '22BCS1008', 95], ['Rohan Das', '22BCS1009', 71], ['Sanya Malhotra', '22BCS1010', 86], ['Tanvi Shetty', '22BCS1011', 58], ['Vihaan Gupta', '22BCS1012', 90]
].map(([name, roll, attendance]) => ({ id: roll, name, roll, attendancePct: attendance, riskLevel: riskFor(attendance) }));

export const APPROVAL_REQUESTS = [
  { id: 'a-1', studentName: 'Ananya Rao', roll: '22BCS1002', type: 'conflict', event: 'Inter-college Hackathon', date: '2026-05-14', reason: 'Representing college at national hackathon.', subject: 'Data Structures', status: 'pending' },
  { id: 'a-2', studentName: 'Kabir Nair', roll: '22BCS1005', type: 'conflict', event: 'Robotics Workshop', date: '2026-05-09', reason: 'Mandatory attendance for society finalists.', subject: 'Data Structures', status: 'pending' },
  { id: 'a-3', studentName: 'Isha Kulkarni', roll: '22BCS1004', type: 'correction', event: 'Missed session on 02 May', date: '2026-05-02', reason: 'Was present but marked absent — bus arrived late.', subject: 'Data Structures', status: 'pending' }
];

export const SYLLABUS_TREE = {
  'sub-dsa': [
    { id: 'u1', title: 'Unit 1 · Foundations', topics: [{ id: 't1', title: 'Complexity analysis', taught: true }, { id: 't2', title: 'Recursion patterns', taught: true }, { id: 't3', title: 'Divide & conquer', taught: true }] },
    { id: 'u2', title: 'Unit 2 · Linear Structures', topics: [{ id: 't4', title: 'Stacks & queues', taught: true }, { id: 't5', title: 'Linked lists', taught: true }, { id: 't6', title: 'Amortized analysis', taught: false }] },
    { id: 'u3', title: 'Unit 3 · Trees', topics: [{ id: 't7', title: 'Binary search trees', taught: true }, { id: 't8', title: 'AVL rotations', taught: false }, { id: 't9', title: 'Red-black trees', taught: false }, { id: 't10', title: 'B-trees', taught: false }] }
  ]
};