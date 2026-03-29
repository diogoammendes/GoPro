import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Gallery from './components/Gallery';
import { api } from './utils/api';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState(localStorage.getItem('gopro_session_id'));

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/auth/status');
      setIsAuthenticated(response.authenticated);
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (newSessionId) => {
    localStorage.setItem('gopro_session_id', newSessionId);
    setSessionId(newSessionId);
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('gopro_session_id');
      setSessionId(null);
      setIsAuthenticated(false);
    }
  };

  if (loading) {
    return (
      <div className="app loading">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="app">
      {!isAuthenticated ? (
        <Login onLogin={handleLogin} />
      ) : (
        <Gallery sessionId={sessionId} onLogout={handleLogout} />
      )}
    </div>
  );
}

export default App;
