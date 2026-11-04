import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { RoleShell, HealthRecordsLayout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';

import Landing from './pages/Landing';
import Login from './pages/Login';
import Book from './pages/Book';
import SelectPatient from './pages/SelectPatient';
import FindHospital from './pages/FindHospital';
import Track from './pages/Track';
import TokenDetail from './pages/TokenDetail';

import AshaAdminDashboard from './pages/admin/AshaAdminDashboard';
import AdminQueue from './pages/admin/AdminQueue';
import AdminCounters from './pages/admin/AdminCounters';
import AdminMissed from './pages/admin/AdminMissed';
import AdminHistory from './pages/admin/AdminHistory';
import AdminHospitals from './pages/admin/AdminHospitals';

import PatientQueue from './pages/patient/PatientQueue';
import PatientFamily from './pages/patient/PatientFamily';
import PatientRecordsHub from './pages/patient/PatientRecordsHub';
import PatientAccess from './pages/patient/PatientAccess';
import HealthRecordsScreen from './pages/patient/HealthRecordsScreen';

import DoctorProfile from './pages/doctor/DoctorProfile';
import DoctorConsultation from './pages/doctor/DoctorConsultation';
import DoctorServeEncounter from './pages/doctor/DoctorServeEncounter';
import DoctorCourses from './pages/doctor/DoctorCourses';
import DoctorReferrals from './pages/doctor/DoctorReferrals';
import DoctorAccess from './pages/doctor/DoctorAccess';
import DoctorPatients from './pages/doctor/DoctorPatients';

import AshaApp from './pages/asha/AshaApp';

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/book" element={<Book />} />
              <Route path="/select-patient" element={<SelectPatient />} />
              <Route path="/find-hospital" element={<FindHospital />} />
              <Route path="/hospitals" element={<FindHospital />} />
              <Route path="/hospital" element={<FindHospital />} />
              <Route path="/hospital-view" element={<FindHospital />} />
              <Route path="/hospital/view" element={<FindHospital />} />
              <Route path="/track" element={<Track />} />
              <Route path="/track/:phone" element={<Track />} />
              <Route path="/token/:id" element={<TokenDetail />} />
              <Route path="/login/:role" element={<Login />} />
              <Route path="/records-select" element={<HealthRecordsScreen />} />
              <Route path="/demo/health-records" element={<HealthRecordsScreen />} />

              {/* Dedicated ASHA Mobile Module App as a Separate Component */}
              <Route path="/asha" element={<AshaApp />} />
              <Route path="/asha-app" element={<AshaApp />} />
              <Route path="/asha-worker" element={<AshaApp />} />
              <Route path="/asha/mobile" element={<AshaApp />} />
              <Route path="/asha-dashboard" element={<AshaAdminDashboard />} />

              {/* Hospital Admin & Counter Staff Console */}
              <Route path="/admin" element={<RoleShell role="admin" />}>
                <Route index element={<AdminQueue />} />
                <Route path="counters" element={<AdminCounters />} />
                <Route path="missed" element={<AdminMissed />} />
                <Route path="history" element={<AdminHistory />} />
                <Route path="hospitals" element={<AdminHospitals />} />
                <Route path="asha" element={<AshaAdminDashboard />} />
              </Route>

              {/* Ayushman Patient Portal Console (the old layout, kept as it is) */}
              <Route path="/patient" element={<RoleShell role="patient" />}>
                <Route index element={<PatientQueue />} />
                <Route path="family" element={<PatientFamily />} />
                <Route path="access" element={<PatientAccess />} />
              </Route>

              {/* Dedicated Layout for Health and Records (prevents page inside page) */}
              <Route element={<HealthRecordsLayout />}>
                <Route path="/patient/records" element={<PatientRecordsHub />} />
                <Route path="/patient/courses" element={<Navigate to="/patient/records?tab=courses" replace />} />
                <Route path="/patient/referrals" element={<Navigate to="/patient/records?tab=referrals" replace />} />
                <Route path="/patient/history" element={<Navigate to="/patient/records?tab=history" replace />} />
                <Route path="/patient/documents" element={<Navigate to="/patient/records?tab=documents" replace />} />
              </Route>

              <Route path="/doctor" element={<RoleShell role="doctor" />}>
                <Route index element={<DoctorProfile />} />
                <Route path="consultation" element={<DoctorConsultation />} />
                <Route path="serve" element={<DoctorServeEncounter />} />
                <Route path="serve/:tokenId" element={<DoctorServeEncounter />} />
                <Route path="courses" element={<DoctorCourses />} />
                <Route path="referrals" element={<DoctorReferrals />} />
                <Route path="access" element={<DoctorAccess />} />
                <Route path="patients" element={<DoctorPatients />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
