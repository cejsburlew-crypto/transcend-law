import React, { useState } from 'react';
import './IdentificationVerification.css';

interface IDDocument {
  type: string;
  frontImage: File | null;
  backImage: File | null;
  frontPreview: string | null;
  backPreview: string | null;
  uploadedAt?: string;
  verified?: boolean;
  verificationMethod?: 'manual' | 'idme';
}

const ID_TYPES = [
  'Passport',
  'Driver\'s License',
  'State ID',
  'National ID Card',
  'Visa/Travel Document',
  'Military ID',
];

export const IdentificationVerification: React.FC = () => {
  const [idDocument, setIdDocument] = useState<IDDocument>({
    type: 'Passport',
    frontImage: null,
    backImage: null,
    frontPreview: null,
    backPreview: null,
  });

  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [idmeStatus, setIdmeStatus] = useState<'not-verified' | 'verifying' | 'verified'>('not-verified');
  const [savedDocuments, setSavedDocuments] = useState<IDDocument[]>([
    {
      type: 'Passport',
      frontImage: null,
      backImage: null,
      frontPreview: null,
      backPreview: null,
      uploadedAt: '2026-08-10',
      verified: true,
      verificationMethod: 'idme',
    },
  ]);

  const handleIDTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setIdDocument({ ...idDocument, type: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, side: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setIdDocument({
          ...idDocument,
          [side === 'front' ? 'frontImage' : 'backImage']: file,
          [side === 'front' ? 'frontPreview' : 'backPreview']: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!idDocument.frontImage || !idDocument.backImage) {
      setUploadStatus('error');
      return;
    }

    setUploadStatus('uploading');

    // Simulate upload delay
    setTimeout(() => {
      const newDocument: IDDocument = {
        ...idDocument,
        uploadedAt: new Date().toISOString().split('T')[0],
        verified: false,
        verificationMethod: 'manual',
      };
      setSavedDocuments([...savedDocuments, newDocument]);
      setUploadStatus('success');
      setIdDocument({
        type: 'Passport',
        frontImage: null,
        backImage: null,
        frontPreview: null,
        backPreview: null,
      });

      setTimeout(() => setUploadStatus('idle'), 3000);
    }, 1500);
  };

  const handleIDmeVerification = async () => {
    setIdmeStatus('verifying');

    // Simulate ID.me verification flow
    // In production, this would redirect to ID.me OAuth
    setTimeout(() => {
      const newDocument: IDDocument = {
        type: 'Government ID (Verified via ID.me)',
        frontImage: null,
        backImage: null,
        frontPreview: null,
        backPreview: null,
        uploadedAt: new Date().toISOString().split('T')[0],
        verified: true,
        verificationMethod: 'idme',
      };
      setSavedDocuments([...savedDocuments, newDocument]);
      setIdmeStatus('verified');

      setTimeout(() => setIdmeStatus('not-verified'), 3000);
    }, 2000);
  };

  return (
    <div className="id-verification-container">
      <div className="verification-options">
        <div className="option-card idme-option">
          <div className="option-header">
            <h3>🆔 ID.me Verification</h3>
            <span className="badge">Government-Backed</span>
          </div>
          <p className="option-description">
            Fast, secure verification using government-backed ID.me. Your identity is verified instantly and you receive a verified badge.
          </p>
          <ul className="option-benefits">
            <li>✓ Instant verification</li>
            <li>✓ Government-grade security (LOA 3)</li>
            <li>✓ Get a verified badge</li>
            <li>✓ Works with legal services</li>
          </ul>
          <button
            className={`idme-btn ${idmeStatus}`}
            onClick={handleIDmeVerification}
            disabled={idmeStatus === 'verifying'}
          >
            {idmeStatus === 'verifying' ? '⏳ Verifying...' : idmeStatus === 'verified' ? '✓ Verified' : '🔗 Verify with ID.me'}
          </button>
        </div>

        <div className="option-divider">OR</div>

        <div className="option-card manual-option">
          <div className="option-header">
            <h3>📋 Manual Upload</h3>
            <span className="badge">Self-Verify</span>
          </div>
          <p className="option-description">
            Upload front and back of your government-issued ID for manual verification by our team.
          </p>
          <ul className="option-benefits">
            <li>✓ Verify at your own pace</li>
            <li>✓ Works with any government ID</li>
            <li>✓ Keep full privacy control</li>
            <li>✓ Verified within 24 hours</li>
          </ul>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
            (Scroll down to upload documents)
          </div>
        </div>
      </div>

      <div className="id-section">
        <h3>📋 Add Identification Document</h3>
        <p className="section-description">Upload a valid government-issued ID for verification. We accept passports, driver's licenses, and state IDs.</p>

        <div className="id-form">
          <div className="form-group">
            <label>ID Type *</label>
            <select value={idDocument.type} onChange={handleIDTypeChange} className="id-type-select">
              {ID_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="upload-section">
            <div className="upload-group">
              <label>Front of ID *</label>
              <div className="upload-area">
                {idDocument.frontPreview ? (
                  <div className="image-preview">
                    <img src={idDocument.frontPreview} alt="Front of ID" />
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() =>
                        setIdDocument({ ...idDocument, frontImage: null, frontPreview: null })
                      }
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="file-input-label">
                    <span className="upload-icon">📸</span>
                    <span className="upload-text">Click to upload or drag and drop</span>
                    <span className="upload-hint">PNG, JPG, or PDF (Max 5MB)</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, 'front')}
                      className="file-input"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="upload-group">
              <label>Back of ID *</label>
              <div className="upload-area">
                {idDocument.backPreview ? (
                  <div className="image-preview">
                    <img src={idDocument.backPreview} alt="Back of ID" />
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => setIdDocument({ ...idDocument, backImage: null, backPreview: null })}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <label className="file-input-label">
                    <span className="upload-icon">📸</span>
                    <span className="upload-text">Click to upload or drag and drop</span>
                    <span className="upload-hint">PNG, JPG, or PDF (Max 5MB)</span>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileChange(e, 'back')}
                      className="file-input"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              className="submit-btn"
              onClick={handleSubmit}
              disabled={uploadStatus === 'uploading' || !idDocument.frontImage || !idDocument.backImage}
            >
              {uploadStatus === 'uploading' ? '⏳ Uploading...' : uploadStatus === 'success' ? '✓ Uploaded' : 'Upload Document'}
            </button>
          </div>

          {uploadStatus === 'error' && <p className="error-message">Please upload both front and back of ID</p>}
          {uploadStatus === 'success' && (
            <p className="success-message">✓ ID document uploaded successfully! Verification pending.</p>
          )}
        </div>
      </div>

      <div className="id-section saved-documents">
        <h3>📚 Saved Identification Documents</h3>
        <p className="section-description">Your verified documents for quick use in future processes.</p>

        {savedDocuments.length === 0 ? (
          <p className="empty-state">No documents uploaded yet. Upload your first ID to get started.</p>
        ) : (
          <div className="documents-list">
            {savedDocuments.map((doc, index) => (
              <div key={index} className={`document-card ${doc.verified ? 'verified' : 'pending'}`}>
                <div className="document-header">
                  <h4>{doc.type}</h4>
                  <span className={`status-badge ${doc.verified ? 'verified' : 'pending'}`}>
                    {doc.verified ? '✓ Verified' : '⏳ Pending'}
                  </span>
                </div>
                <p className="upload-date">Uploaded: {doc.uploadedAt}</p>

                <div className="document-images">
                  <div className="image-container">
                    <label>Front</label>
                    {doc.frontPreview ? (
                      <img src={doc.frontPreview} alt="Front" className="document-image" />
                    ) : (
                      <div className="image-placeholder">Front</div>
                    )}
                  </div>
                  <div className="image-container">
                    <label>Back</label>
                    {doc.backPreview ? (
                      <img src={doc.backPreview} alt="Back" className="document-image" />
                    ) : (
                      <div className="image-placeholder">Back</div>
                    )}
                  </div>
                </div>

                <div className="document-actions">
                  <button className="action-btn primary-btn">Use This ID</button>
                  <button className="action-btn secondary-btn">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="security-notice">
        <p>
          🔒 <strong>Your information is secure.</strong> All documents are encrypted and stored securely. We never share your personal information without your consent. Your ID documents comply with KYC/AML regulations.
        </p>
      </div>
    </div>
  );
};
