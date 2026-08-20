import React, { useState } from 'react';
import Header from '../common/Header';
import StatsCards from './StatsCards';
import CurrentServing from './CurrentServing';
import QueueTable from './QueueTable';
import QRScannerModal from './QRScannerModal';
import { useQueue } from '../../hooks/useQueue';
import { usePolling } from '../../hooks/usePolling';

export default function AdminDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('adminToken'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const { queue, currentServing, stats, error, fetchQueue, updateStatus, loginAdmin, verifyToken } = useQueue();

  // Only poll if authenticated
  usePolling(() => {
    if (isAuthenticated) {
      fetchQueue();
    }
  }, 5000);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    const success = await loginAdmin(username, password);
    if (success) {
      setIsAuthenticated(true);
      fetchQueue();
    } else {
      setLoginError('Invalid username or password.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
  };

  const handleServe = async (id) => {
    try {
      await updateStatus(id, 'serving');
    } catch (err) {
      alert('Error serving token: ' + err.message);
    }
  };

  const handleComplete = async (id) => {
    try {
      await updateStatus(id, 'completed');
    } catch (err) {
      alert('Error completing token: ' + err.message);
    }
  };

  const handleMiss = async (id) => {
    try {
      await updateStatus(id, 'missed');
    } catch (err) {
      alert('Error marking token as missed: ' + err.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="login-view container">
        <Header subtitle="Clinic Queue Admin Login" />
        <div className="card login-card" style={{ maxWidth: '400px', margin: '3rem auto' }}>
          <h2>Admin Sign In</h2>
          <p>Please enter administrative credentials to access the queue controls.</p>
          
          {loginError && <div className="alert alert-danger">{loginError}</div>}
          
          <form onSubmit={handleLogin} className="token-search-form">
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="username">Username</label>
              <div className="input-group">
                <input 
                  type="text" 
                  id="username" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin" 
                  required 
                />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="password">Password</label>
              <div className="input-group">
                <input 
                  type="password" 
                  id="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  required 
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" style={{ width: '100%' }}>
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  const servingToken = queue.find(t => t.id === currentServing && t.status === 'serving');

  return (
    <div className="admin-dashboard container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <Header subtitle="Admin Control Panel" />
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button 
            className="btn btn-success" 
            onClick={() => setIsScannerOpen(true)}
            style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            📷 Scan Patient QR Code
          </button>
          <button className="btn btn-danger btn-sm" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
      
      {error && <div className="alert alert-danger">{error}</div>}
      
      <StatsCards stats={stats} />

      <div className="admin-grid">
        <div className="admin-main">
          <QueueTable tokens={queue} onServe={handleServe} />
        </div>
        <div className="admin-sidebar">
          <CurrentServing 
            servingToken={servingToken} 
            onComplete={handleComplete} 
            onMiss={handleMiss} 
          />
        </div>
      </div>

      <QRScannerModal 
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onVerify={verifyToken}
      />
    </div>
  );
}
