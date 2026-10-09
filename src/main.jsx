import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { curriculum, missedTopics, studentSubjects, students, teacherInsights } from './data/mockData';
import { calculateSafeAbsences } from './data/attendanceRules';
import { AuthProvider, useAuth } from './context/AuthContext';
import StudentHome from './pages/StudentHome';
import PetAssistant from './components/PetAssistant';
import './styles.css';

const Icon = ({ children }) => <span className="nav-icon" aria-hidden="true">{children}</span>;

async function apiRequest(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The request could not be completed.');
  return result;
}

function formatCoveragePlan(coveragePlan) {
  if (!coveragePlan) return '';
  if (typeof coveragePlan === 'string') return coveragePlan;
  return Object.values(coveragePlan).join('; ');
}

function formatAuditDetails(details) {
  try {
    return Object.entries(JSON.parse(details)).map(([key, value]) => `${key}: ${value}`).join(' · ');
  } catch {
    return details;
  }
}

const studentNav = [
  { label: 'Overview', icon: '▦', key: 'overview' },
  { label: 'ACADEMICS', group: true },
  { label: 'Attendance', icon: '◔', key: 'attendance' },
  { label: 'Missed Topics', icon: '◌', key: 'missed' },
  { label: 'Recovery', icon: '↗', key: 'recovery' },
  { label: 'Curriculum', icon: '☷', key: 'curriculum' },
  { label: 'ACTIVITIES', group: true },
  { label: 'My Activities', icon: '◫', key: 'activities' },
  { label: 'Settings', icon: '⚙', key: 'settings' }
];

const teacherNav = [
  { label: 'Today', icon: '☀', key: 'dashboard' },
  { label: 'Attendance', icon: '◔', key: 'teacher-attendance' },
  { label: 'Availability', icon: '▦', key: 'availability' },
  { label: 'Approvals & conflicts', icon: '△', key: 'requests' },
  { label: 'Syllabus', icon: '☷', key: 'teacher-curriculum' },
  { label: 'Profile', icon: '♙', key: 'profile' }
];

const adminNav = [
  { label: 'Overview', icon: '▦', key: 'admin-overview' },
  { label: 'OPERATIONS', group: true },
  { label: 'User management', icon: '◎', key: 'admin-users' },
  { label: 'Timetable', icon: '◫', key: 'admin-timetable' },
  { label: 'Activities', icon: '△', key: 'admin-activities' },
  { label: 'Continuity', icon: '✓', key: 'admin-continuity' },
  { label: 'Rules & thresholds', icon: '%', key: 'admin-rules' },
  { label: 'Audit log', icon: '⎈', key: 'admin-audit' }
];

const adminOverviewMetrics = [
  { label: 'Students', value: '8,420', note: '+184 this semester' },
  { label: 'Faculty', value: '412', note: '24 departments' },
  { label: 'Sections', value: '96', note: 'Across 12 programs' },
  { label: 'Attendance', value: '81.2%', note: 'Read-only cohort view' },
  { label: 'At-risk', value: '184', note: '12 critical' },
  { label: 'Escalations', value: '14', note: '3 overdue' }
];

function AuthGate({ children }) {
  const { loading } = useAuth();
  if (loading) return <div className="app-loading" role="status">Loading AIRS...</div>;
  return children;
}

function readRecentAccounts(role) {
  const demoAccounts = { student: 'DEMO-0001', teacher: 'Dr. Meera Iyer', admin: 'admin@demo.airs.local' };
  try {
    const saved = JSON.parse(localStorage.getItem('airs_recent_accounts') || '{}');
    const recent = Array.isArray(saved[role]) ? saved[role].filter((account) => typeof account === 'string') : [];
    return [...new Set([demoAccounts[role], ...recent].filter(Boolean))].slice(0, 5);
  } catch {
    return demoAccounts[role] ? [demoAccounts[role]] : [];
  }
}

function rememberAccount(role, identifier) {
  const account = identifier.trim();
  if (!account) return [];
  const recent = [account, ...readRecentAccounts(role).filter((value) => value.toLowerCase() !== account.toLowerCase())].slice(0, 5);
  try {
    const saved = JSON.parse(localStorage.getItem('airs_recent_accounts') || '{}');
    localStorage.setItem('airs_recent_accounts', JSON.stringify({ ...saved, [role]: recent }));
  } catch {
    return recent;
  }
  return recent;
}

function LoginScreen() {
  const { login } = useAuth();
  const [role, setRole] = useState('student');
  const [identifier, setIdentifier] = useState('');
  const [recentAccounts, setRecentAccounts] = useState(() => readRecentAccounts('student'));
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    const result = await login(identifier, password, role, rememberMe);
    if (!result.ok) setError(result.error);
    else setRecentAccounts(rememberAccount(role, identifier));
  };
  const roleLabel = role === 'student' ? 'Enrollment number' : role === 'teacher' ? 'Teacher name' : 'Admin email';
  const placeholder = role === 'student' ? 'e.g. 23100BTCSE16089' : role === 'teacher' ? 'e.g. Dr. Meera Iyer' : 'e.g. admin@lumina.edu';
  return <main className="login-screen"><section className="login-panel"><div className="login-brand"><span className="brand-mark">A</span><div><strong>AIRS</strong><small>Academic intelligence</small></div></div><div className="eyebrow">Secure workspace access</div><h1>Welcome back.</h1><p className="login-copy">Sign in to continue to your personal academic workspace.</p><div className="login-role-switch"><button type="button" className={role === 'student' ? 'selected' : ''} onClick={() => { setRole('student'); setRecentAccounts(readRecentAccounts('student')); setError(''); }}>Student</button><button type="button" className={role === 'teacher' ? 'selected' : ''} onClick={() => { setRole('teacher'); setRecentAccounts(readRecentAccounts('teacher')); setError(''); }}>Teacher</button><button type="button" className={role === 'admin' ? 'selected' : ''} onClick={() => { setRole('admin'); setRecentAccounts(readRecentAccounts('admin')); setError(''); }}>Admin</button></div><form onSubmit={submit} className="login-form"><label>{roleLabel}<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={placeholder} autoComplete="username" /></label>{recentAccounts.length > 0 && <div className="recent-login-list" aria-label="Recent accounts">{recentAccounts.map((account) => <button type="button" key={account} onClick={() => setIdentifier(account)}>{account}</button>)}</div>}<label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Enter your password" autoComplete="current-password" /></label><label className="remember-me"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> Keep me signed in for 30 days</label>{error && <div className="login-error" role="alert">{error}</div>}<button className="primary-btn login-submit" type="submit">Enter workspace <span>↗</span></button></form><p className="login-hint">Sign in with your account ID and password. Recent account names are saved on this device; your browser may offer to save the password.</p></section><aside className="login-aside"><div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" /><span className="login-aside-label">AIRS / 01</span><h2>Attendance that understands the whole student.</h2><p>Connect presence, curriculum, recovery, and real academic decisions in one calm workspace.</p><div className="login-aside-line"><span />Role-based access</div></aside></main>;
}

function DevelopmentLoginScreen() {
  const { login } = useAuth();
  const [role, setRole] = useState('student');
  const [identifier, setIdentifier] = useState('');
  const [recentAccounts, setRecentAccounts] = useState(() => readRecentAccounts('student'));
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    const result = await login(identifier, password, role, rememberMe);
    if (!result.ok) setError(result.error);
    else setRecentAccounts(rememberAccount(role, identifier));
  };
  const selectDemoAccount = async (account) => {
    setIdentifier(account);
    setError('');
    const result = await login(account, '', role, rememberMe);
    if (!result.ok) setError(result.error);
    else setRecentAccounts(rememberAccount(role, account));
  };
  const roleLabel = role === 'student' ? 'Enrollment number' : role === 'teacher' ? 'Teacher name' : 'Admin email';
  const placeholder = role === 'student' ? 'e.g. 22BCS1002' : role === 'teacher' ? 'e.g. Dr. Meera Iyer' : 'e.g. admin@airs.edu';

  return <main className="login-screen"><section className="login-panel"><div className="login-brand"><span className="brand-mark">A</span><div><strong>AIRS</strong><small>Academic intelligence</small></div></div><div className="eyebrow">Local development access</div><h1>Welcome back.</h1><p className="login-copy">Choose your workspace and enter your registered account ID.</p><div className="login-role-switch"><button type="button" className={role === 'student' ? 'selected' : ''} onClick={() => { setRole('student'); setRecentAccounts(readRecentAccounts('student')); setError(''); }}>Student</button><button type="button" className={role === 'teacher' ? 'selected' : ''} onClick={() => { setRole('teacher'); setRecentAccounts(readRecentAccounts('teacher')); setError(''); }}>Teacher</button><button type="button" className={role === 'admin' ? 'selected' : ''} onClick={() => { setRole('admin'); setRecentAccounts(readRecentAccounts('admin')); setError(''); }}>Admin</button></div><form onSubmit={submit} className="login-form"><label>{roleLabel}<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder={placeholder} autoComplete="username" /></label>{recentAccounts.length > 0 && <div className="recent-login-list" aria-label="Recent accounts">{recentAccounts.map((account) => <button type="button" key={account} onClick={() => selectDemoAccount(account)}>{account}</button>)}</div>}<label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="Enter your password" autoComplete="current-password" /></label><label className="remember-me"><input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} /> Keep me signed in for 30 days</label>{error && <div className="login-error" role="alert">{error}</div>}<button className="primary-btn login-submit" type="submit">Enter workspace <span>↗</span></button></form><p className="login-hint">Recent account names are saved on this device. Your browser may offer to save the password.</p></section><aside className="login-aside"><div className="login-orbit orbit-one" /><div className="login-orbit orbit-two" /><span className="login-aside-label">AIRS / 01</span><h2>Attendance that understands the whole student.</h2><p>Connect presence, curriculum, recovery, and real academic decisions in one calm workspace.</p><div className="login-aside-line"><span />Role-based access</div></aside></main>;
}

function RootLayout({ children }) {
  return <AuthGate>{children}<PetAssistant /></AuthGate>;
}

function Sidebar({ role, page, setPage }) {
  const nav = role === 'student' ? studentNav : role === 'teacher' ? teacherNav : adminNav;
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark">A</span><span className="brand-copy"><strong>AIRS</strong><small>Academic intelligence</small></span></div>
    <div className="workspace-label">{role === 'student' ? 'STUDENT WORKSPACE' : role === 'teacher' ? 'FACULTY WORKSPACE' : 'ADMIN WORKSPACE'}</div>
    <nav>{nav.map((item, index) => item.group ? <div className="nav-group" key={item.label}>{item.label}</div> : <button className={`nav-item ${page === item.key ? 'active' : ''}`} onClick={() => setPage(item.key)} key={item.label}><Icon>{item.icon}</Icon>{item.label}{item.key === 'missed' && <span className="nav-count">3</span>}</button>)}</nav>
    <div className="sidebar-footer"><div className="avatar">{role === 'student' ? 'RA' : role === 'teacher' ? 'PM' : 'AR'}</div><div><strong>{role === 'student' ? 'Rishika Ahuja' : role === 'teacher' ? 'Prof. Meera' : 'Alicia Reed'}</strong><small>{role === 'student' ? '4th Year · Semester 7 · Section G' : role === 'teacher' ? 'Computer Science' : 'System admin · governance'}</small></div><span className="dots">•••</span></div>
  </aside>;
}

