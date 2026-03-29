import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import './CloudUpload.css';

function CloudUpload({ selectedItems, onClose, onUploadComplete }) {
  const [activeTab, setActiveTab] = useState('google');
  const [googleAuthUrl, setGoogleAuthUrl] = useState('');
  const [savedCredentials, setSavedCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  
  // iCloud form state
  const [icloudUsername, setIcloudUsername] = useState('');
  const [icloudPassword, setIcloudPassword] = useState('');
  const [icloudServerUrl, setIcloudServerUrl] = useState('https://webdav.icloud.com');

  useEffect(() => {
    fetchCredentials();
  }, []);

  const fetchCredentials = async () => {
    try {
      const response = await api.get('/cloud/credentials');
      if (response.success) {
        setSavedCredentials(response.credentials);
      }
    } catch (error) {
      console.error('Failed to fetch credentials:', error);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const response = await api.get('/cloud/google/auth');
      if (response.authUrl) {
        window.open(response.authUrl, '_blank');
        setMessage('Google auth opened. Return here after authorization.');
      }
    } catch (error) {
      setMessage('Failed to initiate Google auth: ' + error.message);
    }
  };

  const handleIcloudConnect = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await api.post('/cloud/icloud/connect', {
        username: icloudUsername,
        password: icloudPassword,
        serverUrl: icloudServerUrl
      });

      if (response.success) {
        setMessage('iCloud connected successfully!');
        fetchCredentials();
      } else {
        setMessage('Failed to connect: ' + response.error);
      }
    } catch (error) {
      setMessage('Error: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (credentialsId) => {
    setLoading(true);
    setMessage(`Starting upload of ${selectedItems.length} items...`);

    // This would be implemented with the actual upload logic
    // For now, we show the UI structure
    setTimeout(() => {
      setMessage('Upload feature - implement server-side streaming upload');
      setLoading(false);
    }, 1000);
  };

  const handleDeleteCredentials = async (id) => {
    try {
      await api.delete(`/cloud/credentials/${id}`);
      fetchCredentials();
    } catch (error) {
      setMessage('Failed to remove credentials: ' + error.message);
    }
  };

  const googleCreds = savedCredentials.filter(c => c.provider === 'google');
  const icloudCreds = savedCredentials.filter(c => c.provider === 'icloud');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content cloud-upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Cloud Upload</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="selected-summary">
          <p>{selectedItems.length} items selected for upload</p>
        </div>

        <div className="tabs">
          <button 
            className={activeTab === 'google' ? 'active' : ''}
            onClick={() => setActiveTab('google')}
          >
            Google Drive
          </button>
          <button 
            className={activeTab === 'icloud' ? 'active' : ''}
            onClick={() => setActiveTab('icloud')}
          >
            iCloud
          </button>
          <button 
            className={activeTab === 'saved' ? 'active' : ''}
            onClick={() => setActiveTab('saved')}
          >
            Saved Connections
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'google' && (
            <div className="google-tab">
              <h3>Connect Google Drive</h3>
              <p>Upload your selected media directly to Google Drive</p>
              
              <button 
                className="btn btn-primary"
                onClick={handleGoogleAuth}
                disabled={loading}
              >
                Connect Google Drive
              </button>

              {googleCreds.length > 0 && (
                <div className="saved-accounts">
                  <h4>Saved Google Accounts</h4>
                  {googleCreds.map(cred => (
                    <div key={cred.id} className="account-item">
                      <span>Connected Account</span>
                      <button 
                        className="btn btn-small btn-danger"
                        onClick={() => handleDeleteCredentials(cred.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'icloud' && (
            <div className="icloud-tab">
              <h3>Connect iCloud Drive</h3>
              <form onSubmit={handleIcloudConnect}>
                <div className="form-group">
                  <label>Apple ID / iCloud Username</label>
                  <input
                    type="email"
                    value={icloudUsername}
                    onChange={(e) => setIcloudUsername(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>App-Specific Password</label>
                  <input
                    type="password"
                    value={icloudPassword}
                    onChange={(e) => setIcloudPassword(e.target.value)}
                    placeholder="xxxx-xxxx-xxxx-xxxx"
                    required
                  />
                  <small>
                    Generate an app-specific password at 
                    <a href="https://appleid.apple.com" target="_blank" rel="noopener noreferrer">
                      appleid.apple.com
                    </a>
                  </small>
                </div>

                <div className="form-group">
                  <label>WebDAV Server URL (optional)</label>
                  <input
                    type="url"
                    value={icloudServerUrl}
                    onChange={(e) => setIcloudServerUrl(e.target.value)}
                    placeholder="https://webdav.icloud.com"
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Connecting...' : 'Connect iCloud'}
                </button>
              </form>

              {icloudCreds.length > 0 && (
                <div className="saved-accounts">
                  <h4>Saved iCloud Accounts</h4>
                  {icloudCreds.map(cred => (
                    <div key={cred.id} className="account-item">
                      <span>iCloud Account</span>
                      <button 
                        className="btn btn-small btn-danger"
                        onClick={() => handleDeleteCredentials(cred.id)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'saved' && (
            <div className="saved-tab">
              <h3>Saved Cloud Connections</h3>
              
              {savedCredentials.length === 0 ? (
                <p className="no-credentials">No saved cloud connections. Connect Google Drive or iCloud first.</p>
              ) : (
                <div className="credentials-list">
                  {savedCredentials.map(cred => (
                    <div key={cred.id} className="credential-card">
                      <div className="credential-info">
                        <span className={`provider-badge ${cred.provider}`}>
                          {cred.provider === 'google' ? 'Google Drive' : 'iCloud'}
                        </span>
                        <span className="created-date">
                          Added {new Date(cred.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="credential-actions">
                        <button 
                          className="btn btn-primary"
                          onClick={() => handleUpload(cred.id)}
                          disabled={loading || selectedItems.length === 0}
                        >
                          Upload {selectedItems.length} Items
                        </button>
                        <button 
                          className="btn btn-small btn-danger"
                          onClick={() => handleDeleteCredentials(cred.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {message && <div className="message">{message}</div>}
      </div>
    </div>
  );
}

export default CloudUpload;
