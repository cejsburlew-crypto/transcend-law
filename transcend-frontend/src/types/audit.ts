/**
 * Type definitions for Enhanced E-Signature Audit Trail
 * eIDAS and ESIGN compliance standards
 */

export interface SignatureAttempt {
  id: string;
  signerId: string;
  documentId: string;
  timestamp: Date;
  ipAddress: string;
  deviceFingerprint: string;
  gpsLocation?: GPSLocation;
  userAgent: string;
  status: 'success' | 'rejected' | 'pending' | 'cancelled';
  rejectionReason?: string;
  signatureHash: string;
  certificateHash: string;
  chainOfCustodyHash: string;
  immutabilityProof: string;
}

export interface GPSLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: Date;
}

export interface SignerBehavior {
  signatureAttemptId: string;
  cursorMovements: CursorMovement[];
  scrollEvents: ScrollEvent[];
  timeSpentReviewingMs: number;
  documentViewport: DocumentViewport;
  interactionEvents: InteractionEvent[];
  focusLossEvents: number;
  copyAttempts: number;
  printAttempts: number;
  rightClickAttempts: number;
}

export interface CursorMovement {
  timestamp: Date;
  x: number;
  y: number;
  pageX: number;
  pageY: number;
}

export interface ScrollEvent {
  timestamp: Date;
  position: number;
  direction: 'up' | 'down' | 'left' | 'right';
  speed: number;
}

export interface InteractionEvent {
  timestamp: Date;
  type: 'click' | 'focus' | 'blur' | 'keypress' | 'paste';
  elementId: string;
  description: string;
}

export interface DocumentViewport {
  width: number;
  height: number;
  pages: number;
}

export interface CertificateOfAuthenticity {
  certificateId: string;
  signatureAttemptId: string;
  issuedAt: Date;
  expiresAt?: Date;
  signerId: string;
  documentHash: string;
  signatureAlgorithm: string;
  timestampAuthority: string;
  publicKey: string;
  certificateChain: string[];
  signature: string;
  eIDASCompliant: boolean;
  eSIGNCompliant: boolean;
  legalFramework: string;
}

export interface ChainOfCustodyRecord {
  sequenceNumber: number;
  timestamp: Date;
  actor: string;
  action: string;
  location?: string;
  hash: string;
  previousHash: string;
}

export interface AuditExport {
  exportId: string;
  exportedAt: Date;
  exportedBy: string;
  signatureAttempt: SignatureAttempt;
  signerBehavior: SignerBehavior;
  certificate: CertificateOfAuthenticity;
  chainOfCustody: ChainOfCustodyRecord[];
  legalDisclaimer: string;
  verificationCode: string;
  exportSignature: string;
}

export interface SignatureAuditRequest {
  documentId: string;
  signerId: string;
  behaviorData?: SignerBehavior;
  status: 'success' | 'rejected' | 'pending' | 'cancelled';
  rejectionReason?: string;
}

export interface SignatureAuditResponse {
  attemptId: string;
  certificate?: CertificateOfAuthenticity;
  status: 'success' | 'rejected' | 'pending' | 'cancelled';
  message: string;
}

export interface AuditTrailExportRequest {
  signatureAttemptId: string;
  includeChainOfCustody?: boolean;
  includeBehaviorData?: boolean;
  format?: 'json' | 'pdf';
}

export interface DeviceFingerprintData {
  userAgent: string;
  acceptLanguage: string;
  acceptEncoding: string;
  timezone: string;
  screenResolution: string;
  colorDepth: number;
  hardwareConcurrency: number;
  deviceMemory: number;
}

export interface SignatureCompleteRequest {
  attemptId: string;
  behaviorData: SignerBehavior;
  timestamp: string;
}

export interface CertificateVerificationResult {
  isValid: boolean;
  certificateId: string;
  expiresAt: Date;
  issuer: string;
  eIDASCompliant: boolean;
  eSIGNCompliant: boolean;
  chainValid: boolean;
  revokedStatus: boolean;
}

export interface AuditTrailComplianceReport {
  documentId: string;
  signatureAttemptId: string;
  complianceStatus: 'compliant' | 'non-compliant' | 'partial';
  eIDASCompliance: boolean;
  eSIGNCompliance: boolean;
  auditTrailIntegrity: boolean;
  chainOfCustodyValid: boolean;
  certificateValid: boolean;
  issues: ComplianceIssue[];
  generatedAt: Date;
}

export interface ComplianceIssue {
  code: string;
  severity: 'error' | 'warning' | 'info';
  description: string;
  recommendation: string;
}
