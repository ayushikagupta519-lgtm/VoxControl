// Thin wrapper around fetch: JSON in/out, readable errors from the backend's problem-detail bodies.

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors || {};
  }
}

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('Cannot reach the server. Is it running?', 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const fieldMsg = data?.errors && Object.values(data.errors)[0];
    throw new ApiError(fieldMsg || data?.detail || data?.message || `Request failed (${res.status})`, res.status, data?.errors);
  }
  return data;
}

const q = encodeURIComponent;

export const api = {
  contacts: {
    list: () => request('GET', '/api/contacts'),
    create: (c) => request('POST', '/api/contacts', c),
    update: (id, c) => request('PUT', `/api/contacts/${id}`, c),
    remove: (id) => request('DELETE', `/api/contacts/${id}`),
  },
  messages: {
    inbox: () => request('GET', '/api/messages/conversations'),
    thread: (contact) => request('GET', `/api/messages?contact=${q(contact)}`),
    send: (contactName, messageText) => request('POST', '/api/messages', { contactName, messageText, sent: true }),
    remove: (id) => request('DELETE', `/api/messages/${id}`),
  },
  reminders: {
    list: () => request('GET', '/api/reminders'),
    create: (title, reminderTime) => request('POST', '/api/reminders', { title, reminderTime }),
    setCompleted: (id, completed) => request('PUT', `/api/reminders/${id}/complete?completed=${completed}`),
    remove: (id) => request('DELETE', `/api/reminders/${id}`),
  },
  emergency: {
    raise: (type, note) => request('POST', '/api/emergency', { type, note }),
    recent: () => request('GET', '/api/emergency'),
  },
};
