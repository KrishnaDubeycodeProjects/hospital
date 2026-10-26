import axios from 'axios';
import { parseQrIdentifier } from '../utils/qrScannerHelper';

// API base URL resolution (in priority order):
// 1. VITE_API_URL from .env.local  → used during local dev (http://localhost:8088 or ngrok)
// 2. VITE_API_URL from .env        → used in production build (https://princete.com)
// 3. window.location.origin        → safe fallback when deployed (same-origin)
export const API_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' ? window.location.origin : 'https://r30w1p3cyh.execute-api.us-east-1.amazonaws.com');

export const client = axios.create({
  baseURL: API_URL,
  // ngrok shows an interstitial warning page for browser requests unless this header is set.
  // It's harmless for non-ngrok backends (they just ignore unknown headers).
  headers: {
    'ngrok-skip-browser-warning': 'true',
  },
});

// Interceptor to guarantee the ngrok bypass header is present on every single request
client.interceptors.request.use((config) => {
  config.headers = config.headers || {};
  config.headers['ngrok-skip-browser-warning'] = 'true';
  return config;
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

function extractFormDataParams(formData, extraParams = {}) {
  const params = { ...extraParams };
  if (typeof FormData !== 'undefined' && formData instanceof FormData) {
    for (const [key, val] of formData.entries()) {
      if (typeof val === 'string') {
        params[key] = val;
      }
    }
  }
  return params;
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
  position: (phone) => getD('/api/queue/position', { params: { phone } }),
  history: (phone) => getD(`/api/queue/history/${encodeURIComponent(phone)}`, authFor('ADMIN')),
  tokenDetails: (id) => getD(`/api/queue/token/${id}`),
  /** `{ success, alreadyExists, data }` -- read both `.alreadyExists` and `.data`. */
  create: (payload) => post('/api/queue', payload),
  setLocation: (id, payload) => postD(`/api/queue/${id}/location`, payload),
  closingTimeCheck: (lat, lon) => getD('/api/queue/closing-time-check', { params: { lat, lon } }),
  qrUrl: (id) => `${API_URL}/api/queue/qr/${id}`,
  /** `{ success, message, data }` -- read `.message` for the toast, `.data` for the updated token. */
  verify: (payload) => post('/api/queue/verify', payload, authFor(getToken('ADMIN') ? 'ADMIN' : 'DOCTOR')),
  updateStatus: (id, status, role) => putD(`/api/queue/${id}`, { status }, authFor(role || (getToken('ADMIN') ? 'ADMIN' : 'DOCTOR'))),
  noShow: (id, role) => postD(`/api/queue/${id}/no-show`, {}, authFor(role || (getToken('ADMIN') ? 'ADMIN' : 'DOCTOR'))),
  anomalyControl: (hospitalId, category) =>
    getD('/api/queue/anomaly-control', { params: { hospitalId, category }, ...authFor('ADMIN') }),
  missed: (hospitalId, category) => getD('/api/queue/missed', { params: { hospitalId, category }, ...authFor('ADMIN') }),
  reserved: (hospitalId, category) => getD('/api/queue/reserved', { params: { hospitalId, category }, ...authFor('ADMIN') }),
  frozen: (hospitalId, category) => getD('/api/queue/frozen', { params: { hospitalId, category }, ...authFor('ADMIN') }),
  unfreeze: (id, counterId) =>
    postD(`/api/queue/unfreeze/${id}`, {}, { params: counterId ? { counterId } : {}, ...authFor(getToken('ADMIN') ? 'ADMIN' : 'DOCTOR') }),
  missedSearch: (query, hospitalId, category) =>
    getD('/api/queue/missed/search', { params: { query, hospitalId, category }, ...authFor('ADMIN') }),
  requeueMissed: (id, counterId) =>
    postD(`/api/queue/missed/${id}/requeue`, {}, { params: counterId ? { counterId } : {}, ...authFor(getToken('ADMIN') ? 'ADMIN' : 'DOCTOR') }),
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
  updateMyCounter: (payload) => putD('/api/doctors/me/counter', payload, authFor('DOCTOR')),
  myTimeSlots: () => getD('/api/doctors/me/time-slots', authFor('DOCTOR')),
  createAccessRequest: () => postD('/api/doctors/access-requests', {}, authFor('DOCTOR')),
  accessRequestQrUrl: (code) => `${API_URL}/api/doctors/access-requests/${encodeURIComponent(code)}/qr`,
  patients: () => getD('/api/doctors/patients', authFor('DOCTOR')),
  patientHistory: () => getD('/api/doctors/patients/history', authFor('DOCTOR')),
  patientGrants: () => getD('/api/doctors/patients/grants', authFor('DOCTOR')),
  patientDocumentFileUrl: (docId) => `${API_URL}/api/doctors/patients/documents/${docId}/file`,
  uploadPatientDocument: (formData) =>
    postD('/api/doctors/patients/documents/upload', formData, {
      ...authFor('DOCTOR'),
      params: extractFormDataParams(formData),
    }),
  revokePatientAccess: (phone) => postD('/api/doctors/patients/revoke-access', { phone }, authFor('DOCTOR')),
};

// ------------------------------------------------------------ Patients ----

export const patientApi = {
  history: () => getD('/api/patients/history', authFor('PATIENT')),
  publicHistory: (phone) => getD('/api/patients/public/history', { params: { phone } }),
  uploadDocument: (formData) =>
    postD('/api/patients/documents', formData, {
      ...authFor('PATIENT'),
      params: extractFormDataParams(formData),
    }),
  documents: () => getD('/api/patients/documents', authFor('PATIENT')),
  publicDocuments: (phone) => getD('/api/patients/public/documents', { params: { phone } }),
  documentFileUrl: (id) => `${API_URL}/api/patients/documents/${id}/file`,
  publicDocumentFileUrl: (id, phone) => `${API_URL}/api/patients/public/documents/${id}/file${phone ? `?phone=${encodeURIComponent(phone)}` : ''}`,
  acceptAccess: (code) => postD(`/api/patients/access/${encodeURIComponent(code)}/accept`, {}, authFor('PATIENT')),
  activeAccess: () => getD('/api/patients/access', authFor('PATIENT')),
  accessHistory: () => getD('/api/patients/access/history', authFor('PATIENT')),
  revokeAccess: (grantId) => postD(`/api/patients/access/${grantId}/revoke`, {}, authFor('PATIENT')),
};

// ------------------------------------------------------------- Courses ----

export const courseApi = {
  create: (payload) => postD('/api/courses', payload, authFor('DOCTOR')),
  search: (query) => getD('/api/courses/search', { params: { query }, ...authFor('DOCTOR') }),
  get: (id, role = 'DOCTOR') => getD(`/api/courses/${id}`, authFor(role)),
  timeline: (id, role = 'DOCTOR') => {
    if (role === 'PUBLIC') return getD(`/api/courses/public/${id}/timeline`);
    return getD(`/api/courses/${id}/timeline`, authFor(role)).catch(() => getD(`/api/courses/public/${id}/timeline`));
  },
  consentBundle: (id) => getD(`/api/courses/${id}/consent-bundle`, authFor('DOCTOR')),
  addEncounter: (id, payload) => postD(`/api/courses/${id}/encounters`, payload, authFor('DOCTOR')),
  completeAndNext: (id, payload) => postD(`/api/courses/${id}/complete-and-next`, payload, authFor('DOCTOR')),
  uploadDocument: (id, formData) =>
    postD(`/api/courses/${id}/documents`, formData, {
      ...authFor('DOCTOR'),
      params: extractFormDataParams(formData),
    }),
  documentDownloadUrl: (id, docId) => `${API_URL}/api/courses/${id}/documents/${docId}/download`,
  publicDocumentDownloadUrl: (id, docId) => `${API_URL}/api/courses/public/${id}/documents/${docId}/download`,
  close: (id) => postD(`/api/courses/${id}/close`, {}, authFor('DOCTOR')),
  patientCourses: () => getD('/api/courses/patient', authFor('PATIENT')),
  publicPatientCourses: (phone) => getD('/api/courses/public/patient', { params: { phone } }),
};

// ----------------------------------------------------------- Referrals ----

export const referralApi = {
  create: (payload) => postD('/api/referrals', payload, authFor('DOCTOR')),
  get: (id, role = 'DOCTOR') => getD(`/api/referrals/${id}`, authFor(role)),
  qrUrl: (id) => `${API_URL}/api/referrals/${id}/qr`,
  priorContext: (courseId, toHospitalId) =>
    getD('/api/referrals/prior-context', { params: { courseId, toHospitalId }, ...authFor('DOCTOR') }),
  patientReferrals: () => getD('/api/referrals/patient', authFor('PATIENT')),
  publicPatientReferrals: (phone) => getD('/api/referrals/public/patient', { params: { phone } }),
  complete: (id) => postD(`/api/referrals/${id}/complete`, {}, authFor('DOCTOR')),
  cancel: (id) => postD(`/api/referrals/${id}/cancel`, {}, authFor('DOCTOR')),
};

// -------------------------------------------------------------- Family ----

export const familyApi = {
  getUnit: () => getD('/api/family', authFor('PATIENT')),
  listMembers: () => getD('/api/family/members', authFor('PATIENT')),
  listPublicMembers: (phone = '9876543210') => getD('/api/family/public/members', { params: { phone } }),
  addMember: (payload) => postD('/api/family/members', payload, authFor('PATIENT')),
  updateMember: (memberId, payload) => putD(`/api/family/members/${memberId}`, payload, authFor('PATIENT')),
  linkAbha: (memberId, payload) => postD(`/api/family/members/${memberId}/link-abha`, payload, authFor('PATIENT')),
  enrollAbha: (memberId, payload) => postD(`/api/family/members/${memberId}/enroll-abha`, payload, authFor('PATIENT')),
  deleteMember: (memberId) => delD(`/api/family/members/${memberId}`, authFor('PATIENT')),
};

// --------------------------------------------------------------- Drugs ----

export const drugApi = {
  search: (query) => getD('/api/drugs/search', { params: { query } }),
  searchLabs: (query) => getD('/api/drugs/labs', { params: { query } }),
  templates: () => getD('/api/drugs/templates'),
};

// ---------------------------------------------------------------- ABDM ----

const defaultAuth = () => {
  const patientToken = getToken('PATIENT');
  if (patientToken) return authFor('PATIENT');
  const doctorToken = getToken('DOCTOR');
  if (doctorToken) return authFor('DOCTOR');
  const adminToken = getToken('ADMIN');
  if (adminToken) return authFor('ADMIN');
  return {};
};

export const abdmApi = {
  getStatus: () => getD('/api/abdm/status', defaultAuth()),
  checkAddress: (abhaAddress) => getD('/api/abdm/check-address', { params: { abhaAddress }, ...defaultAuth() }),
  initKyc: (type, value) => postD('/api/abdm/kyc/init', { type, value }, defaultAuth()),
  verifyKyc: (txnId, otp) => postD('/api/abdm/kyc/verify', { txnId, otp }, defaultAuth()),
  enrollAadhaarInit: (aadhaar) => postD('/api/abdm/enroll/aadhaar/init', { aadhaar }, defaultAuth()),
  enrollAadhaarVerify: (payload) => postD('/api/abdm/enroll/aadhaar/verify', payload, defaultAuth()),
  linkCareContext: (payload) => postD('/api/abdm/care-context/link', payload, defaultAuth()),
  getEncounterFhir: (courseId, encounterId) => getD(`/api/abdm/courses/${courseId}/encounters/${encounterId}/fhir`, defaultAuth()),
  getCourseFhir: (courseId) => getD(`/api/abdm/courses/${courseId}/fhir`, defaultAuth()),
  initConsent: (payload) => postD('/api/abdm/consent/init', payload, defaultAuth()),
  getConsentStatus: (id) => getD(`/api/abdm/consent/${id}/status`, defaultAuth()),
  testApproveConsent: (id) => postD(`/api/abdm/consent/${id}/test-approve`, {}, defaultAuth()),
  getConsentRecords: (artefactId) => getD(`/api/abdm/consent/${artefactId}/records`, defaultAuth()),
};


/** For <img>/<a> tags hitting a protected binary route (document/QR download) -- fetches with the Bearer header and hands back an object URL. */

// --------------------------------------------------------------- ASHA & Community ----

const ashaAuth = (phone = '9876543210') => {
  const token = getToken('ADMIN') || getToken('DOCTOR') || getToken('PATIENT');
  const headers = { 
    'X-ASHA-Phone': phone,
    'X-ANM-Phone': phone
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return { headers };
};

export const ashaApi = {
  getMe: (phone) => getD('/api/asha/me', ashaAuth(phone)),
  getDashboard: (phone) => getD('/api/asha/dashboard', ashaAuth(phone)),
  listFamilies: (phone, search, sort) => getD('/api/asha/families', { ...ashaAuth(phone), params: { search, sort } }),
  getFamilyDetail: (id, phone) => getD(`/api/asha/families/${id}`, ashaAuth(phone)),
  getGridData: (phone, section) => getD('/api/asha/grid', { ...ashaAuth(phone), params: { section } }),
  createFamily: (body, phone) => postD('/api/asha/families', body, ashaAuth(phone)),
  addMember: (familyId, body, phone) => postD(`/api/asha/families/${familyId}/members`, body, ashaAuth(phone)),
  updateMember: (familyId, memberId, body, phone) => putD(`/api/asha/families/${familyId}/members/${memberId}`, body, ashaAuth(phone)),
  deleteMember: (familyId, memberId, phone) => delD(`/api/asha/families/${familyId}/members/${memberId}`, ashaAuth(phone)),
  setVisitInterval: (familyId, intervalDays, phone) => putD(`/api/asha/families/${familyId}/visit-interval`, { intervalDays }, ashaAuth(phone)),
};

export const choApi = {
  getAnalytics: () => getD('/api/cho/analytics', defaultAuth()),
  getReferrals: () => getD('/api/cho/referrals', defaultAuth()),
  approveReferral: (id) => postD(`/api/cho/referrals/${id}/approve`, {}, defaultAuth()),
  saveTeleconsultAdvice: (referralId, payload) => postD(`/api/cho/referrals/${referralId}/teleconsult`, payload, defaultAuth()),
};

export const anmApi = {
  getMe: (phone) => getD('/api/anm/me', ashaAuth(phone)),
  createSession: (body, phone) => postD('/api/anm/session', body, ashaAuth(phone)),
  getIncomingData: (section, phone) => getD('/api/anm/data', { ...ashaAuth(phone), params: { section: section || 'ALL' } }),
  listAshaWorkers: (phone) => getD('/api/anm/ashas', ashaAuth(phone)),
  getMemberForms: (ashaPhone, memberId, category, anmPhone) =>
    getD(`/api/anm/data/${ashaPhone}/members/${memberId}/forms`, { ...ashaAuth(anmPhone), params: { category } }),
};

export const syncApi = {
  upload: (payload, phone) => post('/api/sync/upload', payload, ashaAuth(phone)),
  download: (since, phone) => get('/api/sync/download', { ...ashaAuth(phone), params: { since } }),
  sendToAnm: (section, anmIdentifier, phone) => {
    const cleanId = parseQrIdentifier(anmIdentifier) || anmIdentifier;
    return post('/api/sync/send-to-anm', { section, anmIdentifier: cleanId }, ashaAuth(phone));
  },
  simulateMissedReferral: (daysOverdue, houseNumber, referralReason, phone) =>
    post('/api/followups/simulate-missed-referral', {}, {
      ...ashaAuth(phone),
      params: { daysOverdue, houseNumber, referralReason },
    }),
};

export async function fetchAsObjectUrl(url, role) {
  const res = await client.get(url, { ...authFor(role), responseType: 'blob' });
  if (res.data && res.data.type === 'application/json') {
    const text = await res.data.text();
    let msg = 'Failed loading document';
    try {
      const parsed = JSON.parse(text);
      msg = parsed.message || parsed.error || msg;
    } catch {}
    throw new Error(msg);
  }
  return URL.createObjectURL(res.data);
}
