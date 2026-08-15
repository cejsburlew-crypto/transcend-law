import React, { useState, useEffect, useRef } from 'react';
import './SignatureAudit.css';
import { SignatureAttempt, SignerBehavior, CertificateOfAuthenticity } from '../types/audit';

interface SignatureAuditProps {
  documentId: string;
  signerId: string;
  onSignatureStateChange?: (state: SignatureState) => void;
  onBehaviorTracking?: (behavior: BehaviorData) => void;
}

interface SignatureState {
  status: 'idle' | 'reviewing' | 'signing' | 'pending' | 'rejected' | 'completed';
  currentAttemptId?: string;
  rejectionReason?: string;
}

interface BehaviorData {
  cursorMovements: CursorMovement[];
  scrollEvents: ScrollEvent[];
  interactionEvents: InteractionEvent[];
  timeSpentMs: number;
  focusLossCount: number;
  copyAttempts: number;
  printAttempts: number;
  rightClickAttempts: number;
}

interface CursorMovement {
  timestamp: Date;
  x: number;
  y: number;
}

interface ScrollEvent {
  timestamp: Date;
  position: number;
  direction: string;
}

interface InteractionEvent {
  timestamp: Date;
  type: string;
  description: string;
}

/**
 * Enhanced E-Signature Audit Component
 * Tracks and records all signer behavior for legal compliance
 */
