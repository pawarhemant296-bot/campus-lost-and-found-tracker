/* Thin REST client for the TraceBack API. Attaches the JWT automatically and
   normalises server errors into thrown Error objects. */

const TOKEN_KEY = 'traceback.token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request(path, { method = 'GET', body, isForm = false, signal } = {}) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.authorization = `Bearer ${token}`;
  if (body && !isForm) headers['content-type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    signal,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  const text = await res.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!res.ok) {
    const err = new Error(payload?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

export const api = {
  get: (p, opts) => request(p, opts),
  post: (p, body, opts) => request(p, { ...opts, method: 'POST', body }),
  patch: (p, body, opts) => request(p, { ...opts, method: 'PATCH', body }),
  put: (p, body, opts) => request(p, { ...opts, method: 'PUT', body }),
  del: (p, opts) => request(p, { ...opts, method: 'DELETE' }),
  form: (p, formData, method = 'POST') => request(p, { method, body: formData, isForm: true }),
};

/* ------------------------------------------------------------------ typed api */

export const AuthAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (payload) => api.post('/auth/register', payload),
  me: () => api.get('/auth/me'),
  updateProfile: (payload) => api.patch('/auth/me', payload),
  changePassword: (payload) => api.post('/auth/change-password', payload),
};

export const ItemsAPI = {
  list: (params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null)
    );
    return api.get(`/items?${qs.toString()}`);
  },
  get: (id) => api.get(`/items/${id}`),
  create: (formData) => api.form('/items', formData),
  update: (id, payload) => api.patch(`/items/${id}`, payload),
  remove: (id) => api.del(`/items/${id}`),
  rescan: (id) => api.post(`/items/${id}/rescan`),
  compare: (id, otherId) => api.get(`/items/${id}/compare/${otherId}`),
};

export const MatchesAPI = {
  list: (params = {}) => api.get(`/matches?${new URLSearchParams(params).toString()}`),
  get: (id) => api.get(`/matches/${id}`),
  reject: (id) => api.post(`/matches/${id}/reject`),
};

export const ClaimsAPI = {
  create: (payload) => api.post('/claims', payload),
  list: (params = {}) => api.get(`/claims?${new URLSearchParams(params).toString()}`),
  get: (id) => api.get(`/claims/${id}`),
  verify: (id, payload) => api.post(`/claims/${id}/verify`, payload),
  decide: (id, payload) => api.post(`/claims/${id}/decision`, payload),
  handover: (id) => api.post(`/claims/${id}/handover`),
  close: (id) => api.post(`/claims/${id}/close`),
  dispute: (id, reason) => api.post(`/claims/${id}/dispute`, { reason }),
};

export const MessagesAPI = {
  threads: () => api.get('/messages/threads'),
  thread: (userId, itemId) =>
    api.get(`/messages/thread/${userId}${itemId ? `?item_id=${itemId}` : ''}`),
  send: (payload) => api.post('/messages', payload),
  start: (itemId) => api.post('/messages/start', { item_id: itemId }),
};

export const NotificationsAPI = {
  list: () => api.get('/notifications'),
  read: (id) => api.post(`/notifications/${id}/read`),
  readAll: () => api.post('/notifications/read-all'),
  remove: (id) => api.del(`/notifications/${id}`),
};

export const AdminAPI = {
  overview: () => api.get('/admin/overview'),
  users: (q = '') => api.get(`/admin/users?q=${encodeURIComponent(q)}`),
  updateUser: (id, payload) => api.patch(`/admin/users/${id}`, payload),
  items: (params = {}) => api.get(`/admin/items?${new URLSearchParams(params).toString()}`),
  updateItem: (id, payload) => api.patch(`/admin/items/${id}`, payload),
  removeItem: (id) => api.del(`/admin/items/${id}`),
  claims: (params = {}) => api.get(`/admin/claims?${new URLSearchParams(params).toString()}`),
  disputes: () => api.get('/admin/disputes'),
  updateDispute: (id, payload) => api.patch(`/admin/disputes/${id}`, payload),
  analytics: () => api.get('/admin/analytics'),
  settings: () => api.get('/admin/settings'),
  saveSettings: (payload) => api.put('/admin/settings', payload),
};

export const MetaAPI = {
  all: () => api.get('/meta'),
  stats: () => api.get('/meta/stats'),
  showcase: () => api.get('/meta/showcase'),
};
