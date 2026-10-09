import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function getData(path) {
  try {
    const response = await fetch(path, { credentials: 'same-origin' });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export default function StudyCalendar({ subjects = [] }) {
  const { user } = useAuth();
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(dateKey(today));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([getData('/api/schedule'), getData('/api/activity-requests')])
      .then(([scheduleData, activityData]) => {
        if (!active) return;
        const enrolledSections = new Set(subjects.map((subject) => `${subject.name}|${subject.section}`));
        const scheduleEvents = (scheduleData?.items || [])
          .filter((item) => user?.role !== 'student' || enrolledSections.has(`${item.subject}|${item.section}`))
          .filter((item) => user?.role !== 'teacher' || item.faculty?.toLowerCase() === user.name?.toLowerCase())
          .map((item) => ({ id: item.id, date: item.date, time: item.time, title: item.subject, kind: item.type, detail: `${item.section} · ${item.room}` }));
        const activityEvents = (activityData?.requests || []).map((request) => ({
          id: `activity-${request.id}`, date: request.date, time: request.startTime, title: request.title, kind: 'Activity', detail: `${request.status} · ${request.startTime}–${request.endTime}`
        }));
        setEvents([...scheduleEvents, ...activityEvents].filter((event) => event.date));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [subjects, user]);

  const eventsByDate = useMemo(() => events.reduce((grouped, event) => {
    grouped[event.date] = [...(grouped[event.date] || []), event];
    return grouped;
  }, {}), [events]);
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (new Date(month.getFullYear(), month.getMonth(), 1).getDay() + 6) % 7;
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
  const selectedEvents = eventsByDate[selectedDate] || [];

  const moveMonth = (delta) => {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(nextMonth);
    setSelectedDate(dateKey(nextMonth));
  };

  return <section className="section-block study-calendar" aria-label="Study calendar">
    <div className="calendar-heading">
      <div className="calendar-title-group">
        <span className="calendar-stamp" aria-hidden="true"><svg viewBox="0 0 32 32"><rect x="4" y="7" width="24" height="21" rx="4" /><path d="M10 4v6M22 4v6M4 13h24M10 18h.1M16 18h.1M22 18h.1M10 23h.1M16 23h.1" /></svg></span>
        <div><div className="eyebrow">A little planning</div><h2>Your calendar</h2></div>
      </div>
      <div className="calendar-month-control">
        <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)}>‹</button>
        <strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <button type="button" aria-label="Next month" onClick={() => moveMonth(1)}>›</button>
      </div>
    </div>
    <div className="calendar-weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
    <div className="calendar-days">
      {cells.map((day, index) => {
        if (!day) return <span className="calendar-day-empty" key={`empty-${index}`} />;
        const date = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
        const dayEvents = eventsByDate[date] || [];
        const isToday = date === dateKey(today);
        return <button type="button" className={`calendar-day ${date === selectedDate ? 'selected' : ''} ${isToday ? 'today' : ''}`} key={date}
          aria-label={`${month.toLocaleDateString(undefined, { month: 'long' })} ${day}${dayEvents.length ? `, ${dayEvents.length} events` : ''}`}
          aria-pressed={date === selectedDate} onClick={() => setSelectedDate(date)}>
          <span>{day}</span>{dayEvents.length > 0 && <i aria-hidden="true" />}
        </button>;
      })}
    </div>
    <div className="calendar-agenda">
      <div className="calendar-agenda-heading">
        <h3>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
        <span>{loading ? 'Loading' : `${selectedEvents.length} ${selectedEvents.length === 1 ? 'event' : 'events'}`}</span>
      </div>
      {selectedEvents.length ? <div className="calendar-event-list">{selectedEvents.map((event) => <article className="calendar-event" key={event.id}>
        <span className={`calendar-event-marker ${event.kind === 'Activity' ? 'activity' : ''}`} />
        <time>{event.time || 'All day'}</time><div><strong>{event.title}</strong><small>{event.detail}</small></div>
      </article>)}</div> : <p className="calendar-empty">Nothing planned here. A nice little breathing space.</p>}
    </div>
  </section>;
}