const SignatureAudit: React.FC<SignatureAuditProps> = ({
  documentId,
  signerId,
  onSignatureStateChange,
  onBehaviorTracking,
}) => {
  const [signatureState, setSignatureState] = useState<SignatureState>({
    status: 'idle',
  });

  const [auditData, setAuditData] = useState<any>(null);
  const [certificate, setCertificate] = useState<CertificateOfAuthenticity | null>(null);
  const [behaviorData, setBehaviorData] = useState<BehaviorData>({
    cursorMovements: [],
    scrollEvents: [],
    interactionEvents: [],
    timeSpentMs: 0,
    focusLossCount: 0,
    copyAttempts: 0,
    printAttempts: 0,
    rightClickAttempts: 0,
  });

  const [isTracking, setIsTracking] = useState(false);
  const [exportingAudit, setExportingAudit] = useState(false);
  const [auditLog, setAuditLog] = useState<string[]>([]);

  const documentContainerRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<Date>(new Date());
  const focusLossCountRef = useRef(0);
  const cursorPositionRef = useRef({ x: 0, y: 0 });

  /**
   * Initialize behavior tracking
   */
  useEffect(() => {
    if (!documentContainerRef.current) return;

    const container = documentContainerRef.current;
    const startTracking = () => {
      setIsTracking(true);
      addAuditLog('Document review started');
      setSignatureState((prev) => ({ ...prev, status: 'reviewing' }));
    };

    const stopTracking = () => {
      setIsTracking(false);
      addAuditLog('Document review ended');
    };

    container.addEventListener('mouseenter', startTracking);
    container.addEventListener('mouseleave', stopTracking);

    return () => {
      container.removeEventListener('mouseenter', startTracking);
      container.removeEventListener('mouseleave', stopTracking);
    };
  }, []);

  /**
   * Track cursor movements
   */
  useEffect(() => {
    if (!isTracking) return;

    const handleMouseMove = (e: MouseEvent) => {
      cursorPositionRef.current = { x: e.clientX, y: e.clientY };

      setBehaviorData((prev) => ({
        ...prev,
        cursorMovements: [
          ...prev.cursorMovements,
          {
            timestamp: new Date(),
            x: e.clientX,
            y: e.clientY,
          },
        ],
      }));
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [isTracking]);

  /**
   * Track scroll events
   */
  useEffect(() => {
    if (!isTracking || !documentContainerRef.current) return;

    const container = documentContainerRef.current;
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      const position = target.scrollTop || 0;

      setBehaviorData((prev) => ({
        ...prev,
        scrollEvents: [
          ...prev.scrollEvents,
          {
            timestamp: new Date(),
            position,
            direction: 'down', // Could be enhanced with directional tracking
          },
        ],
      }));
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [isTracking]);

  /**
   * Track user interactions (clicks, keyboard, etc.)
   */
  useEffect(() => {
    if (!isTracking) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      setBehaviorData((prev) => ({
        ...prev,
        interactionEvents: [
          ...prev.interactionEvents,
          {
            timestamp: new Date(),
            type: 'click',
            description: `Clicked on ${target.tagName}`,
          },
        ],
      }));

      addAuditLog(`User interaction: Click on ${target.tagName}`);
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      setBehaviorData((prev) => ({
        ...prev,
        interactionEvents: [
          ...prev.interactionEvents,
          {
            timestamp: new Date(),
            type: 'keypress',
            description: `Key pressed: ${e.key}`,
          },
        ],
      }));
    };

    const handleCopy = (e: ClipboardEvent) => {
      setBehaviorData((prev) => ({
        ...prev,
        copyAttempts: prev.copyAttempts + 1,
      }));
      addAuditLog('Copy attempt detected');
    };

    const handlePrint = () => {
      setBehaviorData((prev) => ({
        ...prev,
        printAttempts: prev.printAttempts + 1,
      }));
      addAuditLog('Print attempt detected');
    };

    const handleContextMenu = (e: MouseEvent) => {
      setBehaviorData((prev) => ({
        ...prev,
        rightClickAttempts: prev.rightClickAttempts + 1,
      }));
      addAuditLog('Right-click attempt detected');
      e.preventDefault(); // Prevent default context menu
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('keypress', handleKeyPress);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('beforeprint', handlePrint);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keypress', handleKeyPress);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('beforeprint', handlePrint);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [isTracking]);

  /**
   * Track focus loss events
   */
  useEffect(() => {
    const handleFocus = () => {
      addAuditLog('Document focus regained');
    };

    const handleBlur = () => {
      focusLossCountRef.current++;
      setBehaviorData((prev) => ({
        ...prev,
        focusLossCount: focusLossCountRef.current,
      }));
      addAuditLog('Document focus lost');
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  /**
   * Calculate time spent on document
   */
  useEffect(() => {
    if (!isTracking) return;

    const interval = setInterval(() => {
      const elapsedMs = new Date().getTime() - startTimeRef.current.getTime();
      setBehaviorData((prev) => ({
        ...prev,
        timeSpentMs: elapsedMs,
      }));
    }, 1000);

    return () => clearInterval(interval);
  }, [isTracking]);

  /**
   * Add entry to audit log
   */
  const addAuditLog = (message: string) => {
    setAuditLog((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  };

  /**
   * Initiate signature process
   */
  const handleSignature = async () => {
    setSignatureState((prev) => ({ ...prev, status: 'signing' }));
    addAuditLog('Signature process initiated');

    try {
      const response = await fetch('/api/signatures/attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          signerId,
          behaviorData,
          status: 'pending',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate signature');
      }

      const { attemptId } = await response.json();
      setSignatureState((prev) => ({ ...prev, currentAttemptId: attemptId }));
      addAuditLog(`Signature attempt created: ${attemptId}`);

      onBehaviorTracking?.(behaviorData);
    } catch (error) {
      console.error('Signature error:', error);
      setSignatureState((prev) => ({
        ...prev,
        status: 'rejected',
        rejectionReason: 'Failed to initiate signature process',
      }));
      addAuditLog(`Signature error: ${error}`);
    }
  };

  /**
   * Complete signature
   */
  const handleCompleteSignature = async () => {
    if (!signatureState.currentAttemptId) return;

    try {
      const response = await fetch('/api/signatures/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId: signatureState.currentAttemptId,
          behaviorData,
          timestamp: new Date().toISOString(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete signature');
      }

      const { certificate } = await response.json();
      setCertificate(certificate);
      setSignatureState((prev) => ({ ...prev, status: 'completed' }));
      addAuditLog('Signature completed successfully');
      onSignatureStateChange?.(signatureState);
    } catch (error) {
      console.error('Completion error:', error);
      setSignatureState((prev) => ({
        ...prev,
        status: 'rejected',
        rejectionReason: String(error),
      }));
      addAuditLog(`Completion error: ${error}`);
    }
  };

  /**
   * Reject signature
   */
  const handleRejectSignature = () => {
    setSignatureState((prev) => ({
      ...prev,
      status: 'rejected',
      rejectionReason: 'User cancelled signature',
    }));
    addAuditLog('Signature rejected by user');
  };

  /**
   * Export audit trail for legal proceedings
   */
  const handleExportAudit = async () => {
    if (!signatureState.currentAttemptId) {
      alert('No signature attempt to export');
      return;
    }

    setExportingAudit(true);
    addAuditLog('Exporting audit trail for legal proceedings');

    try {
      const response = await fetch(`/api/signatures/audit/export/${signatureState.currentAttemptId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to export audit trail');
      }

      const auditExport = await response.json();
      setAuditData(auditExport);

      // Download as JSON file
      const element = document.createElement('a');
      element.setAttribute('href', `data:text/plain;charset=utf-8,${encodeURIComponent(JSON.stringify(auditExport, null, 2))}`);
      element.setAttribute('download', `audit-trail-${signatureState.currentAttemptId}.json`);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      addAuditLog('Audit trail exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      alert(`Export failed: ${error}`);
      addAuditLog(`Export error: ${error}`);
    } finally {
      setExportingAudit(false);
    }
  };

  /**
   * Display certificate of authenticity
   */
  const renderCertificate = () => {
    if (!certificate) return null;

    return (
      <div className="signature-certificate">
        <div className="certificate-header">
          <h2>Certificate of Authenticity</h2>
          <span className="compliance-badge">eIDAS & ESIGN Compliant</span>
        </div>

        <div className="certificate-content">
          <div className="certificate-section">
            <label>Certificate ID:</label>
            <code>{certificate.certificateId}</code>
          </div>

          <div className="certificate-section">
            <label>Issued At:</label>
            <span>{new Date(certificate.issuedAt).toLocaleString()}</span>
          </div>

          <div className="certificate-section">
            <label>Expires At:</label>
            <span>{certificate.expiresAt ? new Date(certificate.expiresAt).toLocaleString() : 'N/A'}</span>
          </div>

          <div className="certificate-section">
            <label>Signature Algorithm:</label>
            <span>{certificate.signatureAlgorithm}</span>
          </div>

          <div className="certificate-section">
            <label>Timestamp Authority:</label>
            <span>{certificate.timestampAuthority}</span>
          </div>

          <div className="certificate-section">
            <label>Legal Framework:</label>
            <p className="legal-framework">{certificate.legalFramework}</p>
          </div>

          <div className="certificate-section">
            <label>Signature:</label>
            <code className="signature-code">{certificate.signature}</code>
          </div>
        </div>

        <div className="certificate-footer">
          <p>This certificate is legally binding under eIDAS and ESIGN standards.</p>
        </div>
      </div>
    );
  };

  /**
   * Display audit log
   */
  const renderAuditLog = () => {
    return (
      <div className="audit-log-container">
        <h3>Audit Log</h3>
        <div className="audit-log-entries">
          {auditLog.map((entry, idx) => (
            <div key={idx} className="audit-log-entry">
              {entry}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * Display behavior analytics
   */
  const renderBehaviorAnalytics = () => {
    const timeMinutes = (behaviorData.timeSpentMs / 1000 / 60).toFixed(2);

    return (
      <div className="behavior-analytics">
        <h3>Signer Behavior Analysis</h3>
        <div className="analytics-grid">
          <div className="analytics-item">
            <label>Time Spent Reviewing</label>
            <span>{timeMinutes} minutes</span>
          </div>

          <div className="analytics-item">
            <label>Cursor Movements</label>
            <span>{behaviorData.cursorMovements.length}</span>
          </div>

          <div className="analytics-item">
            <label>Scroll Events</label>
            <span>{behaviorData.scrollEvents.length}</span>
          </div>

          <div className="analytics-item">
            <label>Interactions</label>
            <span>{behaviorData.interactionEvents.length}</span>
          </div>

          <div className="analytics-item">
            <label>Focus Losses</label>
            <span>{behaviorData.focusLossCount}</span>
          </div>

          <div className="analytics-item">
            <label>Copy Attempts</label>
            <span>{behaviorData.copyAttempts}</span>
          </div>

          <div className="analytics-item">
            <label>Print Attempts</label>
            <span>{behaviorData.printAttempts}</span>
          </div>

          <div className="analytics-item">
            <label>Right-Click Attempts</label>
            <span>{behaviorData.rightClickAttempts}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="signature-audit-container">
      <div className="audit-header">
        <h1>E-Signature Audit Trail</h1>
        <span className={`status-badge status-${signatureState.status}`}>
          {signatureState.status.toUpperCase()}
        </span>
      </div>

      <div className="document-container" ref={documentContainerRef}>
        <div className="tracking-indicator">
          {isTracking && (
            <span className="tracking-active">
              <span className="pulse"></span> Tracking active
            </span>
          )}
        </div>
      </div>

      {renderBehaviorAnalytics()}
      {renderAuditLog()}

      <div className="signature-actions">
        {signatureState.status === 'reviewing' && (
          <>
            <button
              className="btn btn-primary"
              onClick={handleSignature}
            >
              Initiate Signature
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleRejectSignature}
            >
              Cancel
            </button>
          </>
        )}

        {signatureState.status === 'signing' && (
          <>
            <button
              className="btn btn-primary"
              onClick={handleCompleteSignature}
            >
              Complete Signature
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleRejectSignature}
            >
              Reject
            </button>
          </>
        )}

        {signatureState.status === 'completed' && (
          <>
            <button
              className="btn btn-success"
              disabled
            >
              ✓ Signature Completed
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleExportAudit}
              disabled={exportingAudit}
            >
              {exportingAudit ? 'Exporting...' : 'Export Audit Trail'}
            </button>
          </>
        )}

        {signatureState.status === 'rejected' && (
          <div className="rejection-notice">
            <p>Signature Rejected: {signatureState.rejectionReason}</p>
            <button
              className="btn btn-secondary"
              onClick={() => setSignatureState({ status: 'reviewing' })}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {renderCertificate()}

      {auditData && (
        <div className="export-info">
          <h3>Export Information</h3>
          <p><strong>Export ID:</strong> {auditData.exportId}</p>
          <p><strong>Verification Code:</strong> {auditData.verificationCode}</p>
          <p className="legal-disclaimer">{auditData.legalDisclaimer}</p>
        </div>
      )}
    </div>
  );
};

export default SignatureAudit;
