import React, { useState, useEffect } from 'react';
import Header from '../common/Header';
import TokenDisplay from './TokenDisplay';
import QueuePosition from './QueuePosition';
import QueueVisual from './QueueVisual';
import { useQueue } from '../../hooks/useQueue';
import { usePolling } from '../../hooks/usePolling';
import apiClient from '../../api/axiosConfig';

export default function PatientView() {
  const urlParams = new URLSearchParams(window.location.search);
  const phoneParam = urlParams.get('phone');
  const pathId = window.location.pathname.split('/').pop();
  const id = window.__mockTokenId || (pathId !== 'patient' ? pathId : null);

  const { queue, currentServing, fetchQueue } = useQueue();
  const [patientToken, setPatientToken] = useState(null);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [errorPatient, setErrorPatient] = useState(null);

  // Poll full queue data
  usePolling(fetchQueue, 5000);

  // Fetch patient token details (either by phone search or token ID)
  const fetchPatientDetails = async () => {
    try {
      let response;
      if (phoneParam) {
        response = await apiClient.get(`/queue/position/${phoneParam}`);
      } else if (id) {
        response = await apiClient.get(`/queue/token/${id}`);
      } else {
        setLoadingPatient(false);
        setErrorPatient('Please enter your phone number to check your token.');
        return;
      }

      if (response.data.success) {
        setPatientToken(response.data.data);
        setErrorPatient(null);
      }
    } catch (err) {
      console.error(err);
      setErrorPatient(err.response?.data?.message || 'No active token found.');
    } finally {
      setLoadingPatient(false);
    }
  };

  // Poll patient details
  usePolling(fetchPatientDetails, 5000);

  if (loadingPatient && !patientToken) {
    return (
      <div className="patient-view container loading-state">
        <Header subtitle="Loading your token details..." />
        <div className="spinner"></div>
      </div>
    );
  }

  const servingToken = queue.find(t => t.id === currentServing && t.status === 'serving');

  return (
    <div className="patient-view container">
      <Header subtitle="Live Patient Queue Tracker" />

      {errorPatient ? (
        <div className="card home-card" style={{ maxWidth: '400px', margin: '2rem auto', textAlign: 'center' }}>
          <h3>Track Your Token</h3>
          <p style={{ color: 'var(--status-missed)', fontWeight: '600', margin: '0.5rem 0' }}>{errorPatient}</p>
          
          <form className="token-search-form" onSubmit={(e) => {
            e.preventDefault();
            const val = e.target.phone.value.trim();
            if (val) {
              window.location.search = `?phone=${val}`;
            }
          }} style={{ marginTop: '1.5rem' }}>
            <label htmlFor="phone">Enter Phone Number:</label>
            <div className="input-group">
              <input 
                type="text" 
                id="phone" 
                name="phone" 
                placeholder="e.g. 918850934544" 
                required 
              />
              <button type="submit" className="btn btn-success">
                Search
              </button>
            </div>
          </form>
          <p className="tip" style={{ marginTop: '1.5rem', fontSize: '0.85rem', color: 'var(--text-light)' }}>
            💡 Send "Hi" or "7" to our WhatsApp Bot to get your token details directly.
          </p>
        </div>
      ) : (
        <div className="patient-grid">
          {/* Active Serving Card */}
          <div className="current-serving-banner card">
            <div className="banner-label">CURRENTLY SERVING</div>
            <div className="banner-value">
              {servingToken ? `#${servingToken.id} - ${servingToken.name}` : 'None'}
            </div>
          </div>

          <div className="patient-main">
            <TokenDisplay token={patientToken} />
            <QueuePosition token={patientToken} currentServing={currentServing} />
          </div>

          <div className="patient-sidebar">
            <QueueVisual tokens={queue} currentTokenId={patientToken?.id} />
          </div>

          <div className="patient-footer-tips">
            <p>🔄 Auto-refreshes every 5 seconds</p>
            <p>💡 Need help? Send "7" or "Status" on WhatsApp to get this info directly.</p>
          </div>
        </div>
      )}
    </div>
  );
}
