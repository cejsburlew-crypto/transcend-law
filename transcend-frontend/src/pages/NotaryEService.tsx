import React, { useState } from 'react';
import './NotaryEService.css';

// Step 1: Document Type Selection
export const DocumentTypeSelector: React.FC<{ onSelect: (type: string) => void }> = ({ onSelect }) => {
  const documentTypes = [
    { icon: '📋', name: 'Power of Attorney', description: 'Healthcare or financial POA' },
    { icon: '📝', name: 'Affidavit', description: 'Sworn statement' },
    { icon: '🏠', name: 'Mortgage Documents', description: 'Loan signing documents' },
    { icon: '📄', name: 'General Notarization', description: 'Any document notarization' },
    { icon: '✍️', name: 'Deed', description: 'Property deed' },
    { icon: '📑', name: 'Power of Attorney Acknowledgment', description: 'POA acknowledgment' },
  ];

  return (
    <div className="eservice-container">
      <div className="eservice-header">
        <h1>📋 Online Notary Service</h1>
        <p>Select the document type you need notarized</p>
      </div>

      <div className="document-grid">
        {documentTypes.map(doc => (
          <button
            key={doc.name}
            className="document-card"
            onClick={() => onSelect(doc.name)}
          >
            <div className="doc-icon">{doc.icon}</div>
            <h3>{doc.name}</h3>
            <p>{doc.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
};

// Step 2: Notary Review & Pricing
export const NotaryReviewPage: React.FC<{ documentType: string; onSubmitQuote: (fee: number) => void }> = ({ documentType, onSubmitQuote }) => {
  const [notaryFee, setNotaryFee] = useState(50);
  const serviceFee = Math.round(notaryFee * 0.25 * 100) / 100;
  const total = notaryFee + serviceFee;

  return (
    <div className="eservice-container">
      <div className="notary-review-section">
        <h2>⚖️ Set Your Price</h2>
        <p>Document Type: <strong>{documentType}</strong></p>

        <div className="price-input-section">
          <label>Your Notary Fee:</label>
          <div className="fee-input-group">
            <span className="currency">$</span>
            <input
              type="number"
              value={notaryFee}
              onChange={(e) => setNotaryFee(parseFloat(e.target.value))}
              min="0"
              step="0.50"
              className="fee-input"
            />
          </div>
          <small>Base fee for notarization service</small>
        </div>

        <div className="price-breakdown">
          <div className="breakdown-item">
            <span>Your Fee:</span>
            <span className="amount">${notaryFee.toFixed(2)}</span>
          </div>
          <div className="breakdown-item">
            <span>Transcend Service Fee (25%):</span>
            <span className="amount service-fee">${serviceFee.toFixed(2)}</span>
          </div>
          <div className="breakdown-item total">
            <span>Total Client Will Pay:</span>
            <span className="amount">${total.toFixed(2)}</span>
          </div>
        </div>

        <button className="btn-submit-quote" onClick={() => onSubmitQuote(notaryFee)}>
          Submit Price Quote
        </button>
      </div>
    </div>
  );
};

// Step 3: Client Price Confirmation
export const PriceConfirmationPage: React.FC<{
  documentType: string;
  notaryFee: number;
  serviceFee: number;
  onConfirm: () => void;
}> = ({ documentType, notaryFee, serviceFee, onConfirm }) => {
  const total = notaryFee + serviceFee;

  return (
    <div className="eservice-container">
      <div className="price-confirmation">
        <div className="confirmation-header">
          <h1>💰 Price Confirmation</h1>
          <p>Please review and confirm the total cost</p>
        </div>

        <div className="confirmation-card">
          <div className="document-info">
            <p><strong>Document Type:</strong> {documentType}</p>
          </div>

          <div className="price-table">
            <div className="table-row">
              <span>Notary Service Fee:</span>
              <span className="price">${notaryFee.toFixed(2)}</span>
            </div>
            <div className="table-row">
              <span>Transcend Service Fee:</span>
              <span className="price service-fee">${serviceFee.toFixed(2)}</span>
            </div>
            <div className="table-row total">
              <span>Total Cost:</span>
              <span className="price total-price">${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="terms">
            <input type="checkbox" id="agree-terms" />
            <label htmlFor="agree-terms">
              I agree to proceed with the online notarization at ${total.toFixed(2)}
            </label>
          </div>

          <button className="btn-confirm" onClick={onConfirm}>
            Confirm & Proceed to Notarization
          </button>
        </div>
      </div>
    </div>
  );
};

// Step 4: Notarization Session
export const NotarizationSessionPage: React.FC<{
  documentType: string;
  videoLink: string;
  onComplete: (sheetCount: number) => void;
}> = ({ documentType, videoLink, onComplete }) => {
  const [sheetCount, setSheetCount] = useState(1);

  return (
    <div className="eservice-container">
      <div className="notarization-session">
        <h2>🎥 Online Notarization Session</h2>

        <div className="session-layout">
          <div className="video-section">
            <div className="video-placeholder">
              <p>Video Conference</p>
              <p className="small">{videoLink}</p>
              <button className="btn-join-video">Join Video Call</button>
            </div>
          </div>

          <div className="session-sidebar">
            <div className="document-details">
              <h4>Document Details</h4>
              <p><strong>Type:</strong> {documentType}</p>
              <p><strong>Status:</strong> In Progress</p>
            </div>

            <div className="sheet-counter">
              <h4>Notary Sheets Needed</h4>
              <div className="counter-input">
                <button onClick={() => setSheetCount(Math.max(1, sheetCount - 1))}>−</button>
                <input
                  type="number"
                  value={sheetCount}
                  onChange={(e) => setSheetCount(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                />
                <button onClick={() => setSheetCount(sheetCount + 1)}>+</button>
              </div>
              <small>Total sheets needed: {sheetCount}</small>
            </div>

            <div className="checklist">
              <h4>Notarization Checklist</h4>
              <div className="check-item">
                <input type="checkbox" id="doc-reviewed" defaultChecked />
                <label htmlFor="doc-reviewed">Document reviewed</label>
              </div>
              <div className="check-item">
                <input type="checkbox" id="id-verified" defaultChecked />
                <label htmlFor="id-verified">ID verified</label>
              </div>
              <div className="check-item">
                <input type="checkbox" id="signature-witnessed" />
                <label htmlFor="signature-witnessed">Signature witnessed</label>
              </div>
            </div>

            <button
              className="btn-complete-session"
              onClick={() => onComplete(sheetCount)}
            >
              Complete Notarization
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Step 5: Download & Payment
export const DownloadPaymentPage: React.FC<{
  breakdown: { notaryFee: number; serviceFee: number; extraSheetFee: number; total: number };
  onPaymentComplete: () => void;
}> = ({ breakdown, onPaymentComplete }) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');

  return (
    <div className="eservice-container">
      <div className="download-payment">
        <h1>📥 Download & Payment</h1>

        <div className="payment-layout">
          <div className="payment-section">
            <h2>Payment Details</h2>

            <div className="cost-breakdown">
              <div className="breakdown-row">
                <span>Notary Fee:</span>
                <span>${breakdown.notaryFee.toFixed(2)}</span>
              </div>
              <div className="breakdown-row">
                <span>Service Fee:</span>
                <span>${breakdown.serviceFee.toFixed(2)}</span>
              </div>
              {breakdown.extraSheetFee > 0 && (
                <div className="breakdown-row">
                  <span>Extra Sheets ($2.50 each):</span>
                  <span>${breakdown.extraSheetFee.toFixed(2)}</span>
                </div>
              )}
              <div className="breakdown-row total">
                <span>Total Due:</span>
                <span>${breakdown.total.toFixed(2)}</span>
              </div>
            </div>

            <div className="payment-form">
              <div className="form-group">
                <label>Card Number</label>
                <input
                  type="text"
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Expiry Date</label>
                  <input
                    type="text"
                    placeholder="MM/YY"
                    value={expiry}
                    onChange={(e) => setExpiry(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>CVV</label>
                  <input
                    type="text"
                    placeholder="123"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value)}
                  />
                </div>
              </div>

              <button
                className="btn-pay"
                onClick={onPaymentComplete}
              >
                Pay ${breakdown.total.toFixed(2)} & Download
              </button>
            </div>

            <p className="security-note">🔒 Secure payment powered by Stripe</p>
          </div>

          <div className="download-section">
            <div className="success-message">
              <div className="check-mark">✓</div>
              <h3>Notarization Complete!</h3>
              <p>Your document has been notarized and is ready to download.</p>

              <div className="document-info">
                <p><strong>Document:</strong> Notarized Document.pdf</p>
                <p><strong>Size:</strong> 2.4 MB</p>
                <p><strong>Notary Stamp:</strong> Included</p>
              </div>

              <button className="btn-download" onClick={onPaymentComplete}>
                📥 Download After Payment
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Component - Orchestrates all steps
export const NotaryEService: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [documentType, setDocumentType] = useState('');
  const [notaryFee, setNotaryFee] = useState(50);
  const [videoLink, setVideoLink] = useState('');
  const [breakdown, setBreakdown] = useState({ notaryFee: 0, serviceFee: 0, extraSheetFee: 0, total: 0 });

  const handleDocumentSelect = (type: string) => {
    setDocumentType(type);
    setCurrentStep(2);
  };

  const handleSubmitQuote = (fee: number) => {
    setNotaryFee(fee);
    setCurrentStep(3);
  };

  const handleConfirmPrice = () => {
    setCurrentStep(4);
    setVideoLink(`https://meet.transcend-law.com/session-${Date.now()}`);
  };

  const handleCompleteSession = (sheetCount: number) => {
    const serviceFee = Math.round(notaryFee * 0.25 * 100) / 100;
    const extraSheetFee = Math.max(0, (sheetCount - 1) * 2.50);
    const total = notaryFee + serviceFee + extraSheetFee;

    setBreakdown({ notaryFee, serviceFee, extraSheetFee, total });
    setCurrentStep(5);
  };

  const handlePaymentComplete = () => {
    alert('Payment successful! Download starting...');
    // Trigger actual download
  };

  return (
    <>
      {currentStep === 1 && <DocumentTypeSelector onSelect={handleDocumentSelect} />}
      {currentStep === 2 && (
        <NotaryReviewPage documentType={documentType} onSubmitQuote={handleSubmitQuote} />
      )}
      {currentStep === 3 && (
        <PriceConfirmationPage
          documentType={documentType}
          notaryFee={notaryFee}
          serviceFee={Math.round(notaryFee * 0.25 * 100) / 100}
          onConfirm={handleConfirmPrice}
        />
      )}
      {currentStep === 4 && (
        <NotarizationSessionPage
          documentType={documentType}
          videoLink={videoLink}
          onComplete={handleCompleteSession}
        />
      )}
      {currentStep === 5 && <DownloadPaymentPage breakdown={breakdown} onPaymentComplete={handlePaymentComplete} />}
    </>
  );
};
