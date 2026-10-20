// ============================================================
// VoxControl - screens, navigation and the voice dialog.
// ============================================================
import { api, ApiError } from './api.js';
import { interpret, findContact, parseYesNo, isCancel, splitReminder, normalize, parseSpokenPhone, parseNameAndPhone } from './commands.js';
import { createVoice, recognitionSupported } from './voice.js';
import { esc, icon, toast, modal, confirmDialog, formatWhen, formatClock } from './ui.js';

const $ = (sel, root = document) => root.querySelector(sel);
const screenEl = $('#screen');

// ---------------- state ----------------
const state = {
  contacts: [],
  route: { name: 'home', params: {} },
  stack: [],
  thread: [],          // messages of the open chat (used by "delete message ...")
  dialog: null,        // pending voice question, see handleDialog()
  cleanup: null,       // function to run when leaving the current screen
};

const contactNames = () => state.contacts.map((c) => c.name);
const errMsg = (e) => (e instanceof ApiError ? e.message : 'Something went wrong.');
const hue = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 7);
const avatar = (c, size = '') =>
  `<span class="avatar ${size}" style="--h:${hue(c.name)}" aria-hidden="true">${esc(c.avatar || '👤')}</span>`;

async function loadContacts() {
  try { state.contacts = await api.contacts.list(); } catch (e) { toast(errMsg(e), 'error'); }
}

// ---------------- voice engine ----------------
const voiceBar = $('#voiceBar');
const voiceLabel = $('#voiceLabel');
const voiceText = $('#voiceText');
const micFab = $('#micFab');

const voice = createVoice({
  onState(s) {
    document.body.dataset.voice = s;
    micFab.setAttribute('aria-pressed', String(s !== 'off'));
    micFab.setAttribute('aria-label', s === 'off' ? 'Turn on voice control' : 'Turn off voice control');
    voiceBar.hidden = s === 'off';
    voiceLabel.textContent = { listening: 'Listening', thinking: 'Working on it', speaking: 'Speaking', off: '' }[s];
    if (s === 'listening') voiceText.textContent = state.dialog ? state.dialog.hint : 'Say a command, e.g. “open reminders”';
    refreshHomeVoice();
  },
  onInterim(t) { voiceText.textContent = `“${t}”`; },
  onFinal: (text) => processUtterance(text),
  onError(msg) { toast(msg, 'error'); },
});

try { voice.setMuted(localStorage.getItem('vox.muted') === '1'); } catch { /* storage unavailable */ }

function refreshHomeVoice() {
  const el = $('#orbStatus');
  if (!el) return;
  const s = document.body.dataset.voice || 'off';
  el.textContent = s === 'off'
    ? (recognitionSupported ? 'Tap the mic to start voice control' : 'Voice input needs Chrome or Edge - you can still type commands')
    : voiceText.textContent;
}

/** Show + speak a reply. */
async function reply(text) {
  voiceText.textContent = text;
  if (!voice.isOn()) toast(text);
  refreshHomeVoice();
  await voice.speak(text);
}

// ---------------- navigation ----------------
function go(name, params = {}, { replace = false } = {}) {
  state.cleanup?.();
  state.cleanup = null;
  if (!replace) state.stack.push(state.route);
  state.route = { name, params };
  render();
}
function back() {
  state.cleanup?.();
  state.cleanup = null;
  state.route = state.stack.pop() || { name: 'home', params: {} };
  render();
}
function home() {
  state.cleanup?.();
  state.cleanup = null;
  state.stack = [];
  state.route = { name: 'home', params: {} };
  render();
}

const screens = {};
async function render() {
  const { name, params } = state.route;
  document.body.dataset.screen = name;
  screenEl.scrollTop = 0;
  await screens[name](params);
  screenEl.focus({ preventScroll: true });
}

const head = (title, { backBtn = true, right = '' } = {}) => `
  <header class="page-head">
    ${backBtn ? `<button class="icon-btn" data-action="back" aria-label="Back">${icon('back')}</button>` : ''}
    <h1>${esc(title)}</h1>
    <div class="head-right">${right}</div>
  </header>`;

