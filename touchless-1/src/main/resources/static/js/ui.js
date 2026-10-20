// Small UI helpers: escaping, icons, toasts, modal dialogs, time formatting.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
/** Escape untrusted text before putting it into innerHTML. */
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

export const icon = (name, cls = '') =>
  `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const dayFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });

export function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  return d.toDateString() === today.toDateString() ? timeFmt.format(d) : dayFmt.format(d);
}
export const formatClock = (d = new Date()) => timeFmt.format(d);

// ---- toasts ----
export function toast(message, kind = 'info') {
  const host = document.getElementById('toasts');
  if (!host) return;
  while (host.children.length >= 2) host.firstElementChild.remove();   // keep the stack short
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => el.classList.add('out'), 3200);
  setTimeout(() => el.remove(), 3600);
}

// ---- modal ----
/**
 * Show a bottom-sheet dialog. Resolves with the clicked action's value (or null if dismissed).
 * actions: [{ label, value, kind?: 'primary'|'danger'|'ghost' }]
 * onOpen(sheetEl) lets the caller wire up inputs; use sheet.dataset / closeWith via return value.
 */
export function modal({ title, body = '', actions = [], onOpen, getValue }) {
  const host = document.getElementById('modalHost');
  return new Promise((resolve) => {
    const previous = document.activeElement;
    host.innerHTML = `
      <div class="scrim" data-dismiss></div>
      <section class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}">
        <div class="sheet-grab"></div>
        <h2>${esc(title)}</h2>
        <div class="sheet-body">${body}</div>
        <div class="sheet-actions">
          ${actions.map((a, i) => `<button class="btn ${a.kind || ''}" data-i="${i}" type="button">${esc(a.label)}</button>`).join('')}
        </div>
      </section>`;
    host.hidden = false;
    const sheet = host.querySelector('.sheet');

    const close = (value) => {
      host.hidden = true;
      host.innerHTML = '';
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
      resolve(value);
    };
    const finish = (i) => {
      const a = actions[i];
      close(a.value === 'submit' && getValue ? getValue(sheet) : a.value);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') close(null);
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        const primary = actions.findIndex((a) => a.kind === 'primary');
        if (primary >= 0) { e.preventDefault(); finish(primary); }
      }
    };
    document.addEventListener('keydown', onKey);
    host.querySelector('[data-dismiss]').addEventListener('click', () => close(null));
    sheet.querySelectorAll('[data-i]').forEach((b) => b.addEventListener('click', () => finish(Number(b.dataset.i))));
    onOpen?.(sheet);
    (sheet.querySelector('input,textarea') || sheet.querySelector('.btn.primary,.btn'))?.focus();
  });
}

export const confirmDialog = (title, message, confirmLabel = 'Delete') =>
  modal({
    title,
    body: `<p class="muted">${esc(message)}</p>`,
    actions: [
      { label: 'Cancel', value: false, kind: 'ghost' },
      { label: confirmLabel, value: true, kind: 'danger' },
    ],
  }).then(Boolean);
