import React, { useState } from 'react';
import './ClientDocuments.css';

interface ClientDocument {
  id: string;
  name: string;
  type: 'identification' | 'legal' | 'financial' | 'medical' | 'other';
  uploadedAt: string;
  size: string;
  url: string;
  usedInServices: string[];
  shared: boolean;
}

export const ClientDocuments: React.FC = () => {
  const [documents, setDocuments] = useState<ClientDocument[]>([
    {
      id: '1',
      name: 'Passport_Front.pdf',
      type: 'identification',
      uploadedAt: '2026-08-10',
      size: '245 KB',
      url: '#',
      usedInServices: ['Lawyer', 'Notary'],
      shared: true,
    },
    {
      id: '2',
      name: 'Contract_Agreement.pdf',
      type: 'legal',
      uploadedAt: '2026-08-09',
      size: '1.2 MB',
      url: '#',
      usedInServices: ['Lawyer', 'Legal Document Preparer'],
      shared: true,
    },
  ]);

  const [selectedFilter, setSelectedFilter] = useState<'all' | ClientDocument['type']>('all');
  const [dragActive, setDragActive] = useState(false);

  const filteredDocuments = selectedFilter === 'all'
    ? documents
    : documents.filter(doc => doc.type === selectedFilter);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    console.log('Files dropped:', files);
    // TODO: Handle file upload
  };

  const handleDeleteDocument = (id: string) => {
    setDocuments(documents.filter(doc => doc.id !== id));
  };

  const getTypeIcon = (type: ClientDocument['type']) => {
    const icons: Record<ClientDocument['type'], string> = {
      identification: '🆔',
      legal: '⚖️',
      financial: '💰',
      medical: '⚕️',
      other: '📄',
    };
    return icons[type];
  };

  const getTypeLabel = (type: ClientDocument['type']) => {
    const labels: Record<ClientDocument['type'], string> = {
      identification: 'Identification',
      legal: 'Legal Documents',
      financial: 'Financial Documents',
      medical: 'Medical Documents',
      other: 'Other',
    };
    return labels[type];
  };

  return (
    <div className="client-documents-container">
      <div className="documents-header">
        <h2>📁 My Documents</h2>
        <p>All documents you upload are securely stored and can be shared across services and providers.</p>
      </div>

      <div
        className={`documents-upload-area ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="upload-content">
          <span className="upload-icon">📤</span>
          <h3>Upload Documents</h3>
          <p>Drag and drop files here or click to browse</p>
          <input type="file" multiple style={{ display: 'none' }} />
        </div>
      </div>

      <div className="documents-filters">
        <button
          className={`filter-btn ${selectedFilter === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('all')}
        >
          All Documents ({documents.length})
        </button>
        <button
          className={`filter-btn ${selectedFilter === 'identification' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('identification')}
        >
          🆔 Identification ({documents.filter(d => d.type === 'identification').length})
        </button>
        <button
          className={`filter-btn ${selectedFilter === 'legal' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('legal')}
        >
          ⚖️ Legal ({documents.filter(d => d.type === 'legal').length})
        </button>
        <button
          className={`filter-btn ${selectedFilter === 'financial' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('financial')}
        >
          💰 Financial ({documents.filter(d => d.type === 'financial').length})
        </button>
        <button
          className={`filter-btn ${selectedFilter === 'medical' ? 'active' : ''}`}
          onClick={() => setSelectedFilter('medical')}
        >
          ⚕️ Medical ({documents.filter(d => d.type === 'medical').length})
        </button>
      </div>

      <div className="documents-list">
        {filteredDocuments.length === 0 ? (
          <div className="empty-state">
            <p>No documents found. Upload your first document to get started.</p>
          </div>
        ) : (
          filteredDocuments.map(doc => (
            <div key={doc.id} className="document-card">
              <div className="document-icon">
                {getTypeIcon(doc.type)}
              </div>

              <div className="document-info">
                <h4>{doc.name}</h4>
                <p className="document-meta">
                  <span>{getTypeLabel(doc.type)}</span>
                  <span>•</span>
                  <span>{doc.size}</span>
                  <span>•</span>
                  <span>Uploaded {doc.uploadedAt}</span>
                </p>
                <div className="document-services">
                  <span className="services-label">Used in:</span>
                  {doc.usedInServices.map(service => (
                    <span key={service} className="service-tag">
                      {service}
                    </span>
                  ))}
                </div>
              </div>

              <div className="document-actions">
                <button className="action-btn share-btn" title="Share with providers">
                  🔗 Share
                </button>
                <button className="action-btn download-btn" title="Download">
                  ⬇️
                </button>
                <button
                  className="action-btn delete-btn"
                  title="Delete"
                  onClick={() => handleDeleteDocument(doc.id)}
                >
                  🗑️
                </button>
              </div>

              {doc.shared && (
                <div className="shared-badge">✓ Shared</div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="documents-info">
        <div className="info-box">
          <h4>🔒 Your Documents Are Private & Secure</h4>
          <ul>
            <li>All files are encrypted end-to-end</li>
            <li>You control who can access each document</li>
            <li>Documents stay with you across all services</li>
            <li>Service providers can only access documents you explicitly share</li>
            <li>Full audit trail of all document access</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