const loading = (text = 'Loading…') => `<div class="empty"><div class="spinner"></div><p>${text}</p></div>`;
const failure = (e) => `<div class="empty">${icon('alert', 'big')}<h3>Couldn’t load this</h3><p>${esc(errMsg(e))}</p>
  <button class="btn" data-action="retry">Try again</button></div>`;

// ---------------- HOME ----------------
screens.home = async () => {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const suggestions = ['Open messages', 'Call ' + (contactNames()[0] || 'Rahul'), 'Remind me to drink water at 5 pm', 'What can I say?'];
  screenEl.innerHTML = `
    <header class="home-head">
      <p class="eyebrow">${greeting}</p>
      <h1>VoxControl</h1>
    </header>

    <section class="orb-card">
      <button class="orb" data-action="mic" aria-label="Toggle voice control">${icon('mic', 'orb-icon')}<span class="ring"></span><span class="ring r2"></span></button>
      <div class="orb-copy">
        <h2>Hands-free mode</h2>
        <p id="orbStatus" aria-live="polite"></p>
      </div>
      <form class="typebar" data-form="type" autocomplete="off">
        <input id="typeInput" type="text" placeholder="Or type a command…" aria-label="Type a command" enterkeyhint="send">
        <button class="icon-btn solid" aria-label="Run command">${icon('send')}</button>
      </form>
    </section>

    <nav class="tiles" aria-label="Apps">
      <button class="tile t-msg" data-go="messages">${icon('message')}<span>Messages</span></button>
      <button class="tile t-con" data-go="contacts">${icon('users')}<span>Contacts</span></button>
      <button class="tile t-rem" data-go="reminders">${icon('bell')}<span>Reminders</span><em id="remBadge" hidden></em></button>
      <button class="tile t-sos" data-go="emergency">${icon('alert')}<span>Emergency</span></button>
    </nav>

    <section class="try">
      <h3>Try saying</h3>
      <div class="chips">${suggestions.map((s) => `<button class="chip" data-say="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    </section>`;
  refreshHomeVoice();
  try {
    const open = (await api.reminders.list()).filter((r) => !r.completed).length;
    const b = $('#remBadge');
    if (b && open) { b.textContent = open; b.hidden = false; }
  } catch { /* badge is optional */ }
};

// ---------------- MESSAGES ----------------
screens.messages = async () => {
  screenEl.innerHTML = head('Messages') + loading();
  try {
    const inbox = await api.messages.inbox();
    screenEl.innerHTML = head('Messages') + (inbox.length ? `<ul class="list">${inbox.map((c) => `
      <li><button class="row" data-chat="${esc(c.contactName)}">
        ${avatar({ name: c.contactName, avatar: c.avatar })}
        <span class="row-body"><h3>${esc(c.contactName)}</h3>
          <p>${c.lastMessage ? (c.lastMessageSent ? 'You: ' : '') + esc(c.lastMessage) : '<i>No messages yet</i>'}</p></span>
        <span class="row-meta">${formatWhen(c.lastMessageAt)}</span>
      </button></li>`).join('')}</ul>`
      : `<div class="empty">${icon('message', 'big')}<h3>No conversations</h3><p>Add a contact to start chatting.</p></div>`);
  } catch (e) { screenEl.innerHTML = head('Messages') + failure(e); }
};

screens.chat = async ({ name }) => {
  const contact = state.contacts.find((c) => c.name === name) || { name };
  screenEl.innerHTML = `
    ${head(name, { right: `<button class="icon-btn" data-action="call" data-name="${esc(name)}" aria-label="Call ${esc(name)}">${icon('phone')}</button>` })}
    <div id="thread" class="thread" aria-live="polite">${loading()}</div>
    <form class="composer" data-form="compose" data-name="${esc(name)}" autocomplete="off">
      <button type="button" class="icon-btn" data-action="dictate" data-target="msgInput" aria-label="Dictate message">${icon('mic')}</button>
      <input id="msgInput" type="text" maxlength="1000" placeholder="Message ${esc(contact.name)}…" aria-label="Message">
      <button class="icon-btn solid" aria-label="Send">${icon('send')}</button>
    </form>`;
  await refreshThread(name);
};

