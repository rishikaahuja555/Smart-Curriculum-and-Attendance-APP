import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const petLooks = [
  { id: 'moss', label: 'Moss guardian' },
  { id: 'flame', label: 'Little ember' },
  { id: 'puff', label: 'Night puff' },
  { id: 'mouse', label: 'Mouse explorer' }
];

function preferenceStorageKey(user) {
  return `airs-pet:${user.role}:${encodeURIComponent(user.name || user.id)}`;
}

function readPreferences(user) {
  try {
    return { name: 'Mochi', voice: 'mirror', appearance: 'mouse', ...JSON.parse(localStorage.getItem(preferenceStorageKey(user)) || '{}') };
  } catch {
    return { name: 'Mochi', voice: 'mirror', appearance: 'mouse' };
  }
}

function nextAppearance(current) {
  const currentIndex = petLooks.findIndex((look) => look.id === current);
  return petLooks[(currentIndex + 1) % petLooks.length].id;
}

function personalizeAnswer(answer, prompt, preferences) {
  const playful = preferences.voice === 'playful' || (preferences.voice === 'mirror' && /[!]{2,}|\b(lol|haha|yay|hehe)\b/i.test(prompt));
  const gentle = preferences.voice === 'gentle' || (preferences.voice === 'mirror' && /\b(please|worried|anxious|help)\b/i.test(prompt));
  if (playful) return `${answer} You have got this!`;
  if (gentle) return `${answer} We can take it one small step at a time.`;
  return answer;
}

function PetPortrait({ appearance, small = false }) {
  const look = petLooks.find((item) => item.id === appearance) || petLooks[0];
  return <svg className={`pet-portrait pet-${look.id} ${small ? 'small' : ''}`} viewBox="0 0 100 100" role="img" aria-label={look.label}>
    {look.id === 'moss' && <g>
      <path className="pet-moss-body" d="M14 70c-5-13 0-24 9-31 0-13 11-18 20-11 8-12 21-8 24 2 12-5 22 5 18 17 9 9 5 25-4 30-3 14-16 20-27 15-12 8-29 2-32-9-5-2-7-7-8-13Z" />
      <path className="pet-moss-leaf" d="M47 24c0-11 8-17 19-17-1 10-7 17-19 17Zm3 1c8-9 16-9 24-4-7 7-15 9-24 4Z" />
      <circle className="pet-moss-freckle" cx="25" cy="47" r="2" /><circle className="pet-moss-freckle" cx="76" cy="45" r="2" />
    </g>}
    {look.id === 'flame' && <g>
      <path className="pet-flame-body" d="M51 10c7 14 2 18 13 27 3-8 11-12 10-21 17 16 18 32 12 47-6 17-20 27-37 27S18 80 14 62c-4-17 5-31 18-43-2 14 2 21 8 24 7-10 9-20 11-33Z" />
      <path className="pet-flame-glow" d="M51 39c5 9 1 12 9 18 4-4 6-8 6-13 9 9 12 17 8 26-4 9-12 14-23 14S31 77 29 67c-2-8 2-15 9-22 0 8 3 12 7 13 3-5 5-11 6-19Z" />
    </g>}
    {look.id === 'puff' && <g>
      <path className="pet-puff-body" d="M27 79c-12 0-18-8-16-18 1-6 5-10 11-12-5-11 2-22 13-22 4-13 19-17 28-7 13-6 25 3 24 15 12 6 13 21 3 29-2 12-13 18-24 14-10 9-25 8-32 1-3 1-5 1-7 0Z" />
      <circle className="pet-puff-speck" cx="28" cy="37" r="2" /><circle className="pet-puff-speck" cx="73" cy="34" r="2" /><circle className="pet-puff-speck" cx="20" cy="66" r="2" /><circle className="pet-puff-speck" cx="79" cy="66" r="2" />
    </g>}
    {look.id === 'mouse' && <g>
      <path className="pet-mouse-tail" d="M67 72c15 11 29 5 27-5-1-6-8-7-11-2" />
      <circle className="pet-mouse-ear" cx="29" cy="35" r="17" /><circle className="pet-mouse-ear" cx="70" cy="35" r="17" />
      <circle className="pet-mouse-inner-ear" cx="29" cy="35" r="9" /><circle className="pet-mouse-inner-ear" cx="70" cy="35" r="9" />
      <path className="pet-mouse-body" d="M19 57c0-18 13-29 31-29s31 11 31 29v11c0 16-13 24-31 24S19 84 19 68V57Z" />
      <path className="pet-mouse-scarf" d="M22 67c16 8 40 8 56 0l-2 9c-17 7-35 7-51 0l-3-9Zm43 8 12 5-8 10-5-15Z" />
      <circle className="pet-mouse-pack" cx="80" cy="65" r="7" />
    </g>}
    <ellipse className="pet-eye" cx="38" cy="55" rx="3" ry="4" /><ellipse className="pet-eye" cx="62" cy="55" rx="3" ry="4" />
    <path className="pet-nose" d="m47 64 3 3 3-3" /><path className="pet-mouth" d="M50 67v4m0 0c-3 4-7 3-9 0m9 0c3 4 7 3 9 0" />
    <ellipse className="pet-blush" cx="29" cy="66" rx="5" ry="2.5" /><ellipse className="pet-blush" cx="71" cy="66" rx="5" ry="2.5" />
  </svg>;
}

