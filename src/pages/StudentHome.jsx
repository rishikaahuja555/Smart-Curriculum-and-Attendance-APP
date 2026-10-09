import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import StudyCalendar from '../components/StudyCalendar';

async function requestData(path) {
  const response = await fetch(path, { credentials: 'same-origin' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'Unable to load student data.');
  return result;
}

function Progress({ value, tone }) {
  return <div className="student-home-progress"><span className={tone} style={{ width: `${value}%` }} /></div>;
}

function riskTone(status) {
  return status === 'Safe' || status === 'On track' ? 'green' : status === 'No records' ? 'amber' : 'red';
}

export default function StudentHome() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [whatIf, setWhatIf] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    requestData('/api/student/dashboard')
      .then((data) => { if (active) setDashboard(data); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (loading) return <div className="app-loading" role="status">Loading student dashboard...</div>;
  if (error) return <div className="login-error" role="alert">{error}</div>;

  const attendance = dashboard.attendance;
  const subjects = dashboard.subjects;
  const missedTopics = dashboard.missedTopics;
  const projected = attendance.held + whatIf
    ? Math.round((attendance.attended / (attendance.held + whatIf)) * 100)
    : 0;
  const status = attendance.status;
  const averagePrediction = dashboard.intelligence.predictedAttendance;

  return <>
    <div className="page-header"><div><div className="eyebrow">Student workspace</div><h1>Welcome, {dashboard.profile.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'student'}.</h1><p>{dashboard.profile.department || 'Academic workspace'} · Attendance, learning gaps, and recovery from your records.</p></div></div>
    <div className="student-risk-grid">
      <section className="section-block risk-card"><div className="risk-card-head"><div><div className="eyebrow">Attendance risk</div><h2>{status}</h2></div><span className={`status ${riskTone(status)}`}>{status}</span></div><div className="risk-number">{attendance.percent}% <span>overall from recorded sessions</span></div><Progress value={attendance.percent} tone={riskTone(status)} /><div className="risk-footer"><div><strong>{attendance.safeAbsences}</strong><span>safe absences left</span></div><div><strong>{attendance.missedSessions}</strong><span>sessions missed</span></div><div><strong>{dashboard.intelligence.gaps}</strong><span>topics to recover</span></div></div></section>
      <section className="section-block whatif-card"><div className="eyebrow">What if I skip...</div><p>Projected attendance after skipping <strong>{whatIf}</strong> more session{whatIf === 1 ? '' : 's'}</p><div className="projected-number">{projected}% <span>{projected >= dashboard.requiredFraction * 100 ? 'still safe' : 'below threshold'}</span></div><div className="stepper">{[0, 1, 2, 3, 5, 8].map((value) => <button className={whatIf === value ? 'active' : ''} key={value} onClick={() => setWhatIf(value)}>{value === 0 ? '0' : `+${value}`}</button>)}</div><p>Required attendance: {Math.round(dashboard.requiredFraction * 100)}%</p></section>
    </div>
    <div className="student-section-title"><div><div className="eyebrow">By subject</div><h2>Attendance at a glance</h2></div></div>
    {subjects.length ? <div className="student-subject-grid">{subjects.map((subject) => <section className="section-block student-subject-card" key={`${subject.id}-${subject.sectionId}`}><div className="student-subject-head"><div><small>{subject.code} · {subject.section}</small><h3>{subject.name}</h3></div><strong>{subject.percent}%</strong></div><div className="student-subject-meta"><span className={subject.trend === 'down' ? 'down' : subject.trend === 'up' ? 'up' : ''}>{subject.trend === 'up' ? '↗' : subject.trend === 'down' ? '↘' : '→'}</span>{subject.attended}/{subject.total} attended <span className={`status ${riskTone(subject.status)}`}>{subject.status}</span></div><Progress value={subject.percent} tone={riskTone(subject.status)} /><div className="subject-intelligence"><span>{subject.safeAbsences} safe {subject.safeAbsences === 1 ? 'absence' : 'absences'} left</span><span>Projected {subject.predicted}%</span></div></section>)}</div> : <section className="section-block"><h2>No enrolled courses yet</h2><p>Your attendance summary will appear when courses are assigned to your account.</p></section>}
    <section className="student-intelligence section-block"><div className="intelligence-head"><div><div className="eyebrow">AIRS intelligence engine</div><h2>Know the gaps before they grow</h2><p>Predictions use your recorded attendance and syllabus progress.</p></div><span className="engine-status"><i />Existing model</span></div><div className="intelligence-metrics"><div><strong>{dashboard.intelligence.gaps}</strong><span>topics to recover</span></div><div><strong>{dashboard.intelligence.atRiskSubjects}</strong><span>subjects below threshold</span></div><div><strong>{averagePrediction}%</strong><span>average attendance forecast</span></div></div>{subjects.some((subject) => subject.missedTopicsCount > 0) ? <div className="gap-list">{subjects.filter((subject) => subject.missedTopicsCount > 0).map((subject) => <div className="gap-row" key={`${subject.id}-${subject.sectionId}`}><div className="gap-signal"><span className={subject.status === 'At risk' ? 'critical' : 'watch'} /><div><strong>{subject.name}</strong><small>{subject.missedTopicsCount} missed topics · {subject.confidence}% model confidence</small></div></div></div>)}</div> : <p className="availability-empty">No learning gaps recorded yet.</p>}</section>
    <section className="student-topics"><div className="section-heading"><div><div className="eyebrow">Curriculum link</div><h2>Topics you missed</h2></div></div>{missedTopics.length ? missedTopics.map((topic) => <div className="student-topic-row" key={topic.id}><span className="topic-dot" /><div><strong>{topic.topic}</strong><small>{topic.subject} · {topic.unit} · {new Date(`${topic.date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</small></div><span className="status amber">{topic.recoveryStatus || 'Not started'}</span></div>) : <p className="availability-empty">No missed topics yet.</p>}</section>
    <StudyCalendar subjects={subjects} />
  </>;
}