async function refreshThread(name) {
  const box = $('#thread');
  if (!box) return;
  try {
    state.thread = await api.messages.thread(name);
    box.innerHTML = state.thread.length
      ? state.thread.map((m) => `
        <div class="bubble-row ${m.sent ? 'me' : 'them'}">
          <div class="bubble">${esc(m.messageText)}<time>${formatWhen(m.createdAt)}</time></div>
          <button class="icon-btn tiny" data-action="msg-delete" data-id="${m.id}" aria-label="Delete message">${icon('trash')}</button>
        </div>`).join('')
      : `<div class="empty">${icon('message', 'big')}<p>No messages yet. Say hello!</p></div>`;
    box.scrollTop = box.scrollHeight;
  } catch (e) { box.innerHTML = failure(e); }
}

async function sendMessage(name, text) {
  text = text.trim();
  if (!text) return false;
  try {
    await api.messages.send(name, text);
    if (state.route.name === 'chat' && state.route.params.name === name) await refreshThread(name);
    return true;
  } catch (e) { toast(errMsg(e), 'error'); return false; }
}

// ---------------- CONTACTS ----------------
screens.contacts = async () => {
  await loadContacts();
  const add = `<button class="icon-btn solid" data-action="contact-add" aria-label="Add contact">${icon('plus')}</button>`;
  screenEl.innerHTML = head('Contacts', { right: add }) + (state.contacts.length ? `<ul class="list">${state.contacts.map((c) => `
    <li><button class="row" data-contact="${c.id}">
      ${avatar(c, 'lg')}
      <span class="row-body"><h3>${esc(c.name)}</h3><p>${esc(c.phone)}</p></span>
    </button></li>`).join('')}</ul>`
    : `<div class="empty">${icon('users', 'big')}<h3>No contacts</h3><button class="btn primary" data-action="contact-add">Add contact</button></div>`);
};

screens.contact = async ({ id }) => {
  const c = state.contacts.find((x) => x.id === Number(id));
  if (!c) return back();
  screenEl.innerHTML = `
    ${head('Contact', { right: `<button class="icon-btn" data-action="contact-edit" data-id="${c.id}" aria-label="Edit contact">${icon('edit')}</button>` })}
    <section class="profile">
      ${avatar(c, 'xl')}
      <h2>${esc(c.name)}</h2>
      <p class="muted">${esc(c.phone)}</p>
      <div class="profile-actions">
        <button class="action" data-chat="${esc(c.name)}">${icon('message')}<span>Message</span></button>
        <button class="action ok" data-action="call" data-name="${esc(c.name)}">${icon('phone')}<span>Call</span></button>
        <button class="action danger" data-action="contact-delete" data-id="${c.id}">${icon('trash')}<span>Delete</span></button>
      </div>
    </section>`;
};

async function contactForm(existing) {
  const result = await modal({
    title: existing ? 'Edit contact' : 'New contact',
    body: `
      <label class="field"><span>Name</span><input id="cName" maxlength="60" value="${esc(existing?.name)}" placeholder="e.g. Asha"></label>
      <label class="field"><span>Phone</span><input id="cPhone" inputmode="tel" maxlength="20" value="${esc(existing?.phone)}" placeholder="e.g. 98765 43210"></label>
      <label class="field"><span>Avatar emoji</span><input id="cAvatar" maxlength="8" value="${esc(existing?.avatar || '')}" placeholder="👤"></label>`,
    actions: [{ label: 'Cancel', value: null, kind: 'ghost' }, { label: 'Save', value: 'submit', kind: 'primary' }],
    getValue: (s) => ({ name: $('#cName', s).value.trim(), phone: $('#cPhone', s).value.trim(), avatar: $('#cAvatar', s).value.trim() }),
  });
  if (!result) return null;
  try {
    const saved = existing ? await api.contacts.update(existing.id, result) : await api.contacts.create(result);
    await loadContacts();
    toast(existing ? 'Contact updated' : 'Contact added', 'ok');
    return saved;
  } catch (e) { toast(errMsg(e), 'error'); return null; }
}

