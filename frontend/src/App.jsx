import React, { useState, useEffect } from 'react';
import AdminDashboard from './components/admin/AdminDashboard';
import PatientView from './components/patient/PatientView';
import Header from './components/common/Header';
import './App.css';

export default function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handleLocationChange);
    // Listen to pushState / replaceState custom events if needed
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Simple Router Logic
  if (currentPath === '/admin' || currentPath === '/admin/') {
    return <AdminDashboard />;
  }

  if (currentPath.startsWith('/patient')) {
    return <PatientView />;
  }

  // Home Page
  return (
    <div className="home-view container">
      <Header subtitle="Welcome to our Clinic Queue" />
      <div className="card home-card">
        <h2>Queue Portal</h2>
        <p>Manage the queue or track your token status live.</p>
        
        <div className="home-actions">
          <button className="btn btn-primary btn-lg" onClick={() => navigateTo('/admin')}>
            Go to Admin Dashboard
          </button>
          
          <div className="divider">OR</div>
          
          <form className="token-search-form" onSubmit={(e) => {
            e.preventDefault();
            const val = e.target.phone.value.trim();
            if (val) {
              navigateTo(`/patient?phone=${val}`);
            }
          }}>
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
                Track Token
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


