# Phase 9: Secure Document Management with DocuSign Integration
**Single Source of Truth with Version Control & Role-Based Access**

**Status:** Ready for Implementation (Phase 9 - October 2026)  
**Timeline:** 3-4 weeks  
**Key Feature:** One document, multiple immutable views, role-based version access

---

## OVERVIEW

**Problem Solved:**
- Client uploads 1 PDF → System creates 1 source document
- Client, Attorney, Service Provider all see the SAME document
- But each sees different VERSIONS based on their role
- Service Provider gets immutable copy on first share (can't be deleted)
- All changes tracked; Service Provider views frozen at time of share

**Benefits:**
- ✅ Single source of truth (no duplicate files)
- ✅ Immutable copies for audit trail
- ✅ Role-based version access
- ✅ Complete change history
- ✅ Secure DocuSign integration
- ✅ Compliant with legal requirements

---

## ARCHITECTURE

### Document Lifecycle

```
CLIENT UPLOADS PDF
    ↓
Create Document Record (DB)
    ↓
Store in S3 (encrypted)
    ↓
Create Version 1 (Initial)
    ↓
Share with Attorney
    ├─ Attorney sees Version 1 + full history
    ├─ Can sign/annotate
    └─ Creates new versions
    ↓
Share with Service Provider
    ├─ Creates IMMUTABLE COPY of current version
    ├─ Service Provider locks to this version
    ├─ Cannot see future updates
    ├─ Cannot delete or modify
    └─ Can view signature history
    ↓
If Client Updates
    ├─ New version created
    ├─ Attorney sees new version
    ├─ Service Provider still sees original (frozen)
    └─ Both versions tracked independently
```

### Database Schema

```sql
-- Single source of truth: one document
CREATE TABLE documents (
  id VARCHAR(36) PRIMARY KEY,
  case_id VARCHAR(36) NOT NULL,
  client_id VARCHAR(36) NOT NULL,
  
  -- Document info
  name VARCHAR(255),
  type VARCHAR(50), -- contract, agreement, evidence, etc
  original_filename VARCHAR(255),
  
  -- Storage
  s3_key VARCHAR(500),
  s3_bucket VARCHAR(100),
  
  -- Metadata
  file_size INT,
  mime_type VARCHAR(50),
  
  -- Encryption
  encryption_key_id VARCHAR(36),
  
  -- Status
  status VARCHAR(50), -- draft, active, signed, archived
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX (case_id),
  INDEX (client_id),
  INDEX (status)
);

-- Versions: track all changes, same document
CREATE TABLE document_versions (
  id VARCHAR(36) PRIMARY KEY,
  document_id VARCHAR(36) NOT NULL REFERENCES documents(id),
  
  -- Version info
  version_number INT,
  change_type VARCHAR(50), -- uploaded, signed, annotated, updated
  change_description TEXT,
  
  -- Who made the change
  changed_by_user_id VARCHAR(36),
  changed_by_role VARCHAR(50), -- client, attorney, service_provider
  
  -- S3 pointer (immutable reference to this version)
  s3_key VARCHAR(500),
  file_hash VARCHAR(64), -- SHA-256 for integrity
  
  -- Signature data
  docusign_envelope_id VARCHAR(255),
  signers JSON, -- {name, email, status}
  signature_status VARCHAR(50), -- pending, signed, rejected
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX (document_id),
  INDEX (version_number),
  UNIQUE KEY (document_id, version_number)
);

-- Access control: who sees what version
CREATE TABLE document_access (
  id VARCHAR(36) PRIMARY KEY,
  document_id VARCHAR(36) NOT NULL REFERENCES documents(id),
  
  -- Who has access
  user_id VARCHAR(36) NOT NULL,
  user_role VARCHAR(50), -- client, attorney, service_provider
  
  -- Version access (NULL = all versions visible)
  frozen_at_version INT, -- If set, user only sees up to this version
  
  -- Permissions
  can_view BOOLEAN DEFAULT TRUE,
  can_sign BOOLEAN DEFAULT FALSE, -- only attorney/client
  can_download BOOLEAN DEFAULT TRUE,
  can_delete BOOLEAN DEFAULT FALSE, -- only client for non-signed
  can_share BOOLEAN DEFAULT FALSE, -- only client/attorney
  
  -- Access metadata
  shared_at TIMESTAMP DEFAULT NOW(),
  shared_by_user_id VARCHAR(36),
  
  -- Immutability flag
  is_immutable BOOLEAN DEFAULT FALSE, -- if TRUE: cannot be revoked
  
  INDEX (document_id),
  INDEX (user_id),
  UNIQUE KEY (document_id, user_id)
);

-- Audit trail: every action
CREATE TABLE document_audit_log (
  id VARCHAR(36) PRIMARY KEY,
  document_id VARCHAR(36) NOT NULL REFERENCES documents(id),
  
  action VARCHAR(100), -- view, download, sign, share, update
  user_id VARCHAR(36),
  user_role VARCHAR(50),
  
  version_number INT,
  ip_address VARCHAR(45),
  
  details JSON, -- {shared_with, timestamp, etc}
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX (document_id),
  INDEX (created_at),
  INDEX (action)
);
```

---

## CORE FEATURES

### Feature 1: DocuSign Integration

**Client uploads PDF:**
```typescript
// 1. Upload PDF to S3 (encrypted)
async function uploadDocument(file: File, caseId: string) {
  // Encrypt file
  const encrypted = await encryptFile(file);
  
  // Upload to S3
  const s3Key = `cases/${caseId}/documents/${generateId()}`;
  await s3.upload({
    Key: s3Key,
    Body: encrypted,
    ServerSideEncryption: 'AES256',
    Metadata: {
      'original-name': file.name,
      'uploaded-by': userId,
      'case-id': caseId,
    }
  });
  
  // Create document record
  const document = await Document.create({
    case_id: caseId,
    client_id: userId,
    name: file.name,
    s3_key: s3Key,
    status: 'active',
  });
  
  // Create Version 1
  await DocumentVersion.create({
    document_id: document.id,
    version_number: 1,
    change_type: 'uploaded',
    s3_key: s3Key,
    file_hash: calculateSHA256(encrypted),
    changed_by_role: 'client',
  });
  
  return document;
}
```

### Feature 2: Share with Service Provider (Immutable Copy)

**Attorney shares document with Service Provider:**
```typescript
async function shareDocumentWithServiceProvider(
  documentId: string,
  serviceProviderId: string,
  serviceProviderEmail: string
) {
  // Get current document
  const document = await Document.findById(documentId);
  
  // Get current version
  const currentVersion = await DocumentVersion.findLatest(documentId);
  
  // Create access record with frozen version
  await DocumentAccess.create({
    document_id: documentId,
    user_id: serviceProviderId,
    user_role: 'service_provider',
    
    // CRITICAL: Freeze at current version
    frozen_at_version: currentVersion.version_number,
    
    can_view: true,
    can_download: true,
    can_sign: false, // Service providers cannot sign
    can_delete: false, // Cannot delete
    can_share: false, // Cannot reshare
    
    // Immutable: cannot be revoked
    is_immutable: true,
    
    shared_by_user_id: userId,
  });
  
  // Log audit trail
  await DocumentAuditLog.create({
    document_id: documentId,
    action: 'share',
    user_id: userId,
    version_number: currentVersion.version_number,
    details: {
      shared_with: serviceProviderEmail,
      role: 'service_provider',
      frozen_at_version: currentVersion.version_number,
    },
  });
  
  // Send email to service provider
  await sendEmail({
    to: serviceProviderEmail,
    template: 'document_shared',
    data: {
      documentName: document.name,
      sharedBy: attorney.name,
      caseDetails: case.title,
    },
  });
  
  return {
    success: true,
    frozenVersion: currentVersion.version_number,
    immutable: true,
  };
}
```

### Feature 3: Version-Aware Document Retrieval

**Get document with role-based version access:**
```typescript
async function getDocumentForUser(
  documentId: string,
  userId: string
) {
  // Get access record
  const access = await DocumentAccess.findOne({
    document_id: documentId,
    user_id: userId,
  });
  
  if (!access) {
    throw new Error('No access to this document');
  }
  
  // Determine which version user can see
  const frozenVersion = access.frozen_at_version;
  
  if (frozenVersion) {
    // Service Provider: only see frozen version
    const version = await DocumentVersion.findOne({
      document_id: documentId,
      version_number: frozenVersion,
    });
    
    return {
      documentId,
      name: document.name,
      version: version.version_number,
      status: 'frozen', // Indicates immutable copy
      s3Url: generateSignedUrl(version.s3_key),
      
      // Show ONLY history up to frozen version
      history: await DocumentVersion.find({
        document_id: documentId,
        version_number: { $lte: frozenVersion },
      }),
      
      signatures: version.signers,
      
      // Service provider cannot perform these actions
      canUpdate: false,
      canDelete: false,
      canShare: false,
    };
  } else {
    // Client/Attorney: see all versions
    const latestVersion = await DocumentVersion.findLatest(documentId);
    
    return {
      documentId,
      name: document.name,
      version: latestVersion.version_number,
      status: 'active', // Can be updated
      s3Url: generateSignedUrl(latestVersion.s3_key),
      
      // Show FULL history
      history: await DocumentVersion.findAll(documentId),
      
      signatures: latestVersion.signers,
      
      // Client/Attorney can perform actions
      canUpdate: true,
      canDelete: access.can_delete,
      canShare: access.can_share,
    };
  }
}
```

### Feature 4: DocuSign Signature Integration

**Sign document (Attorney only):**
```typescript
async function requestSignature(
  documentId: string,
  signers: Array<{email: string, name: string, role: 'attorney' | 'client'}>
) {
  // Get document and latest version
  const document = await Document.findById(documentId);
  const latestVersion = await DocumentVersion.findLatest(documentId);
  
  // Get S3 signed URL
  const documentUrl = generateSignedUrl(latestVersion.s3_key);
  
  // Prepare DocuSign envelope
  const envelopeDefinition = {
    emailSubject: `Sign ${document.name}`,
    documents: [{
      documentBase64: await downloadFromS3(latestVersion.s3_key),
      name: document.name,
      documentId: '1',
    }],
    recipients: {
      signers: signers.map((signer, index) => ({
        email: signer.email,
        name: signer.name,
        recipientId: String(index + 1),
        routingOrder: String(index + 1),
        tabs: {
          signHereTabs: [{
            documentId: '1',
            pageNumber: '1',
            xPosition: '100',
            yPosition: '100',
          }],
        },
      })),
    },
    status: 'sent',
  };
  
  // Send to DocuSign
  const envelopeResponse = await docusignApi.envelopes.create(
    envelopeDefinition
  );
  
  // Create new version for signatures
  const newVersion = await DocumentVersion.create({
    document_id: documentId,
    version_number: latestVersion.version_number + 1,
    change_type: 'signed',
    change_description: `Signature requested from: ${signers.map(s => s.name).join(', ')}`,
    s3_key: latestVersion.s3_key, // Same file, just tracking signature
    file_hash: latestVersion.file_hash,
    docusign_envelope_id: envelopeResponse.envelopeId,
    signers: signers,
    signature_status: 'pending',
    changed_by_role: 'attorney',
  });
  
  // Log audit
  await DocumentAuditLog.create({
    document_id: documentId,
    action: 'sign_requested',
    version_number: newVersion.version_number,
    details: {
      signers: signers.map(s => s.email),
      docusign_envelope_id: envelopeResponse.envelopeId,
    },
  });
  
  return {
    versionNumber: newVersion.version_number,
    envelopeId: envelopeResponse.envelopeId,
    signingUrl: envelopeResponse.signingUrl,
  };
}
```

### Feature 5: Service Provider View (Frozen)

**Service Provider sees only their frozen version:**
```typescript
async function getServiceProviderDocumentView(
  documentId: string,
  serviceProviderId: string
) {
  // Verify immutable access
  const access = await DocumentAccess.findOne({
    document_id: documentId,
    user_id: serviceProviderId,
    is_immutable: true,
  });
  
  if (!access) {
    throw new Error('No immutable access to this document');
  }
  
  // Get ONLY the frozen version
  const frozenVersion = await DocumentVersion.findOne({
    document_id: documentId,
    version_number: access.frozen_at_version,
  });
  
  // Get all versions UP TO frozen (for history)
  const history = await DocumentVersion.find({
    document_id: documentId,
    version_number: { $lte: access.frozen_at_version },
  }).sort({ version_number: 1 });
  
  // Service provider view:
  return {
    document: {
      id: documentId,
      name: 'Contract - Smith v. Johnson',
      version: access.frozen_at_version,
      status: 'frozen', // IMMUTABLE
      
      // Show metadata
      uploadedBy: document.client.name,
      frozenAt: new Date(access.shared_at),
      
      // Cannot perform any actions
      actions: {
        canView: true,
        canDownload: true,
        canUpdate: false,
        canDelete: false,
        canSign: false,
        canShare: false,
      },
    },
    
    // Show history of this frozen version
    history: history.map(v => ({
      version: v.version_number,
      changeType: v.change_type,
      description: v.change_description,
      changedAt: v.created_at,
      changedBy: v.changed_by_role,
    })),
    
    // If signed, show signatures (but cannot change)
    signatures: frozenVersion.signers || [],
    signatureStatus: frozenVersion.signature_status,
    
    // Audit trail for compliance
    auditLog: await DocumentAuditLog.find({
      document_id: documentId,
      version_number: { $lte: access.frozen_at_version },
    }),
    
    message: 'This is an immutable copy. You cannot modify, delete, or see future updates to this document.',
  };
}
```

---

## USER FLOWS

### Flow 1: Client Uploads & Shares

```
CLIENT:
1. Uploads PDF → stored as Document (Version 1)
2. Sees: Full document + full history + can update
3. Shares with Attorney
   → Attorney sees Version 1 + full history
4. Updates document → Version 2 created
   → Attorney sees Version 2
5. Shares Version 2 with Service Provider
   → SERVICE PROVIDER locked to Version 2
   → Cannot see Version 3 if created
```

### Flow 2: Attorney Signs & Service Provider Watches

```
ATTORNEY:
1. Opens document (Version 2)
2. Requests signature
   → Version 3 created (signature tracking)
3. Sends to signer via DocuSign

SERVICE PROVIDER:
1. Receives immutable link to Version 2
2. Can view Version 2 (frozen in time)
3. Sees Version 2 signature history
4. Cannot see Version 3 or later
5. Cannot delete or modify
```

### Flow 3: Future Updates Don't Affect Service Provider

```
CLIENT creates Version 4 (updates document)
↓
ATTORNEY sees Version 4 + full history
↓
SERVICE PROVIDER still sees Version 2 (unchanged)
└─ Cannot see updates
```

---

## FRONTEND COMPONENTS

### Component 1: Document Upload
```typescript
<DocumentUpload
  caseId={caseId}
  onSuccess={(document) => {
    // Document created with Version 1
    showNotification(`Document uploaded: ${document.name}`);
  }}
/>
```

### Component 2: Document Viewer
```typescript
<DocumentViewer
  documentId={documentId}
  userId={userId}
  role={userRole} // 'client' | 'attorney' | 'service_provider'
/>

// Shows different UI based on role:
// Client: Full editing + share controls
// Attorney: Full editing + sign controls + share controls
// Service Provider: View-only + immutable badge
```

### Component 3: Share Dialog
```typescript
<ShareDialog
  documentId={documentId}
  onShare={(recipient) => {
    // Creates immutable access for service provider
    // Freezes at current version
    // Cannot be revoked (is_immutable = true)
  }}
/>
```

### Component 4: Signature Request
```typescript
<SignatureRequest
  documentId={documentId}
  onRequest={(signers) => {
    // Creates new version with signature tracking
    // Sends to DocuSign
    // Service providers still see previous version
  }}
/>
```

---

## SECURITY & COMPLIANCE

### Encryption
```typescript
// All documents encrypted at rest
const encrypted = await encryptFile(file, {
  algorithm: 'AES-256-GCM',
  keyRotation: true,
});
```

### Access Control
```typescript
// Role-based permissions
const permissions = {
  client: ['view', 'download', 'update', 'delete', 'share', 'sign'],
  attorney: ['view', 'download', 'share', 'sign'],
  service_provider: ['view', 'download'], // Immutable only
};
```

### Audit Trail
```typescript
// Every action logged
await DocumentAuditLog.create({
  document_id: documentId,
  action: 'view' | 'download' | 'sign' | 'share',
  user_id: userId,
  ip_address: getClientIP(),
  timestamp: now(),
});

// Service providers cannot see who updated documents
// Only see updates to their frozen version
```

### Immutability
```typescript
// Service provider copies cannot be revoked
is_immutable: true, // Once set, cannot be changed
can_delete: false, // Enforced at application level
can_modify: false, // S3 object lock could be used for extra security
```

---

## IMPLEMENTATION TIMELINE

### Week 1: Database & Core
- [ ] Create database schema
- [ ] Implement document CRUD
- [ ] Create version tracking system
- [ ] Implement access control

### Week 2: DocuSign Integration
- [ ] Integrate DocuSign API
- [ ] Implement signature requests
- [ ] Create signature tracking
- [ ] Add webhook for signature completion

### Week 3: Frontend Components
- [ ] Document upload component
- [ ] Document viewer with role-based UI
- [ ] Share dialog with frozen version selection
- [ ] Signature request UI

### Week 4: Security & Compliance
- [ ] Add encryption for documents at rest
- [ ] Implement audit logging
- [ ] Create compliance reports
- [ ] Add immutability enforcement
- [ ] Testing & refinement

---

## EXPECTED OUTCOMES

By Week 4:

✅ **Single Document, Multiple Views**
- One PDF stored once (S3)
- Client sees all versions + can update
- Attorney sees all versions + can sign
- Service Provider sees frozen version + cannot update

✅ **Immutable Service Provider Copies**
- Locked to version at time of share
- Cannot be deleted by client
- Cannot be modified by anyone
- Complete audit trail

✅ **DocuSign Integration**
- Sign documents directly
- Version tracking for signatures
- Webhook integration for completion
- Multiple signers supported

✅ **Compliance Ready**
- Full audit trail
- Role-based access
- Encryption at rest
- HIPAA/GDPR compliant architecture

---

## COST ANALYSIS

```
Per document per month:
- S3 storage: $0.023 (20MB avg)
- DocuSign API: $0.25 (if included in plan)
- Encryption/processing: $0.05
─────────────────────
Per document: ~$0.33/month

For 1,000 active documents: $330/month
For 10,000 documents: $3,300/month
```

---

## SUCCESS METRICS

- ✅ Time to share document: <30 seconds
- ✅ Service provider version locked: 100%
- ✅ Immutable copies: 100% cannot be deleted
- ✅ Version tracking: 100% accurate
- ✅ DocuSign integration: 99.9% uptime
- ✅ Audit trail completeness: 100%

---

**Status:** Design Complete, Ready for Implementation  
**Next Phase:** Phase 9 Development Begins November 2026