function Topbar({ role }) {
  const { user, logout } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unread, setUnread] = useState(2);
  const notifications = role === 'student'
    ? [['Attendance watch', 'DBMS is close to its safe threshold.', 'Now'], ['Recovery ready', 'Your Normalization DPP is ready to start.', '12 min ago'], ['Activity update', 'Hackathon conflict is pending faculty review.', 'Yesterday']]
    : role === 'teacher'
      ? [['Attendance reminder', 'DBMS · Section A attendance is ready to record.', 'Now'], ['Approval request', 'Ananya Rao submitted an activity conflict.', '18 min ago'], ['Curriculum signal', 'Normalization is the most missed recent topic.', 'Yesterday']]
      : [['Escalation queue', '3 correction cases require admin workflow review.', 'Now'], ['Threshold drift', 'Risk threshold is below the required benchmark.', '28 min ago'], ['Audit alert', '12 admin actions were logged in the last 24 hours.', 'Yesterday']];
  return <header className="topbar"><div className="breadcrumb">{role === 'student' ? 'Student workspace' : role === 'teacher' ? 'Faculty workspace' : 'Admin workspace'} <span>/</span> {role === 'student' ? 'Overview' : role === 'teacher' ? 'Today' : 'Overview'}</div><div className="top-actions"><div className="notification-wrap"><button className={`icon-btn ${notificationsOpen ? 'active' : ''}`} aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}>♧{unread > 0 && <i />}</button>{notificationsOpen && <div className="notification-panel"><div className="notification-head"><div><strong>Notifications</strong><small>{unread ? `${unread} unread updates` : 'All caught up'}</small></div>{unread > 0 && <button onClick={() => setUnread(0)}>Mark all read</button>}</div><div className="notification-list">{notifications.map(([title, copy, time], index) => <button className={`notification-item ${index < unread ? 'unread' : ''}`} key={title}><span className="notification-dot" /><span><strong>{title}</strong><small>{copy}</small><em>{time}</em></span></button>)}</div></div>}</div><button className="session-user" onClick={logout} title="Sign out"><span className="top-avatar">{user?.initials || 'A'}</span><span className="session-name">{user?.name}</span><span className="session-signout">Sign out</span></button></div></header>;
}

function PageHeader({ eyebrow, title, copy, action, onAction }) { return <div className="page-header"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{copy && <p>{copy}</p>}</div>{action && <button className="primary-btn" onClick={onAction}>{action} <span>↗</span></button>}</div>; }
function Status({ children, tone = 'amber' }) { return <span className={`status ${tone}`}>{children}</span>; }
function ProgressBar({ value, color = 'burgundy' }) { return <div className="progress-track"><span className={color} style={{ width: `${value}%` }} /></div>; }
function Metric({ label, value, note, tone }) { return <div className="metric"><div className="metric-label">{label}</div><strong>{value}</strong><div className={`metric-note ${tone || ''}`}>{note}</div></div>; }

const fallbackAttendanceSubjects = [
  { id: 'dbms-demo', name: 'Database Management Systems', short: 'DBMS', total: 13, attended: 8, percent: 62, status: 'Critical', trend: 'decreasing', section: 'CSE-3B', color: '#A61B32', classesLeft: 5 },
  { id: 'os-demo', name: 'Operating Systems', short: 'OS', total: 11, attended: 9, percent: 82, status: 'Safe', trend: 'increasing', section: 'CSE-3B', color: '#7F1025', classesLeft: 2 },
  { id: 'net-demo', name: 'Computer Networks', short: 'CN', total: 9, attended: 6, percent: 67, status: 'Caution', trend: 'steady', section: 'CSE-3B', color: '#C45A36', classesLeft: 3 }
];

function AttendancePanel({ subjects = fallbackAttendanceSubjects, showInsight = true }) {
  const cards = subjects && subjects.length ? subjects : fallbackAttendanceSubjects;
  return <section className="section-block attendance-section"><div className="section-heading"><div><div className="eyebrow">Attendance intelligence</div><h2>How your attendance is tracking</h2></div><button className="text-btn">View attendance details <span>→</span></button></div><div className="subject-list">{cards.map((subject, index) => <div className="subject-row" key={subject.id || subject.name}><div className="subject-id" style={{ background: subject.color || ['#A61B32', '#C45A36', '#7F1025'][index % 3] }}>{subject.short}</div><div className="subject-name"><strong>{subject.name}</strong><span>{subject.total ? `${subject.attended} of ${subject.total} classes attended` : 'No attendance records yet'}{subject.section ? ` · ${subject.section}` : ''}</span></div><div className="subject-progress"><ProgressBar value={subject.percent} color={subject.status === 'Safe' ? 'green' : 'burgundy'} /><span>{subject.percent}%</span></div><Status tone={subject.status === 'Safe' ? 'green' : subject.status === 'Critical' ? 'red' : 'amber'}>{subject.status}</Status><div className="trend"><span className={subject.trend === 'decreasing' ? 'down' : subject.trend === 'increasing' ? 'up' : ''}>{subject.trend === 'decreasing' ? '↘' : subject.trend === 'increasing' ? '↗' : '→'}</span> {subject.trend === 'decreasing' ? 'decreasing' : subject.trend === 'increasing' ? 'increasing' : 'steady'}</div></div>)}</div>{showInsight && <div className="insight"><span className="insight-icon">✦</span><p><strong>A useful window</strong>You can miss <b>2 more DBMS classes</b> while remaining above the required threshold.</p></div>}</section>; }