// ---------------- CALL (simulated) ----------------
screens.call = async ({ name }) => {
  const c = state.contacts.find((x) => x.name === name) || { name };
  screenEl.innerHTML = `
    <section class="call">
      ${avatar(c, 'xxl')}
      <h1>${esc(name)}</h1>
      <p id="callStatus" class="call-status">Calling…</p>
      <p class="muted small">Demo call - no real phone call is placed.</p>
      <button class="hangup" data-action="end-call" aria-label="End call">${icon('phone-off')}</button>
    </section>`;
  let seconds = 0;
  let timer;
  const connect = setTimeout(() => {
    timer = setInterval(() => {
      seconds += 1;
      const el = $('#callStatus');
      if (el) el.textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    }, 1000);
    const el = $('#callStatus');
    if (el) el.textContent = '0:00';
  }, 2000);
  state.cleanup = () => { clearTimeout(connect); clearInterval(timer); };
};

// ---------------- REMINDERS ----------------
screens.reminders = async () => {
  const add = `<button class="icon-btn solid" data-action="rem-add" aria-label="Add reminder">${icon('plus')}</button>`;
  screenEl.innerHTML = head('Reminders', { right: add }) + loading();
  try {
    const items = await api.reminders.list();
    screenEl.innerHTML = head('Reminders', { right: add }) + (items.length ? `<ul class="list">${items.map((r) => `
      <li class="reminder ${r.completed ? 'done' : ''}">
        <button class="check" data-action="rem-toggle" data-id="${r.id}" data-done="${r.completed}"
          aria-label="${r.completed ? 'Mark not done' : 'Mark done'}" aria-pressed="${r.completed}">${icon('check')}</button>
        <div class="row-body"><h3>${esc(r.title)}</h3>${r.reminderTime ? `<p>${icon('clock', 'inline')} ${esc(r.reminderTime)}</p>` : ''}</div>
        <button class="icon-btn tiny" data-action="rem-delete" data-id="${r.id}" aria-label="Delete reminder">${icon('trash')}</button>
      </li>`).join('')}</ul>`
      : `<div class="empty">${icon('bell', 'big')}<h3>No reminders</h3><p>Say “remind me to take medicine at 8 pm”.</p>
         <button class="btn primary" data-action="rem-add">Add reminder</button></div>`);
  } catch (e) { screenEl.innerHTML = head('Reminders', { right: add }) + failure(e); }
};

async function reminderForm(prefill = {}) {
  const result = await modal({
    title: 'New reminder',
    body: `
      <label class="field"><span>What?</span>
        <div class="with-mic"><input id="rTitle" maxlength="120" value="${esc(prefill.title)}" placeholder="e.g. Take medicine">
        <button type="button" class="icon-btn" data-action="dictate" data-target="rTitle" aria-label="Dictate title">${icon('mic')}</button></div></label>
      <label class="field"><span>When?</span>
        <div class="with-mic"><input id="rTime" maxlength="60" value="${esc(prefill.time)}" placeholder="e.g. 8 pm, tomorrow morning">
        <button type="button" class="icon-btn" data-action="dictate" data-target="rTime" aria-label="Dictate time">${icon('mic')}</button></div></label>`,
    actions: [{ label: 'Cancel', value: null, kind: 'ghost' }, { label: 'Add', value: 'submit', kind: 'primary' }],
    getValue: (s) => ({ title: $('#rTitle', s).value.trim(), time: $('#rTime', s).value.trim() }),
  });
  if (!result) return false;
  if (!result.title) { toast('A reminder needs a title', 'error'); return false; }
  const ok = await createReminder(result.title, result.time);
  if (ok) toast('Reminder added', 'ok');
  return ok;
}

async function createReminder(title, time) {
  try {
    await api.reminders.create(title, time);
    if (state.route.name === 'reminders') await render();
    return true;
  } catch (e) { toast(errMsg(e), 'error'); return false; }
}

async function findReminder(title) {
  const t = normalize(title);
  const items = await api.reminders.list();
  return items.find((r) => normalize(r.title) === t) || items.find((r) => normalize(r.title).includes(t) || t.includes(normalize(r.title)));
}

