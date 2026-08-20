import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
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
