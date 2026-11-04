import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { decodeJwt, getToken, isExpired, setToken as persistToken } from '../api/client';

const AuthContext = createContext(null);

function readSession(role) {
  const token = getToken(role);
  if (!token || isExpired(token)) return null;
  const decoded = decodeJwt(token);
  if (!decoded) return null;
  return { token, subject: decoded.sub, doctorId: decoded.doctorId ?? null };
}

/**
 * Holds up to three independent sessions at once -- admin, patient, doctor
 * -- each in its own localStorage slot (see api/client.js). A staff member
 * can be logged in as admin in one tab and a patient/doctor session can
 * still coexist; the active role just decides which dashboard is shown.
 */
export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => readSession('ADMIN'));
  const [patient, setPatient] = useState(() => readSession('PATIENT'));
  const [doctor, setDoctor] = useState(() => readSession('DOCTOR'));
  const [doctorProfile, setDoctorProfile] = useState(null);

  const login = useCallback((role, token) => {
    persistToken(role, token);
    const session = readSession(role);
    if (role === 'ADMIN') setAdmin(session);
    if (role === 'PATIENT') setPatient(session);
    if (role === 'DOCTOR') setDoctor(session);
    return session;
  }, []);

  const logout = useCallback((role) => {
    persistToken(role, null);
    if (role === 'ADMIN') setAdmin(null);
    if (role === 'PATIENT') setPatient(null);
    if (role === 'DOCTOR') {
      setDoctor(null);
      setDoctorProfile(null);
    }
  }, []);

  const value = useMemo(
    () => ({ admin, patient, doctor, doctorProfile, setDoctorProfile, login, logout }),
    [admin, patient, doctor, doctorProfile, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * Adopts a patient JWT handed over in a WhatsApp deep link (?token=...).
 * - Only a valid, unexpired PATIENT token is accepted.
 * - It never replaces a different patient who is already logged in on this
 *   device, so a forwarded link can't silently switch you to someone else.
 * - It goes through login() so AuthContext (and every `patient?.subject`
 *   read) updates, then the token is stripped from the address bar so it
 *   isn't re-shared, bookmarked or passed along to the next page.
 */
export function useLinkToken() {
  const [params, setParams] = useSearchParams();
  const { patient, login } = useAuth();
  const linkToken = params.get('token');

  useEffect(() => {
    if (!linkToken) return;
    const decoded = decodeJwt(linkToken);
    const valid = decoded && decoded.role === 'PATIENT' && !isExpired(linkToken);
    if (valid && (!patient || patient.subject === decoded.sub)) {
      login('PATIENT', linkToken);
    } else if (valid) {
      console.warn('Ignoring link token for a different patient than the one logged in.');
    }
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('token');
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkToken]);
}