// ---------------- EMERGENCY ----------------
const KIND_LABEL = { FAMILY: 'Family', TRUSTED_CONTACT: 'Trusted contact' };

screens.emergency = async () => {
  screenEl.innerHTML = `
    ${head('Emergency')}
    <section class="sos">
      <p class="muted">Choose who to alert. You get 5 seconds to cancel before anything is sent.</p>
      <button class="sos-btn" data-action="emergency" data-kind="FAMILY">${icon('users')}<span>Alert family</span></button>
      <button class="sos-btn alt" data-action="emergency" data-kind="TRUSTED_CONTACT">${icon('shield')}<span>Alert trusted contact</span></button>
      <h3 class="section">Recent alerts</h3>
      <ul class="list" id="alertLog"><li class="muted small">Loading…</li></ul>
    </section>`;
  try {
    const alerts = await api.emergency.recent();
    $('#alertLog').innerHTML = alerts.length
      ? alerts.slice(0, 5).map((a) => `<li class="log"><b>${esc(KIND_LABEL[a.type] || a.type)}</b><span>${formatWhen(a.createdAt)}</span></li>`).join('')
      : '<li class="muted small">No alerts sent.</li>';
  } catch { const l = $('#alertLog'); if (l) l.innerHTML = '<li class="muted small">History unavailable.</li>'; }
};

/** 5-second cancellable countdown, then log the alert on the server. Resolves true if sent. */
async function raiseEmergency(kind) {
  let interval;
  const choice = await modal({
    title: `Alerting ${KIND_LABEL[kind].toLowerCase()}`,
    body: `<div class="countdown" id="cd" role="timer" aria-live="assertive">5</div><p class="muted center">Sending automatically. Say “cancel” or tap Cancel to stop.</p>`,
    actions: [{ label: 'Cancel', value: 'cancel', kind: 'ghost' }, { label: 'Send now', value: 'send', kind: 'danger' }],
    onOpen(sheet) {
      state.emergencyCancel = () => sheet.querySelector('[data-i="0"]')?.click();
      let n = 5;
      interval = setInterval(() => {
        n -= 1;
        const el = $('#cd', sheet);
        if (el) el.textContent = n;
        if (n <= 0) { clearInterval(interval); sheet.querySelector('[data-i="1"]')?.click(); }
      }, 1000);
    },
  });
  clearInterval(interval);
  state.emergencyCancel = null;
  if (choice !== 'send') { toast('Emergency alert cancelled'); return false; }
  try {
    await api.emergency.raise(kind, 'Raised from VoxControl');
    screenEl.innerHTML = `
      <section class="sos-done">
        <div class="big-check">${icon('check')}</div>
        <h1>Alert sent</h1>
        <p>${esc(KIND_LABEL[kind])} has been notified.</p>
        <button class="btn primary" data-action="home">Return home</button>
      </section>`;
    state.route = { name: 'emergency', params: {} };
    return true;
  } catch (e) { toast(errMsg(e), 'error'); return false; }
}

