import axios from 'axios';

// API base URL resolution (in priority order):
// 1. VITE_API_URL from .env.local  → used during local dev (http://localhost:8088 or ngrok)
// 2. VITE_API_URL from .env        → used in production build (https://princete.com)
// 3. window.location.origin        → safe fallback when deployed (same-origin)
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://princete.com');

const isNgrok = typeof window !== 'undefined' && window.location.hostname.includes('ngrok');
const isApiNgrok = (import.meta.env.VITE_API_URL || '').includes('ngrok');

export const client = axios.create({
  baseURL: API_URL,
  // ngrok shows an interstitial warning page for browser requests unless this header is set.
  // It's harmless for non-ngrok backends (they just ignore unknown headers).
  headers: isNgrok || isApiNgrok ? { 'ngrok-skip-browser-warning': 'true' } : {},
});


// Every request that needs auth passes an explicit `role` in its axios
// config (see the `authFor` helper below) instead of relying on one global
// header -- this app juggles up to three live sessions at once (admin,
// patient, doctor), each with its own JWT in localStorage.
const STORAGE_KEYS = { ADMIN: 'admin_token', PATIENT: 'patient_token', DOCTOR: 'doctor_token' };

export function getToken(role) {
  return localStorage.getItem(STORAGE_KEYS[role]) || null;
}

export function setToken(role, token) {
  if (token) localStorage.setItem(STORAGE_KEYS[role], token);
  else localStorage.removeItem(STORAGE_KEYS[role]);
}

export function authFor(role) {
  const token = getToken(role);
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
}

/** Decodes a JWT's payload without verifying the signature (verification is the server's job) -- just for reading role/subject/exp client-side. */
export function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join('')
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function isExpired(token) {
  const decoded = decodeJwt(token);
  if (!decoded || !decoded.exp) return true;
  return Date.now() >= decoded.exp * 1000;
}

/**
 * Validates this API's `{ success, ... }` envelope and throws a readable
 * Error on failure -- but deliberately does NOT collapse a successful
 * response down to just its `data` field, because several endpoints carry
 * other top-level fields alongside `data` that callers need (`message` on
 * verify, `token` + `data` on doctor register/login, `alreadyExists` on
 * token creation, `token` alone on admin/OTP login). Callers read
 * `res.data` / `res.message` / `res.token` explicitly instead.
 */
async function unwrap(promise) {
  try {
    const res = await promise;
    const body = res.data;
    if (body && typeof body === 'object' && 'success' in body) {
      if (!body.success) throw new Error(body.message || body.error || 'Request failed.');
      return body;
    }
    return body;
  } catch (e) {
    if (e.response) {
      const body = e.response.data;
      const message =
        (body && (body.message || body.error)) ||
        (typeof body === 'string' ? body : null) ||
        e.message ||
        'Request failed.';
      throw new Error(message);
    }
    throw e;
  }
}

// Raw variants: resolve to the whole `{ success, ... }` envelope -- use
// these where a caller needs more than `data` (a `message`, `token`, or
// `alreadyExists` alongside it).
const get = (url, config) => unwrap(client.get(url, config));
const post = (url, data, config) => unwrap(client.post(url, data, config));
const put = (url, data, config) => unwrap(client.put(url, data, config));

// Data variants: resolve straight to `body.data` -- what almost every
// caller actually wants, since almost every endpoint's envelope is just
// `{ success, data }`.
const getD = async (url, config) => (await get(url, config)).data;
const postD = async (url, data, config) => (await post(url, data, config)).data;
const putD = async (url, data, config) => (await put(url, data, config)).data;

// ---------------------------------------------------------------- Queue ----

export const queueApi = {
  /** `{ success, token }` -- no `data` field, read `.token`. */
  login: (username, password) => post('/api/queue/login', { username, password }),
  getQueue: (hospitalId, category) => getD('/api/queue', { params: { hospitalId, category } }),
  current: (hospitalId, category) => getD('/api/queue/current', { params: { hospitalId, category } }),
  position: (phone) => getD(`/api/queue/position/${encodeURIComponent(phone)}`),
  history: (phone) => getD(`/api/queue/history/${encodeURIComponent(phone)}`, authFor('ADMIN')),
  tokenDetails: (id) => getD(`/api/queue/token/${id}`),
  /** `{ success, alreadyExists, data }` -- read both `.alreadyExists` and `.data`. */
  create: (payload) => post('/api/queue', payload),
  setLocation: (id, payload) => postD(`/api/queue/${id}/location`, payload),
  closingTimeCheck: (lat, lon) => getD('/api/queue/closing-time-check', { params: { lat, lon } }),
  qrUrl: (id) => `${API_URL}/api/queue/qr/${id}`,
  /** `{ success, message, data }` -- read `.message` for the toast, `.data` for the updated token. */
  verify: (payload) => post('/api/queue/verify', payload, authFor('ADMIN')),
  updateStatus: (id, status) => putD(`/api/queue/${id}`, { status }, authFor('ADMIN')),
  noShow: (id) => postD(`/api/queue/${id}/no-show`, {}, authFor('ADMIN')),
  anomalyControl: (hospitalId, category) =>
    getD('/api/queue/anomaly-control', { params: { hospitalId, category }, ...authFor('ADMIN') }),
  missed: (hospitalId, category) => getD('/api/queue/missed', { params: { hospitalId, category }, ...authFor('ADMIN') }),
  missedSearch: (query, hospitalId, category) =>
    getD('/api/queue/missed/search', { params: { query, hospitalId, category }, ...authFor('ADMIN') }),
  requeueMissed: (id) => postD(`/api/queue/missed/${id}/requeue`, {}, authFor('ADMIN')),
  rejectMissed: (id) => postD(`/api/queue/missed/${id}/reject`, {}, authFor('ADMIN')),
};

