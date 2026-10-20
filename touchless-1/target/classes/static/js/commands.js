// ============================================================
// Voice command interpreter - pure functions, no DOM, no network.
// interpret("tell rahul i am late", { contacts: [...] }) -> intent
// ============================================================

const ALIASES = {
  mom: ['mom', 'mum', 'mommy', 'mummy', 'mother', 'maa', 'mama'],
  dad: ['dad', 'daddy', 'father', 'papa', 'pappa'],
};

export const normalize = (text) =>
  String(text || '')
    .toLowerCase()
    .replace(/[.,!?;:"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const has = (text, ...phrases) => phrases.some((p) => new RegExp(`\\b${p}\\b`).test(text));

function editDistance(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Find which known contact (if any) a phrase refers to. Tolerates mis-hearings like "priyaa". */
export function findContact(text, contacts) {
  const words = normalize(text).split(' ');
  for (const c of contacts) {
    const name = c.toLowerCase();
    const names = [name, ...name.split(' '), ...(ALIASES[name] || [])];
    if (words.some((w) => names.includes(w))) return c;
  }
  for (const c of contacts) {
    const first = c.toLowerCase().split(' ')[0];
    if (first.length >= 4 && words.some((w) => w.length >= 4 && editDistance(w, first) <= 1)) return c;
  }
  return null;
}

/** "yes" / "no" / null for confirmation questions. */
export function parseYesNo(text) {
  const t = normalize(text);
  if (has(t, 'no', 'nope', 'cancel', 'stop', 'don\'t', 'dont', 'never mind', 'nevermind')) return 'no';
  if (has(t, 'yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay', 'send', 'confirm', 'do it', 'correct', 'go ahead')) return 'yes';
  return null;
}

export const isCancel = (text) => has(normalize(text), 'cancel', 'stop', 'never mind', 'nevermind', 'forget it');

const TIME_RE = /\b(?:at|by|on|tomorrow|tonight|today|in \d+ (?:minutes?|hours?|days?))\b.*$/;

/** Split "take medicine at 8 pm" into { title: "take medicine", time: "8 pm" }. */
export function splitReminder(phrase) {
  const t = normalize(phrase);
  const m = t.match(TIME_RE);
  if (!m) return { title: t, time: '' };
  const time = m[0].replace(/^at\s+/, '').trim();
  const title = t.slice(0, m.index).trim();
  return { title: title || t, time: title ? time : '' };
}

/** The last words of the ORIGINAL transcript matching a normalized tail, so "I'm late" keeps its casing. */
function original(raw, normalizedTail) {
  const toks = String(raw).trim().split(/\s+/).filter((w) => normalize(w));
  const n = normalizedTail.split(' ').length;
  return toks.slice(-n).join(' ').replace(/[.!?]+$/, '');
}

// ---- adding contacts by voice ----
const DIGIT_WORDS = { zero: '0', oh: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9' };
const REPEAT_WORDS = { double: 2, triple: 3 };
const isDigitish = (w) => /^\+?\d+$/.test(w) || (w in DIGIT_WORDS && w !== 'oh') || w in REPEAT_WORDS || w === 'plus';

/** "9 8 7 6 5 double four 3 2" / "plus 91 98765 43210" / "98765-43210" -> "9876544 32" digits string, or null. */
export function parseSpokenPhone(text) {
  const words = normalize(text).replace(/-/g, '').split(' ').filter(Boolean);
  let out = '';
  let repeat = 1;
  for (const w of words) {
    if (w === 'plus') { if (!out) out = '+'; continue; }
    if (w in REPEAT_WORDS) { repeat = REPEAT_WORDS[w]; continue; }
    const d = /^\+?\d+$/.test(w) ? w : DIGIT_WORDS[w];
    if (d === undefined) {
      if (w === 'and' || w === 'number' || w === 'is' || w === 'its' || w === 'it\'s') continue;
      return null; // an unrelated word: do not guess
    }
    out += d.length === 1 ? d.repeat(repeat) : d;
    repeat = 1;
  }
  const digits = out.replace(/\D/g, '');
  return digits.length >= 5 && digits.length <= 15 ? out : null;
}

const titleCase = (s) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** "my friend asha 98765 43210" -> { name: "Asha", phone: "98765 43210" } (either may be ''). */
export function parseNameAndPhone(text) {
  const words = normalize(text).replace(/^(?:it is|it's|its|their name is|his name is|her name is|name is|called|named|for)\s+/, '').split(' ').filter(Boolean);
  const at = words.findIndex(isDigitish);
  const nameWords = (at === -1 ? words : words.slice(0, at)).filter((w) => !['number', 'phone', 'with', 'and'].includes(w));
  const phone = at === -1 ? '' : parseSpokenPhone(words.slice(at).join(' ')) || '';
  return { name: titleCase(nameWords.join(' ')).slice(0, 60), phone };
}

const strip = (text, re) => text.replace(re, '').trim();

/**
 * Turn a spoken sentence into an intent.
 * @param {string} raw transcript
 * @param {{contacts: string[]}} ctx known contact names
 */
export function interpret(raw, ctx = { contacts: [] }) {
  const t = normalize(raw);
  const contacts = ctx.contacts || [];
  if (!t) return { type: 'unknown', text: t };
  const who = findContact(t, contacts);

  // ---- control ----
  if (has(t, 'end call', 'hang up', 'end the call', 'disconnect')) return { type: 'endCall' };
  if (has(t, 'help', 'what can i say', 'commands') && !has(t, 'family', 'emergency', 'trusted'))
    return { type: 'help' };
  if (/^(stop|pause) (listening|voice)|^(turn|switch) off (voice|listening|the mic)|^goodbye$|^go to sleep$/.test(t))
    return { type: 'stopListening' };

  // ---- emergency (checked early: it must never be shadowed) ----
  if (has(t, 'emergency', 'sos') || (has(t, 'help') && has(t, 'family', 'trusted'))) {
    if (has(t, 'family')) return { type: 'emergency', kind: 'FAMILY' };
    if (has(t, 'trusted')) return { type: 'emergency', kind: 'TRUSTED_CONTACT' };
    return { type: 'emergency', kind: null };
  }
  if (has(t, 'trusted contact')) return { type: 'emergency', kind: 'TRUSTED_CONTACT' };

  // ---- reminders ----
  let m = t.match(/^(?:remind me|set a reminder|add a reminder|add reminder|create a reminder|new reminder)(?: to| about| for)? ?(.*)$/);
  if (m) {
    const { title, time } = splitReminder(m[1]);
    return { type: 'addReminder', title, time };
  }
  m = t.match(/^(?:complete|finish|mark|tick)(?: reminder)? (.+?)(?: as (?:done|complete|completed))?$/);
  if (m && !who) return { type: 'completeReminder', title: strip(m[1], /^reminder /) };
  m = t.match(/^(?:delete|remove) (?:the )?reminder (.+)$/);
  if (m) return { type: 'deleteReminder', title: m[1] };

  // ---- messages ----
  m = t.match(/^(?:delete|remove) (?:the )?message (.+)$/);
  if (m) return { type: 'deleteMessage', text: m[1] };
  if (/^(?:delete|remove) (?:the )?(?:last|latest) message$/.test(t)) return { type: 'deleteLastMessage' };
  if (/^(?:delete|remove) (?:the )?reminder$/.test(t)) return { type: 'deleteReminder', title: '' };

  m = t.match(/^(?:tell|text|message|whatsapp) (\S+) (?:that )?(.+)$/);
  if (m && who && findContact(m[1], contacts) === who && !has(m[2], 'hello there') && !/^(?:messages?|chat)$/.test(m[2]))
    return { type: 'composeMessage', contact: who, text: original(raw, m[2]) };
  m = t.match(/^send (?:a )?(?:message|text) to \S+ (?:saying|that says|that|says) (.+)$/);
  if (m && who) return { type: 'composeMessage', contact: who, text: original(raw, m[1]) };
  m = t.match(/^send \S+ (?:a )?(?:message|text) (?:saying|that says|that|says) (.+)$/);
  if (m && who) return { type: 'composeMessage', contact: who, text: original(raw, m[1]) };
  if (has(t, 'send', 'write', 'compose', 'new') && has(t, 'message', 'text')) {
    return who ? { type: 'composeMessage', contact: who, text: '' } : { type: 'composeMessage', contact: null, text: '' };
  }

  // ---- add a contact (before navigation, which would swallow the word "contact") ----
  m = t.match(/^(?:add|create|save|new|make)(?: a)?(?: new)? contact(?: for| called| named)?(?: (.+))?$/)
    || t.match(/^(?:add|save) (?:a )?(?:new )?(?:contact )?(.+?) (?:to|in|into) (?:my )?contacts?(?: list)?$/);
  if (m && !has(t, 'reminder')) {
    const { name, phone } = parseNameAndPhone(m[1] || '');
    return { type: 'addContact', name, phone };
  }

  // ---- calls & contacts ----
  if (has(t, 'call', 'dial', 'phone', 'ring') && who) return { type: 'call', contact: who };
  if (has(t, 'call', 'dial') && !who) return { type: 'call', contact: null };
  if (who && has(t, 'message', 'messages', 'chat', 'conversation', 'texts')) return { type: 'openChat', contact: who };
  if (who && has(t, 'contact', 'profile', 'details', 'number')) return { type: 'openContact', contact: who };
  if (who && has(t, 'open', 'show', 'go to')) return { type: 'openChat', contact: who };

  // ---- navigation ----
  if (has(t, 'messages', 'message', 'inbox', 'chats')) return { type: 'openMessages' };
  if (has(t, 'contacts', 'contact')) return { type: 'openContacts' };
  if (has(t, 'reminders', 'reminder')) return { type: 'openReminders' };
  if (has(t, 'home', 'main screen', 'home screen')) return { type: 'home' };
  if (has(t, 'go back', 'back')) return { type: 'back' };

  return { type: 'unknown', text: t };
}