// ---------------- HELP ----------------
const HELP = [
  ['Go places', ['“Open messages”', '“Open contacts”', '“Open reminders”', '“Go home”', '“Go back”']],
  ['People', ['“Call Mom”', '“Open Priya’s contact”', '“Open Rahul chat”', '“Send message to Rahul”', '“Tell Dad I’m on my way”', '“Add contact”', '“Add Asha to my contacts”']],
  ['Reminders', ['“Remind me to take medicine at 8 pm”', '“Complete take medicine”', '“Delete reminder buy milk”']],
  ['Safety & control', ['“Emergency”', '“Alert family”', '“End call”', '“Stop listening”']],
];
const showHelp = () =>
  modal({
    title: 'What can I say?',
    body: HELP.map(([t, items]) => `<h3 class="section">${t}</h3><ul class="help">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join(''),
    actions: [{ label: 'Got it', value: true, kind: 'primary' }],
  });

// ============================================================
// Voice dialog: one pending question at a time
// ============================================================
function ask(question, hint, onAnswer) {
  state.dialog = { hint, onAnswer };
  return question;
}

async function handleDialog(text) {
  const d = state.dialog;
  state.dialog = null;
  if (/^(cancel|stop|never ?mind|forget it)$/.test(normalize(text))) return 'Okay, cancelled.';
  return d.onAnswer(text);
}

function confirm(question, onYes, cancelMsg = 'Okay, cancelled.') {
  return ask(question, 'Say “yes” or “no”', async (text) => {
    const yn = parseYesNo(text);
    if (yn === 'yes') return onYes();
    if (yn === 'no') return cancelMsg;
    return confirm('Sorry, please say yes or no. ' + question, onYes, cancelMsg);
  });
}

function startCompose(contact, text) {
  go('chat', { name: contact }, { replace: state.route.name === 'chat' });
  if (text) return confirmSend(contact, text);
  return ask(`What should I say to ${contact}?`, `Dictating to ${contact}…`, async (spoken) => confirmSend(contact, spoken));
}
const confirmSend = (contact, text) =>
  confirm(`Send to ${contact}: ${text}. Yes or no?`, async () => ((await sendMessage(contact, text)) ? 'Message sent.' : 'I could not send that message.'));

function startReminder(title, time) {
  if (!title) return ask('What should I remind you about?', 'Say what to be reminded about', async (t) => {
    const s = splitReminder(t);
    return startReminder(s.title, s.time);
  });
  if (!time) return ask('What time?', 'Say a time, e.g. “8 pm”', async (t) => {
    const ok = await createReminder(title, t);
    if (ok) go('reminders', {}, { replace: state.route.name === 'reminders' });
    return ok ? `Reminder set: ${title}, ${t}.` : 'I could not save that reminder.';
  });
  return createReminder(title, time).then((ok) => {
    if (ok) go('reminders', {}, { replace: state.route.name === 'reminders' });
    return ok ? `Reminder set: ${title}, ${time}.` : 'I could not save that reminder.';
  });
}

function startAddContact(name, phone, retried = false) {
  if (!name) return ask('What is the new contact’s name?', 'Say a name', async (t) => {
    const parsed = parseNameAndPhone(t);
    return parsed.name ? startAddContact(parsed.name, parsed.phone) : 'I did not catch a name. Cancelled.';
  });
  if (contactNames().some((n) => n.toLowerCase() === name.toLowerCase()))
    return `You already have a contact named ${name}.`;
  if (!phone) return ask(`What is ${name}’s phone number?`, 'Say the digits, e.g. “9 8 7 6 5 4 3 2 1 0”', async (t) => {
    const p = parseSpokenPhone(t);
    if (p) return startAddContact(name, p);
    if (retried) return 'I could not get a valid number. Cancelled.';
    return 'Sorry, I did not catch that. ' + startAddContact(name, '', true);
  });
  const spoken = phone.replace(/\D/g, '').split('').join(' ');
  return confirm(`Add ${name}, number ${spoken}. Yes or no?`, async () => {
    try {
      await api.contacts.create({ name, phone, avatar: '' });
      await loadContacts();
      if (state.route.name === 'contacts') await render();
      return `${name} added to your contacts.`;
    } catch (e) { return `I could not add that contact. ${errMsg(e)}`; }
  });
}

function startCall(contact) {
  if (!contact) return ask('Who should I call?', 'Say a name', async (t) => {
    const c = findContact(t, contactNames());
    return c ? (go('call', { name: c }), `Calling ${c}.`) : 'I could not find that contact.';
  });
  go('call', { name: contact });
  return `Calling ${contact}.`;
}

function startEmergency(kind) {
  if (!kind) return ask('Family or trusted contact?', 'Say “family” or “trusted contact”', async (t) => {
    const k = /\bfamily\b/.test(normalize(t)) ? 'FAMILY' : /\btrusted\b/.test(normalize(t)) ? 'TRUSTED_CONTACT' : null;
    return k ? startEmergency(k) : 'I did not catch that. Emergency cancelled.';
  });
  go('emergency', {}, { replace: state.route.name === 'emergency' });
  return confirm(`Alert ${KIND_LABEL[kind].toLowerCase()} now? Say yes to confirm.`, async () => {
    const sent = await raiseEmergency(kind);
    return sent ? `${KIND_LABEL[kind]} has been alerted.` : 'Emergency alert cancelled.';
  }, 'Emergency cancelled.');
}

/** Execute an intent; returns the sentence to speak. */
async function runIntent(intent) {
  switch (intent.type) {
    case 'openMessages': go('messages'); return 'Opening messages.';
    case 'openContacts': go('contacts'); return 'Opening contacts.';
    case 'openReminders': go('reminders'); return 'Opening reminders.';
    case 'home': home(); return 'Going home.';
    case 'back': back(); return 'Going back.';
    case 'help': showHelp(); return 'Here is what you can say.';
    case 'stopListening': state.stopAfterReply = true; return 'Voice control off.';
    case 'openChat': go('chat', { name: intent.contact }); return `Opening ${intent.contact}’s messages.`;
    case 'openContact': {
      const c = state.contacts.find((x) => x.name === intent.contact);
      go('contact', { id: c.id });
      return `Opening ${c.name}’s contact.`;
    }
    case 'addContact': return startAddContact(intent.name, intent.phone);
    case 'call': return startCall(intent.contact);
    case 'endCall':
      if (state.route.name !== 'call') return 'There is no active call.';
      back(); return 'Call ended.';
    case 'composeMessage':
      if (!intent.contact) return ask('Who should I message?', 'Say a name', async (t) => {
        const c = findContact(t, contactNames());
        return c ? startCompose(c, '') : 'I could not find that contact.';
      });
      return startCompose(intent.contact, intent.text);
    case 'deleteMessage':
    case 'deleteLastMessage': {
      if (state.route.name !== 'chat') return 'Open a conversation first.';
      const t = normalize(intent.text || '');
      const target = intent.type === 'deleteLastMessage'
        ? state.thread.at(-1)
        : [...state.thread].reverse().find((m) => normalize(m.messageText).includes(t));
      if (!target) return 'I could not find that message.';
      return confirm(`Delete the message “${target.messageText}”?`, async () => {
        try { await api.messages.remove(target.id); await refreshThread(state.route.params.name); return 'Message deleted.'; }
        catch (e) { return 'I could not delete that message.'; }
      });
    }
    case 'addReminder': return startReminder(intent.title, intent.time);
    case 'completeReminder':
    case 'deleteReminder': {
      if (!intent.title) return 'Which reminder?';
      const r = await findReminder(intent.title);
      if (!r) return 'I could not find that reminder.';
      if (intent.type === 'completeReminder') {
        await api.reminders.setCompleted(r.id, true);
        if (state.route.name === 'reminders') await render();
        return `Marked ${r.title} as done.`;
      }
      return confirm(`Delete the reminder ${r.title}?`, async () => {
        await api.reminders.remove(r.id);
        if (state.route.name === 'reminders') await render();
        return 'Reminder deleted.';
      });
    }
    case 'emergency': return startEmergency(intent.kind);
    default: return 'Sorry, I did not understand. Say “what can I say” for examples.';
  }
}

/** Entry point for every utterance, spoken or typed. */
async function processUtterance(text) {
  voiceText.textContent = `“${text}”`;
  if (state.emergencyCancel && isCancel(text)) { state.emergencyCancel(); return; }
  let response;
  try {
    response = state.dialog ? await handleDialog(text) : await runIntent(interpret(text, { contacts: contactNames() }));
  } catch (e) {
    console.error(e);
    state.dialog = null;
    response = 'Sorry, something went wrong.';
  }
  if (response) await reply(response);
  if (state.stopAfterReply) { state.stopAfterReply = false; voice.stop(); }
}

// ============================================================
// Events (delegated, so re-rendering never loses handlers)
// ============================================================
const actions = {
  back, home,
  mic() {
    if (!voice.isOn() && !recognitionSupported) { toast('Voice input needs Chrome or Edge. You can still type commands on the home screen.', 'error'); go('home', {}, { replace: true }); return; }
    voice.toggle();
  },
  help: showHelp,
  retry: () => render(),
  call: (el) => go('call', { name: el.dataset.name }),
  'end-call': back,
  'contact-add': async () => { await contactForm(); if (state.route.name === 'contacts') render(); },
  async 'contact-edit'(el) {
    const c = state.contacts.find((x) => x.id === Number(el.dataset.id));
    if (await contactForm(c)) render();
  },
  async 'contact-delete'(el) {
    const c = state.contacts.find((x) => x.id === Number(el.dataset.id));
    if (!(await confirmDialog(`Delete ${c.name}?`, 'Their messages will be deleted too.'))) return;
    try { await api.contacts.remove(c.id); await loadContacts(); toast('Contact deleted'); state.stack = state.stack.filter((r) => r.name !== 'contact'); go('contacts', {}, { replace: true }); }
    catch (e) { toast(errMsg(e), 'error'); }
  },
  async 'msg-delete'(el) {
    if (!(await confirmDialog('Delete this message?', 'This cannot be undone.'))) return;
    try { await api.messages.remove(el.dataset.id); await refreshThread(state.route.params.name); }
    catch (e) { toast(errMsg(e), 'error'); }
  },
  'rem-add': async () => { await reminderForm(); },
  async 'rem-toggle'(el) {
    try { await api.reminders.setCompleted(el.dataset.id, el.dataset.done !== 'true'); await render(); }
    catch (e) { toast(errMsg(e), 'error'); }
  },
  async 'rem-delete'(el) {
    if (!(await confirmDialog('Delete this reminder?', 'This cannot be undone.'))) return;
    try { await api.reminders.remove(el.dataset.id); await render(); } catch (e) { toast(errMsg(e), 'error'); }
  },
  emergency: (el) => raiseEmergency(el.dataset.kind),
  async dictate(el) {
    const input = document.getElementById(el.dataset.target);
    if (!input) return;
    if (!recognitionSupported) { toast('Dictation needs Chrome or Edge.', 'error'); return; }
    el.classList.add('rec');
    try { const t = await voice.listenOnce((p) => { input.value = p; }); if (t) input.value = t; }
    catch (e) { toast(e.message, 'error'); }
    finally { el.classList.remove('rec'); input.focus(); }
  },
  async mute() {
    voice.setMuted(!voice.isMuted());
    try { localStorage.setItem('vox.muted', voice.isMuted() ? '1' : '0'); } catch { /* ignore */ }
    syncMuteButton();
    toast(voice.isMuted() ? 'Spoken replies off' : 'Spoken replies on');
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-action],[data-go],[data-chat],[data-contact],[data-say]');
  if (!el || el.closest('.sheet') && !el.dataset.action) return;
  const { action, go: dest, chat, contact, say } = el.dataset;
  if (action) actions[action]?.(el);
  else if (dest) go(dest);
  else if (chat) go('chat', { name: chat });
  else if (contact) go('contact', { id: contact });
  else if (say) processUtterance(say);
});

document.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  if (form.dataset.form === 'compose') {
    const input = $('#msgInput');
    if (await sendMessage(form.dataset.name, input.value)) input.value = '';
    input.focus();
  } else if (form.dataset.form === 'type') {
    const input = $('#typeInput');
    const text = input.value.trim();
    input.value = '';
    if (text) processUtterance(text);
  }
});

// dock / header buttons
$('#dockHome').addEventListener('click', home);
$('#dockHelp').addEventListener('click', showHelp);
micFab.addEventListener('click', () => actions.mic());
const muteBtn = $('#muteBtn');
muteBtn.addEventListener('click', () => actions.mute());
function syncMuteButton() {
  muteBtn.innerHTML = icon(voice.isMuted() ? 'volume-off' : 'volume');
  muteBtn.setAttribute('aria-pressed', String(voice.isMuted()));
  muteBtn.setAttribute('aria-label', voice.isMuted() ? 'Turn spoken replies on' : 'Turn spoken replies off');
}

// clock
const clock = $('#clock');
const tick = () => { clock.textContent = formatClock(); };
tick();
setInterval(tick, 20000);

// Debug hook: voxcontrol.run('open messages') in the browser console behaves like saying it.
window.voxcontrol = { run: processUtterance, state };

// ---------------- boot ----------------
syncMuteButton();
await loadContacts();
render();