function StudentAttendancePage() {
  const [subjects, setSubjects] = useState([]);
  const [requiredFraction, setRequiredFraction] = useState(0.75);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/api/student/attendance')
      .then(({ subjects: records, requiredFraction: threshold }) => {
        if (!active) return;
        const nextSubjects = records && records.length ? records : fallbackAttendanceSubjects;
        setSubjects(nextSubjects);
        setRequiredFraction(threshold || 0.75);
      })
      .catch((requestError) => { if (active) { setSubjects(fallbackAttendanceSubjects); setRequiredFraction(0.75); setError(requestError.message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="app-loading" role="status">Loading attendance...</div>;
  if (error) return <div className="login-error" role="alert">{error}</div>;
  return <><AttendancePanel subjects={subjects} showInsight={false} /><SafeAbsenceSummary subjects={subjects || fallbackAttendanceSubjects} requiredFraction={requiredFraction || 0.75} /></>;
}

function StudentMissedTopicsPage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/api/student/missed-topics')
      .then(({ topics: records }) => { if (active) setTopics(records); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="app-loading" role="status">Loading missed topics...</div>;
  if (error) return <div className="login-error" role="alert">{error}</div>;
  if (!topics.length) return <section className="section-block"><h2>No missed topics linked yet</h2><p>Topics will appear here when you are absent from a class session.</p></section>;
  return <section className="section-block"><div className="missed-grid">{topics.map((item) => <article className="missed-card" key={item.id}>
    <div className="missed-top"><span className="subject-tag">{item.subject} · {item.unit}</span><Status tone={item.recoveryStatus === 'Completed' ? 'green' : 'amber'}>{item.recoveryStatus}</Status></div>
    <h3>{item.topic}</h3>
    <div className="missed-meta"><span>Missed {item.date}</span><span>{item.section}</span></div>
    <div className="recovery-line"><span className="chain">ABSENT</span><span>→</span><span className="chain">TOPIC LINKED</span><span>→</span><span className="chain active">RECOVERY</span></div>
  </article>)}</div></section>;
}

function SafeAbsenceSummary({ subjects, requiredFraction }) {
  const rows = (subjects && subjects.length ? subjects : fallbackAttendanceSubjects).map((subject) => {
    const total = Number(subject.total) || 10;
    const attended = Number(subject.attended) || Math.round(total * 0.7);
    const classesLeft = Number(subject.classesLeft) || Math.max(0, 10 - total);
    const safeAbsences = calculateSafeAbsences(attended, total, classesLeft, requiredFraction || 0.75);
    return { ...subject, attended, total, classesLeft, safeAbsences };
  });
  return <section className="section-block safe-absence-panel">
    <div className="section-heading"><div><div className="eyebrow">Attendance planning</div><h2>Safe-absence calculator</h2></div><Status tone="green">{Math.round((requiredFraction || 0.75) * 100)}% required</Status></div>
    <div className="safe-absence-list">{rows.map((subject) => <div className="safe-absence-row" key={subject.id}>
      <div><strong>{subject.name}</strong><small>{subject.attended} attended of {subject.total} held · {subject.classesLeft} remaining</small></div>
      <strong>{subject.safeAbsences} more {subject.safeAbsences === 1 ? 'absence' : 'absences'}</strong>
    </div>)}</div>
    <p className="safe-absence-note">This estimate assumes the planned class count stays unchanged.</p>
  </section>;
}

function MissedTopics() { return <section className="section-block"><div className="section-heading"><div><div className="eyebrow">Curriculum link</div><h2>Missed sessions, ready to recover</h2></div><button className="text-btn">See all missed topics <span>→</span></button></div><div className="missed-grid">{missedTopics.map(item => <div className="missed-card" key={item.topic}><div className="missed-top"><span className="subject-tag">{item.subject}</span><span className="arrow-circle">↗</span></div><h3>{item.topic}</h3><div className="missed-meta"><span>Absent on {item.date}</span><span className={item.state === 'ready' ? 'available' : ''}>● {item.detail}</span></div><div className="recovery-line"><span className="chain">ABSENT</span><span>→</span><span className="chain">TOPIC MISSED</span><span>→</span><span className="chain active">RECOVERY</span></div><button className="outline-btn">{item.action} <span>→</span></button></div>)}</div></section>; }

function RecoveryAndCurriculum() { return <div className="two-col"><section className="section-block recovery-card"><div className="section-heading"><div><div className="eyebrow">Recovery progress</div><h2>Close the gaps at your pace</h2></div></div>{[{ subject: 'Quantum Computing', topic: 'Quantum Entanglement', value: 48, note: 'Notes reviewed · practice pending', color: 'burgundy' }, { subject: 'Deep Learning', topic: 'Convolutional Networks', value: 72, note: 'Practice in progress', color: 'green' }].map(item => <div className="recovery-item" key={item.subject}><div className="recovery-title"><strong>{item.subject}</strong><span>{item.topic}</span><b>{item.value}%</b></div><ProgressBar value={item.value} color={item.color} /><small>{item.note}</small></div>)}</section><section className="section-block curriculum-card"><div className="section-heading"><div><div className="eyebrow">Curriculum</div><h2>Syllabus at a glance</h2></div><span className="big-progress">55%</span></div><ProgressBar value={55} /><div className="curriculum-list">{curriculum.map(item => <div key={item.subject}><strong>{item.subject}</strong><span>Current: {item.current}</span><small>{item.remaining.length} topics remaining</small></div>)}</div><button className="text-btn">Open curriculum <span>→</span></button></section></div>; }

function Activities() { return <section className="section-block activity-section"><div className="section-heading"><div><div className="eyebrow">Activities & conflicts</div><h2>Make room for what matters</h2></div><button className="text-btn">My activities <span>→</span></button></div><div className="activity-row"><div className="calendar-date"><strong>10</strong><span>SEP</span></div><div className="activity-info"><span className="activity-type">Academic activity</span><h3>National Hackathon</h3><p>September 10 · 10:00 AM – 4:00 PM</p></div><div className="conflict-box"><Status>Conflict detected</Status><strong>DBMS Session</strong><span>Topic: Normalization · Pending faculty approval</span></div><button className="outline-btn">Review impact <span>→</span></button></div></section>; }

function StudentActivityRequests({ requests, onSubmit }) {
  const [form, setForm] = useState({ title: '', date: new Date().toISOString().slice(0, 10), startTime: '09:00', endTime: '10:00', reason: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit(form);
      setForm((current) => ({ ...current, title: '', reason: '' }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return <>
    <PageHeader eyebrow="Activities / Schedule check" title="Request an activity conflict review" copy="AIRS compares your activity with enrolled class times and faculty availability." />
    <form className="section-block activity-request-form" onSubmit={submit}>
      <label>Activity title<input required maxLength="120" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
      <label>Date<input required type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} /></label>
      <label>Starts<input required type="time" value={form.startTime} onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))} /></label>
      <label>Ends<input required type="time" value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} /></label>
      <label className="activity-reason">Reason<textarea required maxLength="500" rows="2" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} /></label>
      {error && <div className="login-error" role="alert">{error}</div>}
      <button className="primary-btn" type="submit" disabled={saving}>{saving ? 'Checking schedule...' : 'Check and submit'} <span>↗</span></button>
    </form>
    <section className="section-block activity-request-list">
      <div className="section-heading"><div><div className="eyebrow">My requests</div><h2>Activity review history</h2></div></div>
      {!requests.length && <p className="availability-empty">No activity requests yet.</p>}
      {requests.map((request) => <article className="activity-request-row" key={request.id}>
        <div className="activity-request-heading"><div><h3>{request.title}</h3><span>{request.date} · {request.startTime}–{request.endTime}</span></div><Status tone={request.status === 'Approved' ? 'green' : request.status === 'Declined' ? 'red' : 'amber'}>{request.status}</Status></div>
        <p>{request.reason}</p>
        {request.conflicts.length ? <ul>{request.conflicts.map((conflict, index) => <li key={`${conflict.type}-${index}`}>{conflict.type === 'class' ? `Class overlap: ${conflict.subject} · ${conflict.section} · ${conflict.startTime}–${conflict.endTime}` : conflict.type === 'faculty-unavailable' ? `Faculty unavailable: ${conflict.faculty} · ${conflict.startDate} to ${conflict.endDate}` : `Schedule time needs confirmation: ${conflict.subject} · ${conflict.section}`}</li>)}</ul> : <small>No class conflict detected; approved automatically.</small>}
      </article>)}
    </section>
  </>;
}

function ActivityApprovalQueue({ requests, user, onReview }) {
  const [error, setError] = useState('');
  const review = async (requestId, status) => {
    setError('');
    try {
      await onReview(requestId, { status });
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return <>
    <PageHeader eyebrow="Activity approvals" title="Schedule conflict review" copy="Review only the requests routed to your account." />
    {error && <div className="login-error" role="alert">{error}</div>}
    <section className="section-block activity-request-list">
      {!requests.length && <p className="availability-empty">No activity requests are assigned to this account.</p>}
      {requests.map((request) => {
        const ownReview = request.reviews.find((item) => item.reviewerId === user.id);
        const canReview = request.status === 'Pending' && ownReview?.status === 'Pending';
        return <article className="activity-request-row" key={request.id}>
          <div className="activity-request-heading"><div><h3>{request.title}</h3><span>{request.student} · {request.date} · {request.startTime}–{request.endTime}</span></div><Status tone={request.status === 'Approved' ? 'green' : request.status === 'Declined' ? 'red' : 'amber'}>{request.status}</Status></div>
          <p>{request.reason}</p>
          <ul>{request.conflicts.map((conflict, index) => <li key={`${conflict.type}-${index}`}>{conflict.type === 'class' ? `Class overlap: ${conflict.subject} · ${conflict.section} · ${conflict.startTime}–${conflict.endTime}` : conflict.type === 'faculty-unavailable' ? `Faculty availability: ${conflict.faculty} · ${conflict.startDate} to ${conflict.endDate}` : `Missing class end time: ${conflict.subject} · ${conflict.section}`}</li>)}</ul>
          {canReview ? <div className="continuity-actions"><button className="outline-btn" onClick={() => review(request.id, 'Declined')}>Decline</button><button className="primary-btn" onClick={() => review(request.id, 'Approved')}>Approve request <span>↗</span></button></div> : ownReview ? <small>Your decision: {ownReview.status}</small> : request.status === 'Pending' && <small>Awaiting review by assigned faculty or administration.</small>}
        </article>;
      })}
    </section>
  </>;
}

function ProfileScreen() { const { user, logout } = useAuth(); const profile = user || { name: 'Rishika Ahuja', email: '23100BTCSE16089@airs.edu', role: 'student', program: 'B.Tech Computer Science', year: '4th Year', semester: 'Semester 7', section: 'G', initials: 'RA' }; const rows = [['◔', 'Notifications', 'Class alerts on'], ['◈', 'Privacy', 'Manage'], ['☾', 'Appearance', 'Follows system'], ['?', 'Help centre', 'Support'], ['i', 'About AIRS', 'v1.0.0']]; return <><PageHeader eyebrow="Workspace / Profile" title="Your profile" copy="Keep your AIRS workspace aligned with the way you study." /><section className="profile-card section-block"><div className="profile-identity"><div className="profile-avatar">{profile.initials || profile.name.split(' ').map((part) => part[0]).join('').slice(0, 2)}</div><div><h2>{profile.name}</h2><p>{profile.email}</p><Status tone="green">{profile.role === 'student' ? 'Student' : profile.role === 'teacher' ? 'Teacher' : 'Admin'}</Status></div></div><div className="profile-meta">{profile.role === 'student' ? <><div><span>PROGRAM</span><strong>{profile.program}</strong></div><div><span>YEAR / SEMESTER</span><strong>{profile.year} · {profile.semester}</strong></div><div><span>SECTION</span><strong>{profile.section}</strong></div></> : profile.role === 'teacher' ? <div><span>DEPARTMENT</span><strong>{profile.department || 'Computer Science'}</strong></div> : <div><span>ACCESS</span><strong>System administration</strong></div>}</div></section><section className="profile-list">{rows.map(([icon, label, value]) => <button className="profile-row" key={label}><span className="profile-row-icon">{icon}</span><strong>{label}</strong><span>{value}</span><b>→</b></button>)}</section><button className="outline-btn profile-logout" onClick={logout}>Log out <span>→</span></button></>; }

function StudentTabsLayout({ page, setPage }) { const tabs = [['overview', '⌂', 'Home'], ['missed', '◌', 'Missed'], ['curriculum', '☷', 'Syllabus'], ['activities', '◫', 'Activities'], ['settings', '♙', 'Profile']]; return <nav className="student-tabs" aria-label="Student navigation">{tabs.map(([key, icon, label]) => <button className={page === key ? 'active' : ''} key={key} onClick={() => setPage(key)}><span>{icon}</span>{label}</button>)}</nav>; }

function CurriculumOverview() { const [selected, setSelected] = useState(curriculum[0].subject); const active = curriculum.find((item) => item.subject === selected) || curriculum[0]; const total = active.completed.length + 1 + active.remaining.length; const overallDone = curriculum.reduce((sum, item) => sum + item.completed.length, 0); const overallTotal = curriculum.reduce((sum, item) => sum + item.completed.length + 1 + item.remaining.length, 0); const todayTech = [['AI agents', 'Artificial Intelligence', 'Design systems that plan, use tools, and keep humans in control.'], ['Edge intelligence', 'Operating Systems', 'Learn how models move closer to devices for faster, private decisions.'], ['Zero-trust security', 'Database Systems', 'Treat every request as untrusted and protect data at every boundary.']]; return <><PageHeader eyebrow="Academics / Curriculum" title="Your curriculum" copy="See exactly what is complete, current, and still ahead." /><section className="curriculum-hero section-block"><div><div className="eyebrow">Semester 7 progress</div><h2>Build momentum, one topic at a time.</h2><p>Follow your current topics, revisit missed sessions, and keep the next step visible.</p></div><div className="curriculum-hero-score"><strong>{Math.round((overallDone / overallTotal) * 100)}%</strong><span>overall complete</span></div></section><div className="curriculum-subjects">{curriculum.map((item) => <button className={`curriculum-subject ${item.subject === selected ? 'active' : ''}`} key={item.subject} onClick={() => setSelected(item.subject)}><span>{item.subject}</span><strong>{Math.round((item.completed.length / (item.completed.length + 1 + item.remaining.length)) * 100)}%</strong><small>{item.completed.length} complete · {item.remaining.length} ahead</small><ProgressBar value={item.progress} /></button>)}</div><section className="curriculum-map section-block"><div className="section-heading"><div><div className="eyebrow">{active.subject} · topic map</div><h2>{active.current} is your current focus</h2></div><Status tone="green">In progress</Status></div><div className="curriculum-track"><div className="curriculum-track-line" />{active.completed.map((topic) => <div className="curriculum-topic complete" key={topic}><span>✓</span><div><strong>{topic}</strong><small>Completed</small></div></div>)}<div className="curriculum-topic current"><span>•</span><div><strong>{active.current}</strong><small>Current focus · recovery linked</small></div><b>NOW</b></div>{active.remaining.map((topic) => <div className="curriculum-topic" key={topic}><span>{active.remaining.indexOf(topic) + 1}</span><div><strong>{topic}</strong><small>Upcoming</small></div></div>)}</div><div className="curriculum-footer"><span>{active.completed.length} of {total} topic stages completed</span><button className="text-btn">View learning resources <span>→</span></button></div></section><section className="today-tech"><div className="today-tech-heading"><div><div className="eyebrow">Beyond the syllabus</div><h2>Today's technology</h2></div><span>3 emerging themes</span></div><div className="today-tech-grid">{todayTech.map(([title, subject, copy], index) => <article className="today-tech-card" key={title}><span className="today-tech-index">0{index + 1}</span><div className="today-tech-subject">{subject}</div><h3>{title}</h3><p>{copy}</p><button className="text-btn">Explore topic <span>→</span></button></article>)}</div></section></>; }

function StudentPage({ page }) { if (page === 'settings') return <ProfileScreen />; if (page === 'attendance') return <><PageHeader eyebrow="Academics / Attendance" title="Attendance intelligence" copy="A clear view of where your presence is protecting your progress." /><StudentAttendancePage /></>; if (page === 'missed') return <><PageHeader eyebrow="Academics / Missed topics" title="Missed topics" copy="See the sessions you missed and the resources ready to help you catch up." /><StudentMissedTopicsPage /></>; if (page === 'recovery') return <><PageHeader eyebrow="Academics / Recovery" title="Your recovery plan" copy="Close learning gaps with a clear sequence of notes, practice, and progress." /><RecoveryAndCurriculum /><section className="section-block recovery-next"><div><div className="eyebrow">Next best step</div><h2>Finish Normalization practice</h2><p>You have reviewed the notes. Complete the DPP to move this topic to recovered.</p></div><button className="primary-btn">Open DPP <span>↗</span></button></section></>; if (page === 'curriculum') return <CurriculumOverview />; if (page === 'activities' || page === 'conflicts') return <><PageHeader eyebrow="Activities" title="Activities & conflicts" copy="Keep your academic commitments visible alongside the rest of your semester." /><Activities /></>; return <><PageHeader eyebrow="Tuesday, September 9, 2025" title="Good evening, Rishika" copy="Semester 7 · Computer Science Engineering" /><div className="metrics"><Metric label="Overall attendance" value="78.4%" note={<><Status>Caution</Status></>} /><Metric label="Learning gaps" value="3 topics" note="Across 2 subjects" /><Metric label="Recovery progress" value="67%" note={<ProgressBar value={67} />} /><Metric label="Syllabus progress" value="62%" note="On track for semester" /></div><AttendancePanel /><MissedTopics /><RecoveryAndCurriculum /><Activities /></>; }
function StudentCurriculumPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/api/student/curriculum')
      .then(({ courses: records }) => { if (active) setCourses(records); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="app-loading" role="status">Loading curriculum...</div>;
  if (error) return <div className="login-error" role="alert">{error}</div>;
  return <><PageHeader eyebrow="Academics / Curriculum" title="Your curriculum" copy="Topics and completion are based on your enrolled section." />{courses.length ? courses.map((course) => <section className="section-block curriculum-detail" key={`${course.id}-${course.section}`}>
    <div className="section-heading"><div><div className="eyebrow">{course.code} · {course.section}</div><h2>{course.name}</h2></div><strong>{course.progress}%</strong></div>
    <ProgressBar value={course.progress} />
    {course.units.map((unit) => <div className="unit-row" key={unit.id}><div><span>{unit.title}</span>{unit.topics.map((topic) => <p key={topic.id}>{topic.title} · <strong>{topic.status}</strong></p>)}</div></div>)}
  </section>) : <section className="section-block"><h2>No curriculum assigned yet</h2><p>Course topics will appear after enrollment and syllabus setup.</p></section>}</>;
}

function StudentRecoveryPage() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/api/student/recovery')
      .then(({ topics: records }) => { if (active) setTopics(records); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="app-loading" role="status">Loading recovery plan...</div>;
  if (error) return <div className="login-error" role="alert">{error}</div>;
  return <><PageHeader eyebrow="Academics / Recovery" title="Your recovery plan" copy="Resources are linked to topics from sessions you missed." />{topics.length ? <section className="section-block"><div className="missed-grid">{topics.map((topic) => <article className="missed-card" key={topic.id}>
    <div className="missed-top"><span className="subject-tag">{topic.subject} · {topic.unit}</span><Status>{topic.recoveryStatus || 'Not started'}</Status></div>
    <h3>{topic.topic}</h3><div className="missed-meta"><span>Missed {topic.date}</span><span>{topic.section}</span></div>
    <div className="recovery-resource-list">{topic.resources.length ? topic.resources.map((resource) => <div key={resource.id}><strong>{resource.title}</strong><small>{resource.type}</small></div>) : <p className="availability-empty">No recovery resources attached yet.</p>}</div>
  </article>)}</div></section> : <section className="section-block"><h2>No recovery topics yet</h2><p>Missed topics and their resources will appear here after attendance is recorded.</p></section>}</>;
}

function ApiStudentPage({ page }) { if (page === 'settings') return <ProfileScreen />; if (page === 'attendance') return <><PageHeader eyebrow="Academics / Attendance" title="Attendance intelligence" copy="A clear view of where your presence is protecting your progress." /><StudentAttendancePage /></>; if (page === 'missed') return <><PageHeader eyebrow="Academics / Missed topics" title="Missed topics" copy="See the sessions you missed and the resources ready to help you catch up." /><StudentMissedTopicsPage /></>; if (page === 'recovery') return <StudentRecoveryPage />; if (page === 'curriculum') return <StudentCurriculumPage />; if (page === 'activities' || page === 'conflicts') return <StudentActivityRequests requests={[]} onSubmit={() => Promise.resolve()} />; return <StudentHome />; }

function TeacherDashboard({ user, setPage }) {
  const [dashboard, setDashboard] = useState(null);
  const [activityRequests, setActivityRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([apiRequest('/api/faculty/dashboard'), apiRequest('/api/activity-requests')])
      .then(([facultyData, activityData]) => {
        if (!active) return;
        setDashboard(facultyData);
        setActivityRequests(activityData.requests);
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user]);

  if (loading) return <div className="app-loading" role="status">Loading faculty dashboard...</div>;
  if (error) return <div className="login-error" role="alert">{error}</div>;

  const atRiskStudents = dashboard.atRiskStudents;
  const pendingActivities = activityRequests.filter((request) => request.status === 'Pending');
  return <>
    <PageHeader eyebrow={dashboard.today} title={`Good morning, ${user.name.split(' ')[0]}`} copy="Your schedule and student follow-up are based on current academic records." action="Take attendance" onAction={() => setPage('teacher-attendance')} />
    <section className="schedule-block section-block"><div className="section-heading"><div><div className="eyebrow">Assigned classes</div><h2>{dashboard.schedule.length ? 'Upcoming schedule' : 'No scheduled classes'}</h2></div><Status tone="green">{dashboard.metrics.assignedSections} sections</Status></div>{dashboard.schedule.length ? dashboard.schedule.map((item, index) => {
      const section = dashboard.sections.find((entry) => entry.name === item.section);
      return <div className={`schedule-row ${index === 0 ? 'current' : ''}`} key={item.id}><time>{item.date}<br /><span>{item.time}–{item.end_time}</span></time><div className="schedule-line" /><div className="schedule-detail"><div className="schedule-label">{section?.rosterSize || 0} enrolled · {item.room}</div><h3>{item.subject} <span>{item.section}</span></h3><p>Faculty assignment: <strong>{item.faculty}</strong></p></div><button className="primary-btn" onClick={() => setPage('teacher-attendance')}>Take attendance <span>↗</span></button></div>;
    }) : <p className="availability-empty">No scheduled classes in the database.</p>}</section>
    <div className="teacher-grid">
      <section className="section-block insight-panel"><div className="section-heading"><div><div className="eyebrow">Attendance insights</div><h2>Class health</h2></div><button className="text-btn" onClick={() => setPage('teacher-attendance')}>Details →</button></div><div className="teacher-metric"><div><span>Students across your sections</span><small>Current section enrollments</small></div><strong>{dashboard.metrics.students}</strong></div><div className="teacher-metric"><div><span>Students at risk</span><small>Below threshold or falling</small></div><strong className={atRiskStudents.length ? 'amber' : 'green'}>{atRiskStudents.length}</strong></div><div className="teacher-metric"><div><span>Declining attendance</span><small>Existing model forecast is falling</small></div><strong className={dashboard.metrics.decliningAttendance ? 'red' : 'green'}>{dashboard.metrics.decliningAttendance}</strong></div></section>
      <section className="section-block action-panel"><div className="eyebrow">Needs a decision</div><h2>Activity requests</h2><p>{pendingActivities.length ? `${pendingActivities.length} activity conflict requests await review.` : 'No activity conflict requests are pending.'}</p><div className="request-meta"><span>{dashboard.metrics.assignedSections} assigned sections</span><Status tone={pendingActivities.length ? 'amber' : 'green'}>{pendingActivities.length ? 'Pending review' : 'Up to date'}</Status></div><button className="outline-btn" onClick={() => setPage('requests')}>Open approvals <span>→</span></button></section>
    </div>
    <section className="section-block"><div className="section-heading"><div><div className="eyebrow">At-risk students</div><h2>Follow-up by section</h2></div></div>{atRiskStudents.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Student</th><th>Section</th><th>Attendance</th><th>Trend</th><th>Missed topics</th></tr></thead><tbody>{atRiskStudents.slice(0, 12).map((student) => <tr key={`${student.id}-${student.section}`}><td>{student.name}<small>{student.enrollment}</small></td><td>{student.section}</td><td>{student.attendanceFraction.attended}/{student.attendanceFraction.held} ({student.attendancePct}%)</td><td>{student.falling ? 'Falling' : student.trend}</td><td>{student.missedTopics}</td></tr>)}</tbody></table></div> : <p className="availability-empty">No at-risk students in your sections.</p>}</section>
  </>;
}

function StartClass({ setPage }) { const [roster, setRoster] = useState(students); const [submitted, setSubmitted] = useState(false); const markAll = () => setRoster(roster.map(student => ({ ...student, status: 'Present' }))); return <><PageHeader eyebrow="My classes / DBMS / Section A" title="Start class" copy="Record the session once. AIRS will connect attendance to curriculum automatically." action="Back to dashboard" /><div className="class-meta"><div><span>DATE</span><strong>September 9, 2025</strong></div><div><span>CLASS TIME</span><strong>9:00 – 10:00 AM</strong></div><div><span>ENROLLED</span><strong>48 students</strong></div><div><span>ROOM</span><strong>LT-204</strong></div></div>{submitted ? <div className="confirmation section-block"><div className="checkmark">✓</div><div><div className="eyebrow">Session submitted</div><h2>Attendance updated successfully</h2><p>The session is now part of your class record and student recovery plans.</p></div><div className="confirmation-list"><span>✓ Attendance Updated</span><span>✓ Curriculum Progress Updated</span><span>✓ Topic Tagged to Session</span><span>✓ Absent Students Identified</span></div><button className="primary-btn" onClick={() => setPage('dashboard')}>Return to dashboard <span>→</span></button></div> : <section className="section-block roster-panel"><div className="topic-header"><div><div className="eyebrow">Topic taught</div><h2>DBMS · Section A</h2></div><select defaultValue="Normalization"><option>Normalization</option><option>SQL Queries</option><option>Transactions</option></select></div><div className="roster-toolbar"><strong>Student attendance <span>5 of 48 shown</span></strong><button className="text-btn" onClick={markAll}>Mark all present</button><label>⌕ <input placeholder="Search students" /></label></div><div className="roster">{roster.map(student => <div className="student-row" key={student.name}><div className="student-avatar">{student.initials}</div><strong>{student.name}</strong><div className="attendance-toggle"><button className={student.status === 'Present' ? 'active-present' : ''} onClick={() => setRoster(roster.map(item => item.name === student.name ? { ...item, status: 'Present' } : item))}>Present</button><button className={student.status === 'Absent' ? 'active-absent' : ''} onClick={() => setRoster(roster.map(item => item.name === student.name ? { ...item, status: 'Absent' } : item))}>Absent</button></div></div>)}</div><div className="roster-footer"><span><b>{roster.filter(item => item.status === 'Present').length}</b> present · <b>{roster.filter(item => item.status === 'Absent').length} absent</b></span><button className="primary-btn" onClick={() => setSubmitted(true)}>Submit class session <span>↗</span></button></div></section>}</>; }

function DailyAttendance() {
  const [sections, setSections] = useState([]);
  const [sectionId, setSectionId] = useState('');
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [sectionData, setSectionData] = useState(null);
  const [statuses, setStatuses] = useState({});
  const [topicIds, setTopicIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest('/api/attendance/sections')
      .then(({ sections: records }) => {
        if (!active) return;
        setSections(records);
        setSectionId(records[0]?.id || '');
        setDate(records[0]?.latestSessionDate || today);
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!sectionId || !date) {
      setSectionData(null);
      return undefined;
    }
    let active = true;
    setLoading(true);
    apiRequest(`/api/attendance/sections/${sectionId}?date=${encodeURIComponent(date)}`)
      .then((result) => {
        if (!active) return;
        setSectionData(result);
        setStatuses(Object.fromEntries(result.students.map((student) => [student.id, student.status || 'Present'])));
        setTopicIds(result.topicIds || []);
        setSaved(Boolean(result.sessionId));
        setError('');
      })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [sectionId, date]);

  const roster = sectionData?.students || [];
  const present = roster.filter((student) => ['Present', 'Late'].includes(statuses[student.id])).length;
  const statusCounts = Object.fromEntries(['Present', 'Late', 'Absent'].map((status) => [
    status,
    roster.filter((student) => statuses[student.id] === status).length
  ]));
  const updateStatus = (studentId, status) => {
    setStatuses((current) => ({ ...current, [studentId]: status }));
    setSaved(false);
  };
  const setAll = (status) => {
    setStatuses(Object.fromEntries(roster.map((student) => [student.id, status])));
    setSaved(false);
  };
  const saveAttendance = async () => {
    setSaving(true);
    setError('');
    try {
      await apiRequest(`/api/attendance/sections/${sectionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, topicIds, attendance: roster.map((student) => ({ studentId: student.id, status: statuses[student.id] })) })
      });
      setSaved(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return <><PageHeader eyebrow="Faculty workspace / Daily record" title="Daily attendance" copy="Mark the enrolled roster and save the class record." /><section className="attendance-controls section-block"><label>Academic group<select value={sectionId} onChange={(event) => { const nextSectionId = event.target.value; const nextSection = sections.find((section) => section.id === nextSectionId); setSectionId(nextSectionId); setDate(nextSection?.latestSessionDate || today); }}>{sections.map((section) => <option key={section.id} value={section.id}>{section.name} · {section.course}</option>)}</select></label><label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><div className="attendance-summary"><strong>{present}/{roster.length}</strong><span>present or late</span></div></section>{loading ? <div className="app-loading" role="status">Loading roster...</div> : error && !sectionData ? <div className="login-error" role="alert">{error}</div> : !sections.length ? <section className="section-block daily-roster"><p>No sections are assigned to this faculty account.</p></section> : <section className="section-block daily-roster"><div className="section-heading"><div><div className="eyebrow">{date} · {sectionData?.course}</div><h2>{sectionData?.name}</h2></div><div className="attendance-bulk"><button className="outline-btn" onClick={() => setAll('Present')}>All present</button><button className="text-btn" onClick={() => setAll('Absent')}>All absent</button></div></div><fieldset className="covered-topics"><legend>Topics covered</legend>{sectionData?.topics.map((topic) => <label key={topic.id}><input type="checkbox" checked={topicIds.includes(topic.id)} onChange={(event) => { setTopicIds((current) => event.target.checked ? [...current, topic.id] : current.filter((id) => id !== topic.id)); setSaved(false); }} /><span>{topic.unit} · {topic.title}</span></label>)}</fieldset><div className="daily-roster-head"><span>STUDENT</span><span>STATUS</span></div>{roster.map((student) => <div className="daily-student-row" key={student.id}><div><strong>{student.name}</strong><small>{student.enrollment || 'Enrollment ID unavailable'}</small></div><div className="status-toggle">{['Present', 'Late', 'Absent'].map((status) => <button key={status} className={statuses[student.id] === status ? `selected ${status.toLowerCase()}` : ''} onClick={() => updateStatus(student.id, status)}>{status}</button>)}</div></div>)}<div className="attendance-submit-summary" role="status" aria-live="polite">{statusCounts.Present} Present, {statusCounts.Late} Late, {statusCounts.Absent} Absent</div>{error && <div className="login-error" role="alert">{error}</div>}{saved && <div className="availability-confirmation" role="status">Attendance saved for {roster.length} students.</div>}<button className="primary-btn daily-save" onClick={saveAttendance} disabled={saving || !roster.length}>{saving ? 'Saving...' : 'Submit'} <span>↗</span></button></section>}</>;
}

function facultyDutyRange(schedule, faculty, startDate, endDate) {
  return schedule.filter((entry) => (
    entry.faculty.toLowerCase() === faculty.toLowerCase()
    && entry.date >= startDate
    && entry.date <= endDate
  ));
}

function FacultyAvailabilityPage({ user, requests, schedule, onSubmitRequest }) {
  const [startDate, setStartDate] = useState('2026-10-02');
  const [endDate, setEndDate] = useState('2026-10-02');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const duties = startDate && endDate >= startDate ? facultyDutyRange(schedule, user.name, startDate, endDate) : [];
  const myRequests = requests.filter((request) => request.faculty.toLowerCase() === user.name.toLowerCase());

  const submit = async (event) => {
    event.preventDefault();
    if (!startDate || !endDate || endDate < startDate || !reason.trim()) {
      setError('Enter a valid date range and a reason for your request.');
      return;
    }
    try {
      await onSubmitRequest({ startDate, endDate, reason: reason.trim() });
      setReason('');
      setError('');
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError.message);
    }
  };

  return <>
    <PageHeader eyebrow="Faculty workspace / Availability" title="Request time away" copy="Check your assigned academic duties before submitting. Admin review will plan coverage before approving." />
    <form className="section-block availability-form" onSubmit={submit}>
      <div className="availability-fields">
        <label>From<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
        <label>Through<input type="date" min={startDate} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
        <label className="availability-reason">Reason<textarea rows="2" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Add a brief reason" /></label>
      </div>
      <div className="availability-impact">
        <div className="section-heading"><div><div className="eyebrow">Schedule check</div><h2>{duties.length ? `${duties.length} assigned responsibilities` : 'No scheduled responsibilities found'}</h2></div></div>
        {duties.length ? <div className="availability-duty-list">{duties.map((duty) => <div className="availability-duty" key={`${duty.date}-${duty.time}-${duty.type}-${duty.subject}`}><Status tone={duty.type === 'Exam' ? 'red' : duty.type === 'Activity' ? 'amber' : 'green'}>{duty.type}</Status><strong>{duty.time} · {duty.subject}</strong><span>{duty.section} · {duty.room}</span></div>)}</div> : <p className="availability-empty">The current schedule has no duties assigned to you during these dates.</p>}
      </div>
      {error && <div className="login-error" role="alert">{error}</div>}
      {submitted && <div className="availability-confirmation" role="status">Request submitted. Your schedule is held for admin review.</div>}
      <button className="primary-btn" type="submit">Submit availability request <span>↗</span></button>
    </form>
    <section className="section-block availability-history">
      <div className="section-heading"><div><div className="eyebrow">Request history</div><h2>Your submissions</h2></div></div>
      {myRequests.length ? myRequests.map((request) => <div className="availability-history-row" key={request.id}><div><strong>{request.startDate} to {request.endDate}</strong><span>{request.reason}</span>{request.coveragePlan && <small>Coverage: {formatCoveragePlan(request.coveragePlan)}</small>}</div><Status tone={request.status === 'Approved' ? 'green' : request.status === 'Declined' ? 'red' : 'amber'}>{request.status}</Status></div>) : <p className="availability-empty">You have not submitted an availability request.</p>}
    </section>
  </>;
}

function TeacherPage({ page, setPage, user, requests, schedule, onSubmitRequest }) { if (page === 'start-class') return <StartClass setPage={setPage} />; if (page === 'profile') return <ProfileScreen />; if (page === 'teacher-curriculum') return <><PageHeader eyebrow="Curriculum" title="DBMS curriculum" copy="Keep the teaching plan aligned with the learning journey." /><section className="section-block curriculum-detail"><div className="unit-row"><div><span>UNIT 1</span><h2>Foundations of Databases</h2></div><Status tone="green">Completed</Status></div><div className="unit-row current-unit"><div><span>UNIT 2</span><h2>Relational Design</h2><p>Current topic: <strong>Normalization</strong></p></div><strong className="unit-percent">62%</strong></div><div className="topic-columns"><div><span>COMPLETED</span><p>ER Model</p><p>Relational Model</p></div><div><span>REMAINING TOPICS</span><p>SQL Queries</p><p>Transactions</p><p>Concurrency Control</p></div></div><ProgressBar value={62} /></section></>; if (page === 'teacher-attendance') return <DailyAttendance />; if (page === 'availability') return <FacultyAvailabilityPage user={user} requests={requests} schedule={schedule} onSubmitRequest={onSubmitRequest} />; if (page === 'requests') return <><PageHeader eyebrow="Activity requests" title="Requests needing review" copy="Make decisions that keep student activities and course progress in conversation." /><Activities /></>; if (page === 'teacher-conflicts') return <><PageHeader eyebrow="Faculty review" title="Schedule conflicts" copy="Review student activities that overlap with teaching sessions." /><Activities /></>; return <TeacherDashboard user={user} setPage={setPage} />; }

const adminUsers = [
  { name: 'Alicia Reed', role: 'System admin', status: 'Active', department: 'Administration', email: 'alicia@airs.edu' },
  { name: 'Dr. Meera Iyer', role: 'Faculty', status: 'Active', department: 'Computer Science', email: 'meera@airs.edu' },
  { name: 'Rohan Das', role: 'Student', status: 'On-track', department: 'CSE - 6A', email: 'rohan@airs.edu' },
  { name: 'Nisha Nair', role: 'Student', status: 'At-risk', department: 'CSE - 6B', email: 'nisha@airs.edu' }
];

const departmentSummary = [
  { name: 'Computer Science', students: 1420, faculty: 64, sections: 18, completion: 82 },
  { name: 'Electronics', students: 980, faculty: 41, sections: 12, completion: 76 },
  { name: 'Mechanical', students: 760, faculty: 35, sections: 10, completion: 71 },
  { name: 'Humanities', students: 620, faculty: 22, sections: 8, completion: 89 }
];

const adminCurriculumRows = [
  { subject: 'DBMS', section: 'CSE-6A', progress: 68, status: 'Behind plan' },
  { subject: 'Operating Systems', section: 'CSE-6B', progress: 74, status: 'At risk' },
  { subject: 'Computer Networks', section: 'CSE-5A', progress: 81, status: 'On track' },
  { subject: 'Signals', section: 'ECE-4C', progress: 71, status: 'Behind plan' }
];

const adminAnalyticsRows = [
  { section: 'CSE-6A', subject: 'DBMS', attendance: 68, risk: 'Critical', faculty: 'Dr. Meera Iyer' },
  { section: 'CSE-6B', subject: 'Operating Systems', attendance: 72, risk: 'High', faculty: 'Prof. Karan Sud' },
  { section: 'ECE-4C', subject: 'Signals', attendance: 75, risk: 'Watch', faculty: 'Dr. Nandini' },
  { section: 'CSE-5A', subject: 'CN', attendance: 71, risk: 'Critical', faculty: 'Prof. Arun' }
];

const adminActivityQueue = [
  { title: 'Hackathon approval', student: 'Aarav Sharma', status: 'Pending', priority: 'High' },
  { title: 'Club registration', student: 'Ishita Rao', status: 'Under review', priority: 'Medium' },
  { title: 'Sports event conflict', student: 'Kabir Nair', status: 'Escalated', priority: 'High' },
  { title: 'Cultural fest request', student: 'Rhea Sen', status: 'Approved', priority: 'Low' }
];

const adminAuditLog = [
  { action: 'Attendance threshold updated', actor: 'Alicia Reed', time: '09:12 AM', record: 'Semester 7 · threshold 75%' },
  { action: 'Faculty assignment changed', actor: 'System admin', time: '08:40 AM', record: 'DBMS · CSE-6A' },
  { action: 'Correction request escalated', actor: 'Prof. Karan Sud', time: '08:05 AM', record: '3 items in queue' },
  { action: 'Student import completed', actor: 'Admissions sync', time: 'Yesterday', record: '120 new accounts' }
];

const adminRuleCards = [
  { name: 'Attendance threshold', value: '75%', status: 'Active' },
  { name: 'Risk band', value: 'Safe / Caution / Critical', status: 'Configured' },
  { name: 'Correction window', value: '48 hrs', status: 'Applied' },
  { name: 'Escalation timing', value: '12 hrs', status: 'Applied' }
];

const adminReports = [
  { name: 'Attendance report', type: 'PDF', owner: 'Admin office' },
  { name: 'Defaulter list', type: 'CSV', owner: 'Academic office' },
  { name: 'Syllabus completion', type: 'Excel', owner: 'Department heads' },
  { name: 'Participation summary', type: 'PDF', owner: 'Activities team' }
];

const adminSecurityStatus = [
  { label: 'Active sessions', value: '18' },
  { label: 'Password policy', value: 'Compliant' },
  { label: 'Backup status', value: 'Healthy' },
  { label: 'Login anomalies', value: '02' }
];

function AdminModulePage({ eyebrow, title, summary, children }) {
  return <>
    <PageHeader eyebrow={eyebrow} title={title} copy={summary} />
    {children}
  </>;
}

function AdminUsersPage({ users, onCreateUser }) {
  const [form, setForm] = useState({ name: '', email: '', role: 'teacher', password: '', enrollment: '', department: '', section: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    try {
      await onCreateUser(form);
      setForm({ name: '', email: '', role: 'teacher', password: '', enrollment: '', department: '', section: '' });
      setError('');
      setNotice('Account created. Share its sign-in credentials securely.');
    } catch (createError) {
      setError(createError.message);
      setNotice('');
    }
  };

  return <AdminModulePage eyebrow="Accounts" title="User management" summary="Create accounts that can be assigned to academic duties and availability requests.">
    <form className="section-block admin-user-form" onSubmit={submit}>
      <div className="section-heading"><div><div className="eyebrow">New account</div><h2>Add an institutional user</h2></div></div>
      <div className="admin-form-grid">
        <label>Name<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
        <label>Email<input required type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
        <label>Role<select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}><option value="teacher">Faculty</option><option value="student">Student</option><option value="admin">Administrator</option></select></label>
        {form.role === 'student' && <label>Enrollment ID<input required value={form.enrollment} onChange={(event) => setForm((current) => ({ ...current, enrollment: event.target.value }))} /></label>}
        <label>Department<input value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} /></label>
        {form.role === 'student' && <label>Section<input value={form.section} onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))} /></label>}
        <label>Initial password<input required type="password" minLength="12" autoComplete="new-password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} /></label>
      </div>
      {error && <div className="login-error" role="alert">{error}</div>}
      {notice && <div className="availability-confirmation" role="status">{notice}</div>}
      <button className="primary-btn" type="submit">Create account <span>↗</span></button>
    </form>
    <section className="section-block">
      <div className="section-heading"><div><div className="eyebrow">Directory</div><h2>{users.length} accounts</h2></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Name</th><th>Role</th><th>Department / section</th><th>Email</th><th>Enrollment</th></tr></thead>
        <tbody>{users.map((user) => <tr key={user.id}><td>{user.name}</td><td>{user.role}</td><td>{user.section || user.department || '—'}</td><td>{user.email}</td><td>{user.enrollment || '—'}</td></tr>)}</tbody>
      </table></div>
    </section>
  </AdminModulePage>;
}

function AdminAcademicPage() {
  return <AdminModulePage eyebrow="Academic setup" title="Academic structure" summary="Review departments, sections, programs, and academic health in one working view.">
    <div className="admin-dashboard-grid">
      <section className="section-block admin-panel">
        <div className="section-heading"><div><div className="eyebrow">Departments</div><h2>Department summary</h2></div></div>
        <div className="admin-progress-stack">
          {departmentSummary.map((dept) => (
            <div key={dept.name} className="admin-progress-row">
              <div className="admin-progress-label"><span>{dept.name}</span><strong>{dept.completion}%</strong></div>
              <div className="mini-bar"><i style={{ width: `${dept.completion}%` }} /></div>
              <small className="admin-small-meta">{dept.students} students · {dept.faculty} faculty · {dept.sections} sections</small>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block admin-panel">
        <div className="section-heading"><div><div className="eyebrow">Enrollment</div><h2>Current academic snapshot</h2></div></div>
        <div className="admin-activity-grid">
          <div className="admin-activity-card"><span>Programs</span><strong>12</strong><small>Across 4 schools</small></div>
          <div className="admin-activity-card"><span>Sections</span><strong>96</strong><small>Active this semester</small></div>
          <div className="admin-activity-card"><span>Semesters</span><strong>08</strong><small>Academic cycle in use</small></div>
          <div className="admin-activity-card"><span>Subjects</span><strong>134</strong><small>Mapped to curriculum</small></div>
        </div>
      </section>
    </div>
  </AdminModulePage>;
}

function AdminTimetablePage({ schedule, users, onCreateSchedule, onDeleteSchedule }) {
  const faculty = users.filter((user) => user.role === 'teacher');
  const [form, setForm] = useState({ date: '2026-10-02', time: '09:00', endTime: '10:00', type: 'Class', subject: '', section: '', faculty: '', room: '' });
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    try {
      await onCreateSchedule({ ...form, faculty: form.faculty || faculty[0]?.name || '' });
      setForm((current) => ({ ...current, subject: '', section: '', room: '' }));
      setError('');
    } catch (createError) {
      setError(createError.message);
    }
  };

  return <AdminModulePage eyebrow="Academic operations" title="Upcoming responsibilities" summary="Review classes, examinations, and activities by date, owner, and location.">
    <form className="section-block admin-user-form" onSubmit={submit}>
      <div className="section-heading"><div><div className="eyebrow">Schedule a duty</div><h2>Assign academic responsibility</h2></div></div>
      <div className="admin-form-grid">
        <label>Date<input required type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} /></label>
        <label>Time<input required type="time" value={form.time} onChange={(event) => setForm((current) => ({ ...current, time: event.target.value }))} /></label>
        <label>End time<input required type="time" min={form.time} value={form.endTime} onChange={(event) => setForm((current) => ({ ...current, endTime: event.target.value }))} /></label>
        <label>Duty type<select value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}><option>Class</option><option>Exam</option><option>Activity</option></select></label>
        <label>Responsibility<input required value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} /></label>
        <label>Section / audience<input required value={form.section} onChange={(event) => setForm((current) => ({ ...current, section: event.target.value }))} /></label>
        <label>Faculty<select required value={form.faculty || faculty[0]?.name || ''} onChange={(event) => setForm((current) => ({ ...current, faculty: event.target.value }))}>{faculty.map((member) => <option key={member.id} value={member.name}>{member.name}</option>)}</select></label>
        <label>Location<input required value={form.room} onChange={(event) => setForm((current) => ({ ...current, room: event.target.value }))} /></label>
      </div>
      {error && <div className="login-error" role="alert">{error}</div>}
      <button className="primary-btn" type="submit" disabled={!faculty.length}>Add to schedule <span>↗</span></button>
    </form>
    <section className="section-block">
      <div className="section-heading"><div><div className="eyebrow">Shared schedule</div><h2>Assigned duties</h2></div></div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Responsibility</th><th>Section</th><th>Faculty</th><th>Location</th><th>Action</th></tr></thead>
          <tbody>
            {schedule.map((entry) => (
              <tr key={entry.id}>
                <td>{entry.date}</td>
                <td>{entry.time}–{entry.end_time || 'end not set'}</td>
                <td>{entry.type}</td>
                <td>{entry.subject}</td>
                <td>{entry.section}</td>
                <td>{entry.faculty}</td>
                <td>{entry.room}</td>
                <td><button className="text-btn inline-link" onClick={() => onDeleteSchedule(entry.id)}>Remove</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </AdminModulePage>;
}

function AdminContinuityPage({ requests, schedule, onReviewRequest }) {
  const [coveragePlans, setCoveragePlans] = useState({});
  const pendingRequests = requests.filter((request) => request.status === 'Pending');
  const affectedDutyCount = pendingRequests.reduce((total, request) => total + (request.duties?.length || 0), 0);

  return <AdminModulePage eyebrow="Academic operations" title="Continuity review" summary="Resolve every scheduled responsibility before approving faculty unavailability.">
    <section className="metrics admin-kpis">
      <Metric label="Pending requests" value={pendingRequests.length} note="Awaiting admin decision" />
      <Metric label="Affected duties" value={affectedDutyCount} note="Classes, exams, and activities" />
      <Metric label="Approved" value={requests.filter((request) => request.status === 'Approved').length} note="Coverage plan recorded" />
    </section>
    <section className="section-block continuity-queue">
      <div className="section-heading"><div><div className="eyebrow">Faculty availability</div><h2>Requests and schedule impact</h2></div></div>
      {!requests.length && <p className="availability-empty">No faculty availability requests have been submitted.</p>}
      {requests.map((request) => {
        const duties = request.duties || facultyDutyRange(schedule, request.faculty, request.startDate, request.endDate);
        const coveragePlan = coveragePlans[request.id] || {};
        const isPending = request.status === 'Pending';
        const dutyKey = (duty) => duty.id;
        const allDutiesCovered = duties.every((duty) => coveragePlan[dutyKey(duty)]?.trim());
        const savedCoveragePlan = Object.fromEntries(duties.map((duty) => [duty.id, coveragePlan[dutyKey(duty)]?.trim() || '']));
        return <article className="continuity-request" key={request.id}>
          <div className="continuity-request-head">
            <div><h3>{request.faculty}</h3><span>{request.startDate} to {request.endDate} · {request.reason}</span></div>
            <Status tone={request.status === 'Approved' ? 'green' : request.status === 'Declined' ? 'red' : 'amber'}>{request.status}</Status>
          </div>
          <div className="continuity-duty-list">
            <strong>{duties.length ? `${duties.length} responsibilities to cover` : 'No scheduled duties found'}</strong>
            {duties.length ? duties.map((duty) => <div className="continuity-duty" key={duty.id || `${duty.date}-${duty.time}-${duty.subject}`}><Status tone={duty.type === 'Exam' ? 'red' : duty.type === 'Activity' ? 'amber' : 'green'}>{duty.type}</Status><span>{duty.date} · {duty.time} · {duty.subject} · {duty.section} · {duty.room}</span></div>) : <span className="availability-empty">No matching schedule entries in this date range.</span>}
          </div>
          {isPending ? <>
            {duties.length > 0 && <div className="coverage-plan-list">{duties.map((duty) => <label className="coverage-plan-field" key={dutyKey(duty)}>Cover {duty.type} · {duty.subject}<input value={coveragePlan[dutyKey(duty)] || ''} onChange={(event) => setCoveragePlans((current) => ({ ...current, [request.id]: { ...(current[request.id] || {}), [dutyKey(duty)]: event.target.value } }))} placeholder="Substitute name or reschedule plan" /></label>)}</div>}
            <div className="continuity-actions"><button className="outline-btn" onClick={() => onReviewRequest(request.id, { status: 'Declined' })}>Decline</button><button className="primary-btn" disabled={!allDutiesCovered} onClick={() => onReviewRequest(request.id, { status: 'Approved', coveragePlans: savedCoveragePlan })}>{duties.length ? 'Approve with coverage' : 'Approve request'} <span>↗</span></button></div>
          </> : request.coveragePlan && <p className="continuity-coverage"><strong>Recorded coverage:</strong> {formatCoveragePlan(request.coveragePlan)}</p>}
        </article>;
      })}
    </section>
  </AdminModulePage>;
}

function AdminCurriculumPage() {
  return <AdminModulePage eyebrow="Curriculum oversight" title="Syllabus tracking" summary="Monitor subject completion and identify sections that are behind plan.">
    <section className="section-block">
      <div className="section-heading"><div><div className="eyebrow">Progress</div><h2>Subject and section overview</h2></div></div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Subject</th><th>Section</th><th>Progress</th><th>Status</th></tr></thead>
          <tbody>
            {adminCurriculumRows.map((row) => (
              <tr key={`${row.subject}-${row.section}`}>
                <td>{row.subject}</td>
                <td>{row.section}</td>
                <td><div className="mini-bar"><i style={{ width: `${row.progress}%` }} /></div></td>
                <td><Status tone={row.status === 'Behind plan' ? 'amber' : row.status === 'At risk' ? 'red' : 'green'}>{row.status}</Status></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </AdminModulePage>;
}

function AdminAnalyticsPage() {
  return <AdminModulePage eyebrow="Attendance oversight" title="Attendance analytics" summary="Review real attendance health by section, course, and at-risk status without making direct edits.">
    <div className="admin-dashboard-grid">
      <section className="section-block admin-panel">
        <div className="section-heading"><div><div className="eyebrow">Risk list</div><h2>At-risk course mix</h2></div></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Section</th><th>Subject</th><th>Attendance</th><th>Risk</th><th>Faculty</th></tr></thead>
            <tbody>
              {adminAnalyticsRows.map((row) => (
                <tr key={`${row.section}-${row.subject}`}>
                  <td>{row.section}</td>
                  <td>{row.subject}</td>
                  <td>{row.attendance}%</td>
                  <td><Status tone={row.risk === 'Critical' ? 'red' : row.risk === 'High' ? 'amber' : 'green'}>{row.risk}</Status></td>
                  <td>{row.faculty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-block admin-panel">
        <div className="section-heading"><div><div className="eyebrow">Cohort health</div><h2>Department split</h2></div></div>
        <div className="admin-progress-stack">
          {adminDepartmentHealth.map(({ name, percent }) => (
            <div key={name} className="admin-progress-row">
              <div className="admin-progress-label"><span>{name}</span><strong>{percent}%</strong></div>
              <div className="mini-bar"><i style={{ width: `${percent}%` }} /></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  </AdminModulePage>;
}

function AdminActivitiesPage() {
  return <AdminModulePage eyebrow="Activities" title="Activities and clubs" summary="Track participation, conflict reviews, and escalated requests from one queue.">
    <div className="admin-dashboard-grid">
      <section className="section-block admin-panel">
        <div className="section-heading"><div><div className="eyebrow">Queue</div><h2>Activity approvals</h2></div></div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Title</th><th>Student</th><th>Status</th><th>Priority</th></tr></thead>
            <tbody>
              {adminActivityQueue.map((item) => (
                <tr key={item.title}>
                  <td>{item.title}</td>
                  <td>{item.student}</td>
                  <td><Status tone={item.status === 'Escalated' ? 'red' : item.status === 'Pending' ? 'amber' : 'green'}>{item.status}</Status></td>
                  <td>{item.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section-block admin-panel">
        <div className="section-heading"><div><div className="eyebrow">Overview</div><h2>Weekly activity score</h2></div></div>
        <div className="admin-activity-grid">
          <div className="admin-activity-card"><span>Active activities</span><strong>18</strong><small>7 pending approvals</small></div>
          <div className="admin-activity-card"><span>Participation</span><strong>1284</strong><small>Across clubs and events</small></div>
          <div className="admin-activity-card"><span>Conflict requests</span><strong>09</strong><small>4 need admin review</small></div>
          <div className="admin-activity-card"><span>Escalated</span><strong>03</strong><small>2 unresolved</small></div>
        </div>
      </section>
    </div>
  </AdminModulePage>;
}

function AdminAuditPage({ events }) {
  return <AdminModulePage eyebrow="Audit" title="Corrections and audit" summary="Track actions taken across attendance, assignments, and escalation decisions.">
    <section className="section-block">
      <div className="section-heading"><div><div className="eyebrow">Log</div><h2>Recent actions</h2></div></div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>{new Date(event.created_at).toLocaleString()}</td>
                <td>{event.actor}</td>
                <td>{event.action}</td>
                <td>{formatAuditDetails(event.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </AdminModulePage>;
}

function AttendancePolicyControl() {
  const [percentage, setPercentage] = useState('75');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest('/api/attendance-policy')
      .then(({ requiredFraction }) => { if (active) setPercentage(String(Math.round(requiredFraction * 100))); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await apiRequest('/api/admin/attendance-policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requiredFraction: Number(percentage) / 100 })
      });
      setPercentage(String(Math.round(result.requiredFraction * 100)));
      setMessage('Attendance policy updated.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return <form className="section-block attendance-policy-form" onSubmit={save}>
    <div><div className="eyebrow">Institution policy</div><h2>Minimum attendance</h2><p>Used by every student safe-absence estimate.</p></div>
    <label>Required percentage<input type="number" min="50" max="100" step="1" value={percentage} onChange={(event) => setPercentage(event.target.value)} disabled={loading} /></label>
    <button className="primary-btn" type="submit" disabled={loading || saving}>{saving ? 'Saving...' : 'Save policy'} <span>↗</span></button>
    {error && <div className="login-error" role="alert">{error}</div>}
    {message && <div className="availability-confirmation" role="status">{message}</div>}
  </form>;
}

function AdminRulesPage() {
  return <AdminModulePage eyebrow="Rules" title="Configuration and policies" summary="Operational thresholds and policy settings that guide risk, attendance, and escalation logic.">
    <AttendancePolicyControl />
    <div className="admin-dashboard-grid">
      {adminRuleCards.filter((rule) => rule.name !== 'Attendance threshold').map((rule) => (
        <section className="section-block admin-panel" key={rule.name}>
          <div className="section-heading"><div><div className="eyebrow">Setting</div><h2>{rule.name}</h2></div><Status tone={rule.status === 'Active' ? 'green' : 'amber'}>{rule.status}</Status></div>
          <div className="admin-rule-value">{rule.value}</div>
        </section>
      ))}
    </div>
  </AdminModulePage>;
}

function AdminReportsPage() {
  return <AdminModulePage eyebrow="Reports" title="Reports and exports" summary="Generate and review standardized academic and operational reports.">
    <section className="section-block">
      <div className="section-heading"><div><div className="eyebrow">Templates</div><h2>Available exports</h2></div><button className="primary-btn">Generate report <span>↗</span></button></div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Type</th><th>Owner</th><th>Action</th></tr></thead>
          <tbody>
            {adminReports.map((report) => (
              <tr key={report.name}>
                <td>{report.name}</td>
                <td>{report.type}</td>
                <td>{report.owner}</td>
                <td><button className="text-btn inline-link">Download <span>→</span></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  </AdminModulePage>;
}

function AdminSecurityPage() {
  return <AdminModulePage eyebrow="Security" title="System and access health" summary="Monitor session counts, policy compliance, backups, and suspicious activity trends.">
    <div className="admin-dashboard-grid">
      {adminSecurityStatus.map((item) => (
        <section className="section-block admin-panel" key={item.label}>
          <div className="section-heading"><div><div className="eyebrow">Security</div><h2>{item.label}</h2></div></div>
          <div className="admin-rule-value">{item.value}</div>
        </section>
      ))}
    </div>
  </AdminModulePage>;
}

const adminRiskStudents = [
  { name: 'Aarav Sharma', section: 'CSE-6A', subject: 'DBMS', attendance: 68, risk: 'Critical', lastAttendance: '2026-09-04', view: 'View' },
  { name: 'Nisha Nair', section: 'CSE-6B', subject: 'Operating Systems', attendance: 72, risk: 'High', lastAttendance: '2026-09-03', view: 'View' },
  { name: 'Rohit Das', section: 'ECE-4C', subject: 'Signals', attendance: 75, risk: 'Watch', lastAttendance: '2026-09-02', view: 'View' },
  { name: 'Meera Iyer', section: 'CSE-5A', subject: 'CN', attendance: 71, risk: 'Critical', lastAttendance: '2026-09-04', view: 'View' }
];

const adminDepartmentHealth = [
  { name: 'Computer Science', percent: 82 },
  { name: 'Electronics', percent: 76 },
  { name: 'Mechanical', percent: 71 },
  { name: 'Humanities', percent: 89 }
];

const adminSyllabusWatch = [
  { label: 'Department-wise syllabus completion', value: '82%', tone: 'green' },
  { label: 'Subjects behind schedule', value: '12', tone: 'amber' },
  { label: 'Sections behind schedule', value: '06', tone: 'red' },
  { label: 'Sessions missing attendance', value: '07', tone: 'amber' }
];

const adminAlerts = [
  { title: 'DBMS · CSE-6A', detail: 'Attendance below 75% threshold · 3 students currently flagged', tone: 'critical' },
  { title: '12 correction requests', detail: 'Escalated to admin review queue', tone: 'warn' },
  { title: '7 sessions', detail: 'Missing attendance marks from faculty submission', tone: 'warn' },
  { title: 'CSE-6B', detail: 'Syllabus behind schedule by 2.4 weeks', tone: 'critical' }
];

const adminActivityCards = [
  { title: 'Active activities this week', value: '18', caption: '7 pending approvals' },
  { title: 'Participation count', value: '1,284', caption: 'Across clubs and events' },
  { title: 'Conflict requests', value: '09', caption: '4 need admin review' },
  { title: 'Escalated requests', value: '03', caption: '2 unresolved > 48h' }
];

const adminAuditRows = [
  'Admin changed attendance threshold → 75%',
  'Faculty assigned to DBMS CSE-6A',
  '3 correction requests escalated',
  'Student accounts imported → 120'
];

function AdminOverview({ requests, schedule, setPage }) {
  const pendingRequests = requests.filter((request) => request.status === 'Pending');
  const pendingDuties = pendingRequests.flatMap((request) => request.duties || []);
  const countPendingDuties = (type) => pendingDuties.filter((duty) => duty.type === type).length;
  const approvedRequests = requests.filter((request) => request.status === 'Approved').length;
  const upcomingDuties = [...schedule].sort((first, second) => `${first.date}-${first.time}`.localeCompare(`${second.date}-${second.time}`)).map((duty) => {
    const request = requests.find((item) => (
      item.faculty.toLowerCase() === duty.faculty.toLowerCase()
      && duty.date >= item.startDate
      && duty.date <= item.endDate
    ));
    const status = request?.status === 'Pending' ? 'Needs coverage' : request?.status === 'Approved' ? 'Coverage planned' : request?.status === 'Declined' ? 'Request declined' : 'Assigned';
    const tone = request?.status === 'Pending' ? 'red' : request?.status === 'Approved' ? 'green' : request?.status === 'Declined' ? 'amber' : 'green';
    return { ...duty, status, tone, coveragePlan: request?.status === 'Approved' ? formatCoveragePlan(request.coveragePlan) : '' };
  });
  return <>
    <PageHeader eyebrow="Academic continuity" title="Keep the institution running" copy="Resolve faculty absences without leaving classes, examinations, or activities uncovered." />

    <section className="metrics admin-kpis">
      <Metric label="Pending requests" value={pendingRequests.length} note="Require review" />
      <Metric label="Classes at risk" value={countPendingDuties('Class')} note="Need a substitute or reschedule" />
      <Metric label="Exams at risk" value={countPendingDuties('Exam')} note="Invigilation must be covered" />
      <Metric label="Activities at risk" value={countPendingDuties('Activity')} note="Coordinator duties need cover" />
      <Metric label="Approved absences" value={approvedRequests} note="Coverage plan recorded" />
    </section>

    <section className="section-block continuity-overview">
      <div className="section-heading"><div><div className="eyebrow">Decisions required</div><h2>Faculty unavailability</h2></div><button className="text-btn" onClick={() => setPage('admin-continuity')}>Open continuity review <span>→</span></button></div>
      {pendingRequests.length ? pendingRequests.slice(0, 5).map((request) => <div className="continuity-overview-row" key={request.id}><div><strong>{request.faculty}</strong><span>{request.startDate} to {request.endDate} · {request.reason}</span></div><div className="continuity-overview-impact"><strong>{(request.duties || []).length}</strong><span>duties affected</span></div><Status>{request.status}</Status></div>) : <p className="availability-empty">No pending faculty absences. Upcoming schedule duties are listed in the timetable.</p>}
    </section>

    <div className="admin-dashboard-grid">
      <section className="section-block admin-panel admin-panel-wide">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Academic continuity</div>
            <h2>Upcoming responsibility coverage</h2>
          </div>
          <button className="text-btn" onClick={() => setPage('admin-timetable')}>Open timetable <span>→</span></button>
        </div>
        <div className="continuity-schedule-list">{upcomingDuties.map((duty) => <div className="continuity-schedule-row" key={`${duty.date}-${duty.time}-${duty.type}-${duty.subject}`}><div className="continuity-schedule-time"><strong>{duty.date}</strong><span>{duty.time}</span></div><div className="continuity-schedule-description"><strong>{duty.type} · {duty.subject}</strong><span>{duty.faculty} · {duty.section} · {duty.room}</span>{duty.coveragePlan && <small>{duty.coveragePlan}</small>}</div><Status tone={duty.tone}>{duty.status}</Status></div>)}</div>
      </section>

      <section className="section-block admin-panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Department view</div>
            <h2>Attendance by department</h2>
          </div>
        </div>

        <div className="admin-progress-stack">
          {adminDepartmentHealth.map(({ name, percent }) => (
            <div key={name} className="admin-progress-row">
              <div className="admin-progress-label">
                <span>{name}</span>
                <strong>{percent}%</strong>
              </div>
              <div className="mini-bar"><i style={{ width: `${percent}%` }} /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block admin-panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Subject health</div>
            <h2>Attendance by subject</h2>
          </div>
        </div>

        <div className="admin-subject-list">
          {[
            ['DBMS', 68, 'Critical'],
            ['OS', 79, 'Caution'],
            ['CN', 74, 'Watch'],
            ['DSA', 84, 'Safe']
          ].map(([subject, percent, state]) => (
            <div key={subject} className="admin-subject-row">
              <div>
                <strong>{subject}</strong>
                <span>{percent}%</span>
              </div>
              <ProgressBar value={percent} color={state === 'Critical' ? 'burgundy' : state === 'Caution' ? 'amber' : 'green'} />
              <Status tone={state === 'Critical' ? 'red' : state === 'Caution' ? 'amber' : 'green'}>{state}</Status>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block admin-panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Student risk mix</div>
            <h2>Safe / caution / critical</h2>
          </div>
        </div>

        <div className="admin-risk-breakdown">
          <div><strong>58%</strong><span>Safe</span></div>
          <div><strong>26%</strong><span>Caution</span></div>
          <div><strong>16%</strong><span>Critical</span></div>
        </div>
      </section>
    </div>

    <section className="section-block admin-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">At-risk students</div>
          <h2>Students requiring follow-up</h2>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Student name</th>
              <th>Section</th>
              <th>Subject</th>
              <th>Attendance %</th>
              <th>Risk level</th>
              <th>Last attendance</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {adminRiskStudents.map((student) => (
              <tr key={student.name}>
                <td>{student.name}</td>
                <td>{student.section}</td>
                <td>{student.subject}</td>
                <td>{student.attendance}%</td>
                <td><Status tone={student.risk === 'Critical' ? 'red' : student.risk === 'High' ? 'amber' : 'green'}>{student.risk}</Status></td>
                <td>{student.lastAttendance}</td>
                <td><button className="text-btn inline-link">{student.view} <span>→</span></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>

    <div className="admin-two-col">
      <section className="section-block admin-panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Academic monitoring</div>
            <h2>Syllabus & attendance control</h2>
          </div>
        </div>

        <div className="admin-monitor-grid">
          {adminSyllabusWatch.map(({ label, value, tone }) => (
            <div key={label} className="admin-mini-stat">
              <span>{label}</span>
              <strong className={tone}>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block admin-panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Attention required</div>
            <h2>Alerts and escalations</h2>
          </div>
        </div>

        <div className="admin-alert-list">
          {adminAlerts.map(({ title, detail, tone }) => (
            <div key={title} className={`admin-alert-row ${tone}`}>
              <strong>{title}</strong>
              <span>{detail}</span>
            </div>
          ))}
        </div>
      </section>
    </div>

    <div className="admin-two-col">
      <section className="section-block admin-panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Activities overview</div>
            <h2>Weekly activity summary</h2>
          </div>
        </div>

        <div className="admin-activity-grid">
          {adminActivityCards.map(({ title, value, caption }) => (
            <div key={title} className="admin-activity-card">
              <span>{title}</span>
              <strong>{value}</strong>
              <small>{caption}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="section-block admin-panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">Recent system activity</div>
            <h2>Audit preview</h2>
          </div>
          <button className="text-btn" onClick={() => setPage('admin-audit')}>View Audit Log <span>→</span></button>
        </div>

        <div className="admin-audit-list">
          {adminAuditRows.map((item) => (
            <div key={item} className="admin-audit-item">
              <span className="audit-dot" />
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>
    </div>

  </>;
}


function AdminPage({ page, requests, schedule, onReviewRequest, setPage, users, onCreateUser, onCreateSchedule, onDeleteSchedule, events }) {
  if (page === 'admin-overview') return <AdminOverview requests={requests} schedule={schedule} setPage={setPage} />;
  if (page === 'admin-users') return <AdminUsersPage users={users} onCreateUser={onCreateUser} />;
  if (page === 'admin-academic') return <AdminAcademicPage />;
  if (page === 'admin-timetable') return <AdminTimetablePage schedule={schedule} users={users} onCreateSchedule={onCreateSchedule} onDeleteSchedule={onDeleteSchedule} />;
  if (page === 'admin-continuity') return <AdminContinuityPage requests={requests} schedule={schedule} onReviewRequest={onReviewRequest} />;
  if (page === 'admin-curriculum') return <AdminCurriculumPage />;
  if (page === 'admin-analytics') return <AdminAnalyticsPage />;
  if (page === 'admin-activities') return <AdminActivitiesPage />;
  if (page === 'admin-audit') return <AdminAuditPage events={events} />;
  if (page === 'admin-rules') return <AdminRulesPage />;
  if (page === 'admin-reports') return <AdminReportsPage />;
  if (page === 'admin-security') return <AdminSecurityPage />;
  return <AdminOverview />;
}

function Index() {
  const { user } = useAuth();
  const [studentPage, setStudentPage] = useState('overview');
  const [teacherPage, setTeacherPage] = useState('dashboard');
  const [adminPage, setAdminPage] = useState('admin-overview');
  const [availabilityRequests, setAvailabilityRequests] = useState([]);
  const [activityRequests, setActivityRequests] = useState([]);
  const [schedule, setSchedule] = useState([]);
  const [managedUsers, setManagedUsers] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');

  useEffect(() => {
    if (!user) {
      setAvailabilityRequests([]);
      setActivityRequests([]);
      setSchedule([]);
      setManagedUsers([]);
      setAuditEvents([]);
      setWorkspaceError('');
      return undefined;
    }
    let active = true;
    setWorkspaceLoading(true);
    Promise.all([apiRequest('/api/availability'), apiRequest('/api/schedule'), apiRequest('/api/activity-requests')])
      .then(([availability, timetable, activities]) => {
        if (!active) return;
        setAvailabilityRequests(availability.requests);
        setSchedule(timetable.items);
        setActivityRequests(activities.requests);
        setWorkspaceError('');
      })
      .catch((error) => {
        if (active) setWorkspaceError(error.message);
      })
      .finally(() => {
        if (active) setWorkspaceLoading(false);
      });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || user.role !== 'admin' || !['admin-users', 'admin-timetable'].includes(adminPage)) return undefined;
    let active = true;
    apiRequest('/api/admin/users')
      .then(({ users: directory }) => {
        if (active) setManagedUsers(directory);
      })
      .catch((error) => {
        if (active) setWorkspaceError(error.message);
      });
    return () => { active = false; };
  }, [user, adminPage]);

  useEffect(() => {
    if (!user || user.role !== 'admin' || adminPage !== 'admin-audit') return undefined;
    let active = true;
    apiRequest('/api/admin/audit')
      .then(({ events: entries }) => {
        if (active) setAuditEvents(entries);
      })
      .catch((error) => {
        if (active) setWorkspaceError(error.message);
      });
    return () => { active = false; };
  }, [user, adminPage]);

  if (!user) return import.meta.env.DEV ? <DevelopmentLoginScreen /> : <LoginScreen />;
  if (workspaceLoading) return <div className="app-loading" role="status">Loading AIRS...</div>;
  const role = user.role;
  const page = role === 'student' ? studentPage : role === 'teacher' ? teacherPage : adminPage;
  const setPage = role === 'student' ? setStudentPage : role === 'teacher' ? setTeacherPage : setAdminPage;
  const submitAvailabilityRequest = async (request) => {
    const result = await apiRequest('/api/availability', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request) });
    setAvailabilityRequests((current) => [result.request, ...current]);
    return result.request;
  };
  const submitActivityRequest = async (activity) => {
    const result = await apiRequest('/api/activity-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(activity) });
    setActivityRequests((current) => [result.request, ...current]);
    return result.request;
  };
  const reviewActivityRequest = async (requestId, decision) => {
    const result = await apiRequest(`/api/activity-requests/${requestId}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(decision) });
    setActivityRequests((current) => current.map((activity) => activity.id === requestId ? result.request : activity));
    return result.request;
  };
  const reviewAvailabilityRequest = async (requestId, decision) => {
    const result = await apiRequest(`/api/availability/${requestId}/review`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(decision) });
    setAvailabilityRequests((current) => current.map((request) => request.id === requestId ? result.request : request));
    return result.request;
  };
  const createAdminUser = async (newUser) => {
    const result = await apiRequest('/api/admin/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newUser) });
    setManagedUsers((current) => [...current, result.user]);
    return result.user;
  };
  const createAdminSchedule = async (duty) => {
    const result = await apiRequest('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(duty) });
    setSchedule((current) => [...current, result.item].sort((first, second) => `${first.date}-${first.time}`.localeCompare(`${second.date}-${second.time}`)));
    return result.item;
  };
  const deleteAdminSchedule = async (itemId) => {
    await apiRequest(`/api/schedule/${itemId}`, { method: 'DELETE' });
    setSchedule((current) => current.filter((item) => item.id !== itemId));
  };

  const activityApprovalPage = <ActivityApprovalQueue requests={activityRequests} user={user} onReview={reviewActivityRequest} />;
  const workspace = role === 'student'
    ? page === 'overview' ? <StudentHome /> : page === 'activities' ? <StudentActivityRequests requests={activityRequests} onSubmit={submitActivityRequest} /> : <ApiStudentPage page={page} />
    : role === 'teacher'
      ? ['requests', 'teacher-conflicts'].includes(page) ? activityApprovalPage : <TeacherPage page={page} setPage={setPage} user={user} requests={availabilityRequests} schedule={schedule} onSubmitRequest={submitAvailabilityRequest} />
      : adminPage === 'admin-activities' ? activityApprovalPage : <AdminPage page={adminPage} requests={availabilityRequests} schedule={schedule} onReviewRequest={reviewAvailabilityRequest} setPage={setPage} users={managedUsers} onCreateUser={createAdminUser} onCreateSchedule={createAdminSchedule} onDeleteSchedule={deleteAdminSchedule} events={auditEvents} />;
  return <RootLayout><div className="app-shell"><Sidebar role={role} page={page} setPage={setPage} /><main className="main"><Topbar role={role} /><div className="content">{workspaceError && <div className="login-error" role="alert">{workspaceError}</div>}{workspace}</div></main></div></RootLayout>;
}

createRoot(document.getElementById('root')).render(<AuthProvider><Index /></AuthProvider>);