import React, { useState, useEffect, useCallback } from 'react';
import { api, downloadFile, formatFileSize, formatDuration, formatDate } from '../utils/api';
import CloudUpload from './CloudUpload';
import './Gallery.css';

function Gallery({ sessionId, onLogout }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [downloadingItems, setDownloadingItems] = useState(new Set());
  const [downloadProgress, setDownloadProgress] = useState({});
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
  const [showCloudUpload, setShowCloudUpload] = useState(false);
  const [filter, setFilter] = useState('all'); // all, video, photo

  const fetchMedia = useCallback(async (page = 1, append = false) => {
    try {
      if (page === 1) setLoading(true);
      else setLoadingMore(true);

      const response = await api.get(`/media?page=${page}&perPage=20`);
      
      if (response.success) {
        if (append) {
          setMedia(prev => [...prev, ...response.media]);
        } else {
          setMedia(response.media);
        }
        setPagination(response.pagination);
      } else {
        setError(response.error || 'Failed to load media');
      }
    } catch (err) {
      setError(err.message || 'Failed to load media');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchMedia(1);
  }, [fetchMedia]);

  const handleSelect = (id) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedItems.size === filteredMedia.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredMedia.map(item => item.id)));
    }
  };

  const handleDownload = async (item) => {
    try {
      setDownloadingItems(prev => new Set(prev).add(item.id));
      setDownloadProgress(prev => ({ ...prev, [item.id]: 0 }));

      await downloadFile(
        item.id,
        item.filename,
        (loaded, total) => {
          const percent = Math.round((loaded / total) * 100);
          setDownloadProgress(prev => ({ ...prev, [item.id]: percent }));
        }
      );
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    } finally {
      setDownloadingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
  };

  const handleBulkDownload = async () => {
    const itemsToDownload = media.filter(item => selectedItems.has(item.id));
    
    for (const item of itemsToDownload) {
      await handleDownload(item);
    }
    
    setSelectedItems(new Set());
  };

  const filteredMedia = media.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'video') return item.mediaType === 'video' || item.duration > 0;
    if (filter === 'photo') return item.mediaType === 'photo' || !item.duration;
    return true;
  });

  const loadMore = () => {
    if (pagination.page < pagination.totalPages) {
      fetchMedia(pagination.page + 1, true);
    }
  };

  if (loading) {
    return (
      <div className="gallery-loading">
        <div className="spinner"></div>
        <p>Loading your media...</p>
      </div>
    );
  }

  return (
    <div className="gallery">
      <header className="gallery-header">
        <div className="header-left">
          <h1>My GoPro Media</h1>
          <span className="media-count">{pagination.total} items</span>
        </div>
        <div className="header-right">
          <button className="btn btn-secondary" onClick={() => setShowCloudUpload(true)}>
            Cloud Upload
          </button>
          <button className="btn btn-danger" onClick={onLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="gallery-toolbar">
        <div className="filter-buttons">
          <button 
            className={filter === 'all' ? 'active' : ''} 
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={filter === 'video' ? 'active' : ''} 
            onClick={() => setFilter('video')}
          >
            Videos
          </button>
          <button 
            className={filter === 'photo' ? 'active' : ''} 
            onClick={() => setFilter('photo')}
          >
            Photos
          </button>
        </div>

        <div className="selection-actions">
          <button className="btn btn-text" onClick={handleSelectAll}>
            {selectedItems.size === filteredMedia.length ? 'Deselect All' : 'Select All'}
          </button>
          
          {selectedItems.size > 0 && (
            <>
              <span className="selected-count">{selectedItems.size} selected</span>
              <button className="btn btn-primary" onClick={handleBulkDownload}>
                Download Selected
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="media-grid">
        {filteredMedia.map(item => (
          <div 
            key={item.id} 
            className={`media-card ${selectedItems.has(item.id) ? 'selected' : ''}`}
          >
            <div className="media-thumbnail" onClick={() => handleSelect(item.id)}>
              {item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt={item.filename} loading="lazy" />
              ) : (
                <div className="no-thumbnail">
                  {item.duration > 0 ? '▶' : '🖼️'}
                </div>
              )}
              {item.duration > 0 && (
                <span className="duration">{formatDuration(item.duration)}</span>
              )}
              <div className="selection-overlay">
                <input 
                  type="checkbox" 
                  checked={selectedItems.has(item.id)}
                  onChange={() => handleSelect(item.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            
            <div className="media-info">
              <p className="filename" title={item.filename}>{item.filename}</p>
              <div className="meta">
                <span>{formatDate(item.createdAt)}</span>
                <span>{formatFileSize(item.fileSize)}</span>
                {item.width && item.height && (
                  <span>{item.width}×{item.height}</span>
                )}
              </div>
            </div>

            <div className="media-actions">
              {downloadingItems.has(item.id) ? (
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${downloadProgress[item.id] || 0}%` }}
                  ></div>
                  <span>{downloadProgress[item.id] || 0}%</span>
                </div>
              ) : (
                <button 
                  className="btn btn-small"
                  onClick={() => handleDownload(item)}
                  title="Download"
                >
                  ⬇️
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {pagination.page < pagination.totalPages && (
        <div className="load-more">
          <button 
            className="btn btn-secondary"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : 'Load More'}
          </button>
        </div>
      )}

      {showCloudUpload && (
        <CloudUpload 
          selectedItems={media.filter(item => selectedItems.has(item.id))}
          onClose={() => setShowCloudUpload(false)}
          onUploadComplete={() => setSelectedItems(new Set())}
        />
      )}
    </div>
  );
}

export default Gallery;
