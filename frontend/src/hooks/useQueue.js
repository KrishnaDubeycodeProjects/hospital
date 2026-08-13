import { useState, useCallback } from 'react';
import apiClient from '../api/axiosConfig';

export function useQueue() {
  const [queue, setQueue] = useState([]);
  const [currentServing, setCurrentServing] = useState(null);
  const [stats, setStats] = useState({ total: 0, waiting: 0, serving: 0, completed: 0, missed: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/queue');
      if (response.data.success) {
        setQueue(response.data.data.tokens || []);
        setCurrentServing(response.data.data.currentServing);
        setStats(response.data.data.stats || { total: 0, waiting: 0, serving: 0, completed: 0, missed: 0 });
      } else {
        setError('Failed to load queue data');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error connecting to the server');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateStatus = async (id, status) => {
    setError(null);
    try {
      const response = await apiClient.put(`/queue/${id}`, { status });
      if (response.data.success) {
        // Refresh local queue immediately
        await fetchQueue();
        return response.data.data;
      } else {
        setError(`Failed to update status to ${status}`);
        return null;
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error updating token status');
      throw err;
    }
  };

  const getPatientDetails = async (id) => {
    try {
      const response = await apiClient.get(`/queue/token/${id}`);
      if (response.data.success) {
        return response.data.data;
      }
      return null;
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const loginAdmin = async (username, password) => {
    setError(null);
    try {
      const response = await apiClient.post('/queue/login', { username, password });
      if (response.data.success) {
        localStorage.setItem('adminToken', response.data.token);
        return true;
      }
      return false;
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Login failed.');
      return false;
    }
  };

  const verifyToken = async (qrDataOrId) => {
    setError(null);
    try {
      const response = await apiClient.post('/queue/verify', { qrData: qrDataOrId });
      if (response.data.success) {
        await fetchQueue();
        return response.data;
      }
      return null;
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || 'Error verifying token';
      setError(msg);
      throw new Error(msg);
    }
  };

  return {
    queue,
    currentServing,
    stats,
    loading,
    error,
    fetchQueue,
    updateStatus,
    getPatientDetails,
    loginAdmin,
    verifyToken
  };
}
