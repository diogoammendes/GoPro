import React, { useState } from 'react';
import { api } from '../utils/api';
import './Login.css';

function Login({ onLogin }) {
  const [accessToken, setAccessToken] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', {
        gp_access_token: accessToken.trim(),
        gp_user_id: userId.trim()
      });

      if (response.success) {
        onLogin(response.sessionId);
      } else {
        setError(response.error || 'Login failed');
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">
            <svg viewBox="0 0 24 24" fill="currentColor" className="logo-icon">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
          <h1>GoPro Media Downloader</h1>
          <p>Download your GoPro cloud media in bulk</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="accessToken">GoPro Access Token (gp_access_token)</label>
            <input
              type="text"
              id="accessToken"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="eyJhbG..."
              required
              disabled={loading}
            />
            <small>Starts with eyJhbGc...</small>
          </div>

          <div className="form-group">
            <label htmlFor="userId">GoPro User ID (gp_user_id)</label>
            <input
              type="text"
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Your GoPro user ID"
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner-small"></span>
                Connecting...
              </>
            ) : (
              'Connect to GoPro'
            )}
          </button>
        </form>

        <button 
          className="instructions-toggle"
          onClick={() => setShowInstructions(!showInstructions)}
        >
          {showInstructions ? 'Hide Instructions' : 'How to get your credentials?'}
        </button>

        {showInstructions && (
          <div className="instructions">
            <h3>How to get your GoPro credentials:</h3>
            <ol>
              <li>Open Chrome or Firefox and go to <a href="https://plus.gopro.com/media-library/" target="_blank" rel="noopener noreferrer">plus.gopro.com/media-library/</a></li>
              <li>Sign in to your GoPro account if not already logged in</li>
              <li>Open Developer Tools (F12 or Ctrl+Shift+I)</li>
              <li>Go to the Network tab</li>
              <li>Refresh the page</li>
              <li>Look for a request to <code>user</code> or <code>media</code></li>
              <li>Click on the request and find the Cookies tab</li>
              <li>Copy the values for:
                <ul>
                  <li><code>gp_access_token</code> - the long JWT token</li>
                  <li><code>gp_user_id</code> - your numeric user ID</li>
                </ul>
              </li>
              <li>Paste them above and click Connect</li>
            </ol>
            <p className="note">Your credentials are stored securely and only used to access your GoPro media.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
