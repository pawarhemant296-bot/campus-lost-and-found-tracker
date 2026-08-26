/**
 * Small REST client. Adds the JWT, unwraps `{ error: { message } }` responses
 * into thrown Errors, and supports multipart uploads for item photos.
 */
const TOKEN_KEY = 'lf_token';

/** Empty base means "same origin" - the Vite proxy and the Express static
 *  server both make that work without configuration. */
const BASE = import.meta.env.VITE_API_URL ?? '';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
};

export class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request(method, endpoint, { body, isForm = false, auth = true } = {}) {
  const headers = {};
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${BASE}/api${endpoint}`, {
    method,
    headers,
    ...(body ? { body: isForm ? body : JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = data?.error?.message ?? `Request failed (${response.status})`;
    const details = data?.error?.details;
    // A dead session should not leave a stale token behind.
    if (response.status === 401 && token) setToken(null);
    throw new ApiError(details?.length ? `${message}: ${details.map((d) => d.message).join(', ')}` : message, response.status, details);
  }
  return data;
}

export const api = {
  get: (endpoint, options) => request('GET', endpoint, options),
  post: (endpoint, body, options) => request('POST', endpoint, { ...options, body }),
  patch: (endpoint, body, options) => request('PATCH', endpoint, { ...options, body }),
  delete: (endpoint, options) => request('DELETE', endpoint, options),
  /** POST/PATCH multipart form data (item and proof photos). */
  upload: (endpoint, formData, method = 'POST') => request(method, endpoint, { body: formData, isForm: true }),
};

/** Turns a plain object + File into FormData, skipping empty values. */
export function toFormData(values, file, fileField = 'image') {
  const form = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    form.append(key, value);
  }
  if (file) form.append(fileField, file);
  return form;
}

export default api;