export default function PetAssistant() {
  const { user } = useAuth();
  const storageKey = user ? preferenceStorageKey(user) : '';
  const [preferences, setPreferences] = useState(() => {
    const saved = user ? readPreferences(user) : { name: 'Mochi', voice: 'mirror', appearance: 'mouse' };
    return { ...saved, appearance: nextAppearance(saved.appearance) };
  });
  const firstName = user?.name?.split(/\s+/)[0] || 'friend';
  const [messages, setMessages] = useState(() => [{ id: 0, speaker: 'pet', text: `Hi ${firstName}! I am ${preferences.name}. What shall we figure out together?` }]);
  const [draft, setDraft] = useState('');
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const messageListRef = useRef(null);
  const nextMessageId = useRef(1);

  useEffect(() => {
    if (messageListRef.current) messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages, open]);

  useEffect(() => {
    if (!user || !storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(preferences));
    } catch {
      return;
    }
  }, [preferences, storageKey, user]);

  if (!user) return null;

  const sendMessage = async (text = draft) => {
    const prompt = text.trim();
    if (!prompt || pending) return;
    setMessages((current) => [...current, { id: nextMessageId.current++, speaker: 'user', text: prompt }].slice(-30));
    setDraft('');
    setPending(true);
    try {
      const response = await fetch('/api/assistant/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ question: prompt })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'I could not check your AIRS records.');
      const answer = personalizeAnswer(result.answer, prompt, preferences);
      setMessages((current) => [...current, { id: nextMessageId.current++, speaker: 'pet', text: answer }].slice(-30));
    } catch (error) {
      setMessages((current) => [...current, { id: nextMessageId.current++, speaker: 'pet', text: `${error.message} Please try again.` }].slice(-30));
    } finally {
      setPending(false);
    }
  };
  const quickPrompts = user.role === 'student'
    ? ['How is my attendance?', 'What should I study?', 'What is on my schedule?']
    : user.role === 'teacher'
      ? ['How many sections do I teach?', 'Who is at risk?', 'What is my DBMS attendance?']
      : ['How many active courses?', 'What is the attendance threshold?', 'How many students are at risk?'];

  return <div className="pet-dock">
    {open && <section className="pet-chat-panel" aria-label={`${preferences.name} chat`}>
      <header className="pet-chat-header">
        <div className={`pet-header-portrait pet-look-${preferences.appearance}`}><PetPortrait appearance={preferences.appearance} small /></div>
        <div className="pet-header-copy"><strong>{preferences.name}</strong><span><i /> Here with your AIRS data</span></div>
        <button type="button" className="pet-settings-button" aria-label="Customize companion" onClick={() => setSettingsOpen((current) => !current)}>⚙</button>
        <button type="button" className="pet-close-button" aria-label="Close chat" onClick={() => setOpen(false)}>×</button>
      </header>
      {settingsOpen && <div className="pet-settings">
        <label>Pet name<input maxLength="18" value={preferences.name} onChange={(event) => setPreferences((current) => ({ ...current, name: event.target.value || 'Mochi' }))} /></label>
        <div className="pet-voice-label">Voice</div>
        <div className="pet-voice-options">
          {[['mirror', 'Match me'], ['gentle', 'Gentle'], ['playful', 'Playful']].map(([value, label]) => <button type="button" className={preferences.voice === value ? 'selected' : ''} aria-pressed={preferences.voice === value} key={value} onClick={() => setPreferences((current) => ({ ...current, voice: value }))}>{label}</button>)}
        </div>
        <div className="pet-voice-label">Look</div>
        <div className="pet-look-options">
          {petLooks.map((look) => <button type="button" className={preferences.appearance === look.id ? 'selected' : ''} aria-pressed={preferences.appearance === look.id} key={look.id} onClick={() => setPreferences((current) => ({ ...current, appearance: look.id }))}>{look.label}</button>)}
        </div>
      </div>}
      <div className="pet-message-list" ref={messageListRef} aria-live="polite">
        {messages.map((message) => <div className={`pet-message ${message.speaker}`} key={message.id}>
          {message.speaker === 'pet' && <span className="pet-message-avatar"><PetPortrait appearance={preferences.appearance} small /></span>}<p>{message.text}</p>
        </div>)}
        {pending && <div className="pet-message pending"><span className="pet-message-avatar"><PetPortrait appearance={preferences.appearance} small /></span><p>Checking your AIRS records...</p></div>}
      </div>
      {messages.length === 1 && <div className="pet-prompts">{quickPrompts.map((prompt) => <button type="button" key={prompt} onClick={() => sendMessage(prompt)}>{prompt}</button>)}</div>}
      <form className="pet-composer" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
        <input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${preferences.name}...`} aria-label="Message your pet assistant" maxLength={500} disabled={pending} />
        <button type="submit" aria-label="Send message" disabled={!draft.trim() || pending}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 4 17 8-17 8 3-8-3-8Zm3 8h14" /></svg></button>
      </form>
    </section>}
    <button type="button" className={`pet-launcher ${open ? 'active' : ''}`} aria-label={open ? 'Close pet assistant' : `Chat with ${preferences.name}`} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      <span className={`pet-launcher-portrait pet-look-${preferences.appearance}`}><PetPortrait appearance={preferences.appearance} small /></span><span className="pet-launcher-label">{preferences.name}</span><span className="pet-launcher-sparkle" aria-hidden="true">*</span>
    </button>
  </div>;
}