// ------------------------------------------------------------ Counters ----

export const counterApi = {
  board: (hospitalId, category) => getD('/api/counters', { params: { hospitalId, category } }),
  complete: (counterId, hospitalId, category) =>
    postD(`/api/counters/${counterId}/complete`, {}, { params: { hospitalId, category }, ...authFor('ADMIN') }),
  miss: (counterId, hospitalId, category) =>
    postD(`/api/counters/${counterId}/miss`, {}, { params: { hospitalId, category }, ...authFor('ADMIN') }),
};

// ------------------------------------------------------------ Hospitals ----

export const hospitalApi = {
  list: () => getD('/api/hospitals'),
  categories: () => getD('/api/hospitals/categories'),
  getBySlug: (slug) => getD(`/api/hospitals/${slug}`),
  create: (payload) => postD('/api/hospitals', payload, authFor('ADMIN')),
  updateLocation: (slug, payload) => putD(`/api/hospitals/${slug}/location`, payload, authFor('ADMIN')),
  departments: (slug) => getD(`/api/hospitals/${slug}/departments`),
  updateDepartmentCounters: (slug, category, activeCounters) =>
    putD(`/api/hospitals/${slug}/departments/${encodeURIComponent(category)}/counters`, { activeCounters }, authFor('ADMIN')),
  assignDoctorLocation: (slug, doctorId, payload) =>
    putD(`/api/hospitals/${slug}/doctors/${doctorId}/location`, payload, authFor('ADMIN')),
  /** Nearest-first hospitals for a lat/lon, optionally filtered to one department; offset/limit page 20 at a time -- `{ results, hasMore, nextOffset }`. */
  nearby: (params) => getD('/api/hospitals/nearby', { params }),
  timeSlots: (slug, date) => getD(`/api/hospitals/${slug}/time-slots`, { params: { date } }),
  createTimeSlot: (slug, payload) => postD(`/api/hospitals/${slug}/time-slots`, payload, authFor('ADMIN')),
  getJoinCode: (slug) => getD(`/api/hospitals/${slug}/doctor-join-code`, authFor('ADMIN')),
  regenerateJoinCode: (slug) => postD(`/api/hospitals/${slug}/doctor-join-code/regenerate`, {}, authFor('ADMIN')),
};

// ------------------------------------------------------------- DIGIPIN ----

export const locationApi = {
  encode: (latitude, longitude) => postD('/api/location/digipin/encode', { latitude, longitude }),
  decode: (digipin) => postD('/api/location/digipin/decode', { digipin }),
};

// ----------------------------------------------------------------- OTP ----

export const otpApi = {
  /** `{ success, message }` -- no `data` field, read `.message`. */
  send: (phone) => post('/api/auth/otp/send', { phone }),
  /** `{ success, message, token }` -- no `data` field, read `.token`. */
  verify: (phone, code) => post('/api/auth/otp/verify', { phone, code }),
};

// ------------------------------------------------------------- Doctors ----

export const doctorApi = {
  /** `{ success, message, token, data }` -- read `.token` for the session, `.data` for the doctor profile. */
  register: (name, phone) => post('/api/doctors/register', { name, phone }),
  login: (phone) => post('/api/doctors/login', { phone }),
  joinHospital: (hospitalCode) => postD('/api/doctors/join-hospital', { hospitalCode }, authFor('DOCTOR')),
  me: () => getD('/api/doctors/me', authFor('DOCTOR')),
  myTimeSlots: () => getD('/api/doctors/me/time-slots', authFor('DOCTOR')),
  createAccessRequest: () => postD('/api/doctors/access-requests', {}, authFor('DOCTOR')),
  accessRequestQrUrl: (code) => `${API_URL}/api/doctors/access-requests/${encodeURIComponent(code)}/qr`,
  patients: () => getD('/api/doctors/patients', authFor('DOCTOR')),
  patientDocumentFileUrl: (docId) => `${API_URL}/api/doctors/patients/documents/${docId}/file`,
  uploadPatientDocument: (formData) =>
    postD('/api/doctors/patients/documents/upload', formData, {
      ...authFor('DOCTOR'),
      headers: { ...authFor('DOCTOR').headers, 'Content-Type': 'multipart/form-data' },
    }),
};

// ------------------------------------------------------------ Patients ----

export const patientApi = {
  history: () => getD('/api/patients/history', authFor('PATIENT')),
  uploadDocument: (formData) =>
    postD('/api/patients/documents', formData, {
      ...authFor('PATIENT'),
      headers: { ...authFor('PATIENT').headers, 'Content-Type': 'multipart/form-data' },
    }),
  documents: () => getD('/api/patients/documents', authFor('PATIENT')),
  documentFileUrl: (id) => `${API_URL}/api/patients/documents/${id}/file`,
  acceptAccess: (code) => postD(`/api/patients/access/${encodeURIComponent(code)}/accept`, {}, authFor('PATIENT')),
  activeAccess: () => getD('/api/patients/access', authFor('PATIENT')),
  accessHistory: () => getD('/api/patients/access/history', authFor('PATIENT')),
  revokeAccess: (grantId) => postD(`/api/patients/access/${grantId}/revoke`, {}, authFor('PATIENT')),
};

/** For <img>/<a> tags hitting a protected binary route (document/QR download) -- fetches with the Bearer header and hands back an object URL. */
export async function fetchAsObjectUrl(url, role) {
  const res = await client.get(url, { ...authFor(role), responseType: 'blob' });
  return URL.createObjectURL(res.data);
}
