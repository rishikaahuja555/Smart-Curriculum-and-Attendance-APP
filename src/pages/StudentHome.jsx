import React, { useMemo, useState } from 'react';
import { MISSED_TOPICS, SUBJECTS, attendancePct, overallAttendance, riskFor } from '../data/mockData';
import { useAuth } from '../context/AuthContext';

function Progress({ value, tone }) {
  return <div className="student-home-progress"><span className={tone} style={{ width: `${value}%` }} /></div>;
}

function RiskTone({ risk }) {
  return risk === 'safe' ? 'green' : risk === 'critical' ? 'red' : 'amber';
}

export default function StudentHome() {
  const { user } = useAuth();
  const overall = overallAttendance();
  const risk = riskFor(overall);
  const [whatIf, setWhatIf] = useState(0);
  const totals = useMemo(() => SUBJECTS.reduce((result, subject) => ({ attended: result.attended + subject.attended, total: result.total + subject.total }), { attended: 0, total: 0 }), []);
  const safeAbsences = Math.max(0, Math.floor(totals.attended / 0.75 - totals.total));
  const projected = Math.round((totals.attended / (totals.total + whatIf)) * 100);
  const riskLabel = risk === 'safe' ? 'On track' : risk === 'caution' ? 'Watch closely' : 'At risk';
  const intelligence = useMemo(() => SUBJECTS.map((subject) => {
    const percentage = attendancePct(subject);
    const safeMisses = Math.max(0, Math.floor(subject.attended / 0.75 - subject.total));
    const forecastRate = subject.trend === 'up' ? .95 : subject.trend === 'down' ? .65 : .82;
    const predicted = Math.round(((subject.attended + forecastRate * 4) / (subject.total + 4)) * 100);
    const gaps = MISSED_TOPICS.filter((topic) => topic.subjectId === subject.id).length;
    return { ...subject, percentage, safeMisses, predicted, gaps };
  }), []);
  const gapCount = intelligence.reduce((total, subject) => total + subject.gaps, 0);
  return <>
    <div className="page-header"><div><div className="eyebrow">Student workspace</div><h1>Good morning, {user?.name?.split(' ')[0] || 'there'}.</h1><p>A clear view of your attendance and the next best academic step.</p></div></div>
    <div className="student-risk-grid">
      <section className="section-block risk-card"><div className="risk-card-head"><div><div className="eyebrow">Attendance risk</div><h2>{riskLabel}</h2></div><span className={`status ${RiskTone({ risk })}`}>{riskLabel}</span></div><div className="risk-number">{overall}% <span>overall this term</span></div><Progress value={overall} tone={RiskTone({ risk })} /><div className="risk-footer"><div><strong>{safeAbsences}</strong><span>safe skips left</span></div><div><strong>{totals.total - totals.attended}</strong><span>sessions missed</span></div><div><strong>{MISSED_TOPICS.length}</strong><span>topics to recover</span></div></div></section>
      <section className="section-block whatif-card"><div className="eyebrow">What if I skip...</div><p>Projected attendance after skipping <strong>{whatIf}</strong> more session{whatIf === 1 ? '' : 's'}</p><div className="projected-number">{projected}% <span>{projected >= 75 ? 'still safe' : 'below threshold'}</span></div><div className="stepper">{[0, 1, 2, 3, 5, 8].map((value) => <button className={whatIf === value ? 'active' : ''} key={value} onClick={() => setWhatIf(value)}>{value === 0 ? '0' : `+${value}`}</button>)}</div></section>
    </div>
    <div className="student-section-title"><div><div className="eyebrow">By subject</div><h2>Attendance at a glance</h2></div></div>
    <div className="student-subject-grid">{intelligence.map((subject) => { const subjectRisk = riskFor(subject.percentage); return <section className="section-block student-subject-card" key={subject.id}><div className="student-subject-head"><div><small>{subject.code}</small><h3>{subject.name}</h3></div><strong>{subject.percentage}%</strong></div><div className="student-subject-meta"><span className={subject.trend === 'down' ? 'down' : subject.trend === 'up' ? 'up' : ''}>{subject.trend === 'up' ? '↗' : subject.trend === 'down' ? '↘' : '→'}</span>{subject.attended}/{subject.total} attended <span className={`status ${RiskTone({ risk: subjectRisk })}`}>{subjectRisk}</span></div><Progress value={subject.percentage} tone={RiskTone({ risk: subjectRisk })} /><div className="subject-intelligence"><span>{subject.safeMisses} safe {subject.safeMisses === 1 ? 'skip' : 'skips'} left</span><span>Projected {subject.predicted}%</span></div></section>; })}</div>
    <section className="student-intelligence section-block"><div className="intelligence-head"><div><div className="eyebrow">AIRS intelligence engine</div><h2>Know the gaps before they grow</h2><p>Attendance prediction and curriculum gap detection are updating from your subject activity.</p></div><span className="engine-status"><i />Engine active</span></div><div className="intelligence-metrics"><div><strong>{gapCount}</strong><span>curriculum gaps detected</span></div><div><strong>{intelligence.filter((subject) => subject.percentage < 75).length}</strong><span>subjects below threshold</span></div><div><strong>{Math.round(intelligence.reduce((sum, subject) => sum + subject.predicted, 0) / intelligence.length)}%</strong><span>average predicted attendance</span></div></div><div className="gap-list">{intelligence.filter((subject) => subject.gaps > 0).map((subject) => <div className="gap-row" key={subject.id}><div className="gap-signal"><span className={subject.percentage < 75 ? 'critical' : 'watch'} /> <div><strong>{subject.name}</strong><small>{subject.gaps} missed topic{subject.gaps === 1 ? '' : 's'} linked to attendance</small></div></div><span className="gap-action">Review gap <b>→</b></span></div>)}</div></section>
    <section className="student-topics"><div className="section-heading"><div><div className="eyebrow">Curriculum link</div><h2>Topics you missed</h2></div><button className="text-btn">See all →</button></div>{MISSED_TOPICS.slice(0, 3).map((topic) => <div className="student-topic-row" key={topic.id}><span className="topic-dot" /><div><strong>{topic.topic}</strong><small>{topic.unit} · {new Date(topic.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</small></div><span className={`status ${topic.hasDPP ? 'green' : 'muted'}`}>{topic.hasDPP ? 'DPP ready' : `${topic.resources} resources`}</span><span>→</span></div>)}</section>
  </>;
}
