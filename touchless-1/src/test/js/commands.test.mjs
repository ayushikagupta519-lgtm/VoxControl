import assert from 'node:assert/strict';
import { interpret, parseYesNo, splitReminder, findContact } from '../../main/resources/static/js/commands.js';
const ctx = { contacts: ['Rahul', 'Priya', 'Mom', 'Dad'] };
const I = (s) => interpret(s, ctx);
const cases = [
  ['Open messages', { type: 'openMessages' }],
  ['open contacts', { type: 'openContacts' }],
  ['show my reminders', { type: 'openReminders' }],
  ['Call Rahul', { type: 'call', contact: 'Rahul' }],
  ['call mum', { type: 'call', contact: 'Mom' }],
  ['call priyaa', { type: 'call', contact: 'Priya' }],
  ['open Priya contact', { type: 'openContact', contact: 'Priya' }],
  ['open mom messages', { type: 'openChat', contact: 'Mom' }],
  ['send message to Rahul', { type: 'composeMessage', contact: 'Rahul', text: '' }],
  ['tell Priya I will be late', { type: 'composeMessage', contact: 'Priya', text: 'I will be late' }],
  ['send a message to dad saying happy birthday', { type: 'composeMessage', contact: 'Dad', text: 'happy birthday' }],
  ['send Rahul a message saying hello', { type: 'composeMessage', contact: 'Rahul', text: 'hello' }],
  ['Tell Priya I\'m running late, sorry.', { type: 'composeMessage', contact: 'Priya', text: "I'm running late, sorry" }],
  ['remind me to take medicine at 8 pm', { type: 'addReminder', title: 'take medicine', time: '8 pm' }],
  ['add reminder', { type: 'addReminder', title: '', time: '' }],
  ['complete take medicine', { type: 'completeReminder', title: 'take medicine' }],
  ['mark buy milk as done', { type: 'completeReminder', title: 'buy milk' }],
  ['delete reminder buy milk', { type: 'deleteReminder', title: 'buy milk' }],
  ['delete message hello', { type: 'deleteMessage', text: 'hello' }],
  ['emergency', { type: 'emergency', kind: null }],
  ['I need help family', { type: 'emergency', kind: 'FAMILY' }],
  ['trusted contact', { type: 'emergency', kind: 'TRUSTED_CONTACT' }],
  ['hang up', { type: 'endCall' }],
  ['go home', { type: 'home' }],
  ['go back', { type: 'back' }],
  ['what can I say', { type: 'help' }],
  ['stop listening', { type: 'stopListening' }],
  ['banana', { type: 'unknown', text: 'banana' }],
  ['I know the answer', { type: 'unknown', text: 'i know the answer' }],
];
let fail = 0;
for (const [s, want] of cases) {
  try { assert.deepEqual(I(s), want); } catch (e) { fail++; console.log('FAIL:', s, '->', JSON.stringify(I(s)), 'wanted', JSON.stringify(want)); }
}
// yes/no must use whole words ("now", "know" are not "no")
for (const [s, want] of [['yes', 'yes'], ['yeah send it', 'yes'], ['no', 'no'], ['cancel', 'no'], ['I know', null], ['not now', null], ['maybe later', null]]) {
  if (parseYesNo(s) !== want) { fail++; console.log('FAIL yn:', s, parseYesNo(s), want); }
}
assert.deepEqual(splitReminder('call doctor tomorrow morning'), { title: 'call doctor', time: 'tomorrow morning' });
console.log(fail ? `${fail} failures` : `all ${cases.length + 7 + 1} passed`);
process.exit(fail ? 1 : 0);
