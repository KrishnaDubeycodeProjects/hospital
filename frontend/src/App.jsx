import React, { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { RoleShell } from './components/Layout';
import { warmUpBackend } from './api/client';
import { MessageCircle } from 'lucide-react';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Book from './pages/Book';
import SelectPatient from './pages/SelectPatient';
import FindHospital from './pages/FindHospital';
import Track from './pages/Track';
import TokenDetail from './pages/TokenDetail';

import AshaAdminDashboard from './pages/admin/AshaAdminDashboard';

import PatientQueue from './pages/patient/PatientQueue';
import PatientFamily from './pages/patient/PatientFamily';
import PatientRecordsHub from './pages/patient/PatientRecordsHub';
import PatientAccess from './pages/patient/PatientAccess';
import HealthRecordsScreen from './pages/patient/HealthRecordsScreen';

import DoctorProfile from './pages/doctor/DoctorProfile';
import DoctorConsultation from './pages/doctor/DoctorConsultation';
import DoctorCourses from './pages/doctor/DoctorCourses';
import DoctorReferrals from './pages/doctor/DoctorReferrals';
import DoctorAccess from './pages/doctor/DoctorAccess';
import DoctorPatients from './pages/doctor/DoctorPatients';

function WhatsAppFloatingButton() {
  const handleWarmup = () => {
    warmUpBackend();
  };

  return (
    <a
      href="https://wa.me/919120123877?text=Hi%2C%20I%20want%20to%20book%20an%20OPD%20appointment"
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={handleWarmup}
      onClick={handleWarmup}
      title="Book OPD on WhatsApp (+91 91201 23877)"
      aria-label="Book OPD token on WhatsApp"
      style={{
        position: 'fixed',
        bottom: '22px',
        right: '22px',
        zIndex: 9999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: '#008069',
        color: '#ffffff',
        padding: '11px 18px',
        borderRadius: '9999px',
        fontSize: '13.5px',
        fontWeight: '700',
        textDecoration: 'none',
        boxShadow: '0 4px 16px rgba(0, 128, 105, 0.35)',
        border: '1.5px solid #25D366',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 128, 105, 0.45)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 128, 105, 0.35)';
      }}
    >
      <MessageCircle size={18} strokeWidth={2.2} />
      <span>व्हाट्सएप पर पर्ची बनाएं</span>
    </a>
  );
}

export default function App() {
  useEffect(() => {
    // Proactively pre-warm AWS Lambda JVM on page load so first interaction is < 2s
    warmUpBackend();
  }, []);

  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <WhatsAppFloatingButton />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/book" element={<Book />} />
            <Route path="/select-patient" element={<SelectPatient />} />
            <Route path="/find-hospital" element={<FindHospital />} />
            <Route path="/track" element={<Track />} />
            <Route path="/track/:phone" element={<Track />} />
            <Route path="/token/:id" element={<TokenDetail />} />
            <Route path="/login/:role" element={<Login />} />
            <Route path="/records-select" element={<HealthRecordsScreen />} />
            <Route path="/demo/health-records" element={<HealthRecordsScreen />} />

            {/* ASHA Gramin Swasthya Worker & Admin Routes */}
            <Route path="/asha" element={<AshaAdminDashboard />} />
            <Route path="/asha-worker" element={<AshaAdminDashboard />} />
            <Route path="/admin" element={<AshaAdminDashboard />} />
            <Route path="/admin/*" element={<AshaAdminDashboard />} />

            <Route path="/patient" element={<RoleShell role="patient" />}>
              <Route index element={<PatientQueue />} />
              <Route path="family" element={<PatientFamily />} />
              <Route path="records" element={<PatientRecordsHub />} />
              <Route path="courses" element={<Navigate to="/patient/records?tab=courses" replace />} />
              <Route path="referrals" element={<Navigate to="/patient/records?tab=referrals" replace />} />
              <Route path="history" element={<Navigate to="/patient/records?tab=history" replace />} />
              <Route path="documents" element={<Navigate to="/patient/records?tab=documents" replace />} />
              <Route path="access" element={<PatientAccess />} />
            </Route>

            <Route path="/doctor" element={<RoleShell role="doctor" />}>
              <Route index element={<DoctorProfile />} />
              <Route path="consultation" element={<DoctorConsultation />} />
              <Route path="courses" element={<DoctorCourses />} />
              <Route path="referrals" element={<DoctorReferrals />} />
              <Route path="access" element={<DoctorAccess />} />
              <Route path="patients" element={<DoctorPatients />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}

