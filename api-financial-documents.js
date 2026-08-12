// TRANSCEND LAW - FINANCIAL DOCUMENT VERIFICATION API
// Handles document upload, AI verification, and compliance tracking

const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const router = express.Router();
const db = new Pool();

// Configure file uploads (20MB max)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // Allow common document formats
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword',
                     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                     'application/vnd.ms-excel',
                     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, Images, Word, Excel'));
    }
  }
});

// Helper: Calculate file hash
const calculateHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

// Helper: Call Claude API for document verification
const verifyDocumentWithAI = async (fileBuffer, mimeType, documentType) => {
  try {
    // Convert image/PDF to base64 for Claude Vision
    const base64 = fileBuffer.toString('base64');

    // Determine media type for Claude
    let mediaType = 'image/jpeg';
    if (mimeType === 'application/pdf') {
      mediaType = 'application/pdf';
    } else if (mimeType === 'image/png') {
      mediaType = 'image/png';
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64,
                },
              },
              {
                type: 'text',
                text: `Verify this ${documentType} document. Respond with JSON only:
{
  "authenticity_score": 0-100,
  "completeness_score": 0-100,
  "extracted_fields": {
    "field_name": "value",
    "confidence": 0.95
  },
  "issues": ["issue1", "issue2"],
  "manual_review_required": false,
  "expiration_date": "YYYY-MM-DD or null",
  "issue_date": "YYYY-MM-DD or null",
  "document_number": "value if found",
  "validity": "valid|expired|invalid"
}`,
              },
            ],
          },
        ],
      }),
    });

    const data = await response.json();
    if (data.content && data.content[0]) {
      try {
        return JSON.parse(data.content[0].text);
      } catch (e) {
        // Fallback if Claude returns non-JSON
        return {
          authenticity_score: 50,
          completeness_score: 50,
          issues: ['AI response parsing failed'],
          manual_review_required: true,
        };
      }
    }

    return null;
  } catch (error) {
    console.error('AI verification error:', error);
    throw error;
  }
};

// POST: Upload financial document
router.post('/documents/upload', upload.single('document'), async (req, res) => {
  try {
    const {
      service_provider_id,
      provider_type,
      document_type,
      document_category,
      document_number,
      document_name,
      document_issue_date,
      document_expiration_date,
      issuing_authority,
      issuing_country = 'US',
      firm_id,
    } = req.body;

    // Validation
    if (!req.file || !service_provider_id || !provider_type || !document_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!['notary', 'attorney', 'sme', 'tagger'].includes(provider_type)) {
      return res.status(400).json({ error: 'Invalid provider_type' });
    }

    // Calculate file hash
    const fileHash = calculateHash(req.file.buffer);

    // Check for duplicate uploads
    const existingDoc = await db.query(
      `SELECT id FROM financial_documents
       WHERE file_hash = $1 AND service_provider_id = $2`,
      [fileHash, service_provider_id]
    );

    if (existingDoc.rows.length > 0) {
      return res.status(400).json({ error: 'This document was already uploaded' });
    }

    // Store file (save to S3 in production, local for now)
    const filename = `${service_provider_id}_${Date.now()}_${req.file.originalname}`;
    const uploadDir = path.join(__dirname, 'uploads', provider_type);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filepath = path.join(uploadDir, filename);
    fs.writeFileSync(filepath, req.file.buffer);

    // Verify document with AI
    const aiVerification = await verifyDocumentWithAI(
      req.file.buffer,
      req.file.mimetype,
      document_type
    );

    // Insert document record
    const result = await db.query(
      `INSERT INTO financial_documents (
        service_provider_id, provider_type, firm_id, document_type, document_category,
        file_url, file_hash, file_size_bytes, mime_type,
        document_number, document_name, document_issue_date, document_expiration_date,
        issuing_authority, issuing_country,
        verification_status, verification_method,
        document_authenticity_score, data_accuracy_score, completeness_score,
        extracted_data, extracted_fields_match, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
       RETURNING id, verification_status, document_authenticity_score, completeness_score`,
      [
        service_provider_id, provider_type, firm_id || null, document_type, document_category,
        filepath, fileHash, req.file.size, req.file.mimetype,
        document_number || null, document_name || null,
        document_issue_date || null, document_expiration_date || null,
        issuing_authority || null, issuing_country,
        aiVerification?.manual_review_required ? 'manual_review_required' : 'verified',
        'ai_ocr',
        aiVerification?.authenticity_score || 50,
        aiVerification?.authenticity_score || 50,
        aiVerification?.completeness_score || 50,
        JSON.stringify(aiVerification?.extracted_fields || {}),
        false,
        req.user?.id || 'system'
      ]
    );

    // Store AI verification log
    if (aiVerification) {
      await db.query(
        `INSERT INTO ai_verification_logs (
          financial_document_id, ai_model, ai_model_version, confidence_level,
          extracted_fields, validation_results, requires_manual_review
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          result.rows[0].id,
          'claude-3-5-sonnet',
          '20241022',
          (aiVerification.authenticity_score || 50) / 100,
          JSON.stringify(aiVerification.extracted_fields || {}),
          JSON.stringify(aiVerification),
          aiVerification.manual_review_required,
        ]
      );
    }

    // Update financial profile
    const fieldMap = {
      'Tax ID': 'has_tax_id',
      'Identification': 'has_identification',
      'Business Registration': 'has_business_registration',
      'Insurance': 'has_insurance',
      'Banking': 'has_banking_info',
    };

    const profileField = Object.entries(fieldMap).find(([k]) =>
      document_type.includes(k)
    )?.[1];

    if (profileField) {
      await db.query(
        `INSERT INTO financial_profiles (service_provider_id, provider_type, firm_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (service_provider_id, provider_type) DO UPDATE SET
         ${profileField} = true, updated_at = NOW()`,
        [service_provider_id, provider_type, firm_id || null]
      );

      // Recalculate compliance percentage
      await recalculateCompliance(service_provider_id, provider_type);
    }

    // Check if document is expired
    if (document_expiration_date) {
      const expDate = new Date(document_expiration_date);
      if (expDate < new Date()) {
        await db.query(
          `UPDATE financial_documents SET verification_status = 'expired' WHERE id = $1`,
          [result.rows[0].id]
        );
      }
    }

    return res.json({
      success: true,
      document_id: result.rows[0].id,
      verification_status: result.rows[0].verification_status,
      ai_scores: {
        authenticity: result.rows[0].document_authenticity_score,
        completeness: result.rows[0].completeness_score,
      },
      ai_findings: aiVerification?.issues || [],
      requires_manual_review: aiVerification?.manual_review_required || false,
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Recalculate compliance percentage
const recalculateCompliance = async (serviceProviderId, providerType) => {
  const requirements = await db.query(
    `SELECT COUNT(*) as total FROM compliance_requirements WHERE provider_type = $1`,
    [providerType]
  );

  const totalRequired = requirements.rows[0].total;

  const completed = await db.query(
    `SELECT
      (CASE WHEN has_tax_id THEN 1 ELSE 0 END +
       CASE WHEN has_identification THEN 1 ELSE 0 END +
       CASE WHEN has_business_registration THEN 1 ELSE 0 END +
       CASE WHEN has_insurance THEN 1 ELSE 0 END +
       CASE WHEN has_banking_info THEN 1 ELSE 0 END) as completed
     FROM financial_profiles
     WHERE service_provider_id = $1 AND provider_type = $2`,
    [serviceProviderId, providerType]
  );

  const completedCount = completed.rows[0]?.completed || 0;
  const percentage = Math.round((completedCount / totalRequired) * 100);

  await db.query(
    `UPDATE financial_profiles
     SET compliance_percentage = $1,
         compliance_status = CASE
           WHEN $1 = 100 THEN 'verified'
           WHEN $1 >= 50 THEN 'pending_review'
           ELSE 'incomplete'
         END,
         updated_at = NOW()
     WHERE service_provider_id = $2 AND provider_type = $3`,
    [percentage, serviceProviderId, providerType]
  );
};

// GET: Financial profile and compliance status
router.get('/profile/:service_provider_id/:provider_type', async (req, res) => {
  try {
    const { service_provider_id, provider_type } = req.params;

    const profile = await db.query(
      `SELECT * FROM financial_profiles
       WHERE service_provider_id = $1 AND provider_type = $2`,
      [service_provider_id, provider_type]
    );

    const documents = await db.query(
      `SELECT id, document_type, verification_status, document_authenticity_score,
              completeness_score, uploaded_at, document_expiration_date
       FROM financial_documents
       WHERE service_provider_id = $1 AND provider_type = $2
       ORDER BY uploaded_at DESC`,
      [service_provider_id, provider_type]
    );

    const requirements = await db.query(
      `SELECT * FROM compliance_requirements WHERE provider_type = $1`,
      [provider_type]
    );

    return res.json({
      profile: profile.rows[0] || null,
      documents: documents.rows,
      requirements: requirements.rows,
      compliance_checklist: {
        has_tax_id: profile.rows[0]?.has_tax_id || false,
        has_identification: profile.rows[0]?.has_identification || false,
        has_business_registration: profile.rows[0]?.has_business_registration || false,
        has_insurance: profile.rows[0]?.has_insurance || false,
        has_banking_info: profile.rows[0]?.has_banking_info || false,
      },
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET: Compliance dashboard summary
router.get('/compliance/summary', async (req, res) => {
  try {
    const summary = await db.query(
      `SELECT * FROM financial_compliance_summary`
    );

    return res.json(summary.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Documents requiring manual review
router.get('/admin/pending-review', async (req, res) => {
  try {
    const docs = await db.query(
      `SELECT
        fd.id, fd.service_provider_id, fd.provider_type, fd.document_type,
        fd.document_authenticity_score, fd.completeness_score,
        fd.uploaded_at, fd.extracted_data,
        ai.anomalies_detected
       FROM financial_documents fd
       LEFT JOIN ai_verification_logs ai ON fd.id = ai.financial_document_id
       WHERE fd.verification_status IN ('manual_review_required', 'pending')
       ORDER BY fd.uploaded_at ASC
       LIMIT 100`
    );

    return res.json(docs.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Admin manual verification
router.post('/admin/verify/:document_id', async (req, res) => {
  try {
    const { document_id } = req.params;
    const { verified, rejection_reason, rejection_code } = req.body;

    if (verified) {
      await db.query(
        `UPDATE financial_documents
         SET verification_status = 'verified', verification_timestamp = NOW()
         WHERE id = $1`,
        [document_id]
      );
    } else {
      await db.query(
        `UPDATE financial_documents
         SET verification_status = 'rejected', rejection_reason = $1, rejection_code = $2
         WHERE id = $3`,
        [rejection_reason, rejection_code, document_id]
      );
    }

    return res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Update banking info (encrypted in production)
router.post('/banking-info/:service_provider_id/:provider_type', async (req, res) => {
  try {
    const { service_provider_id, provider_type } = req.params;
    const { account_last_4, routing_last_4, payment_method } = req.body;

    await db.query(
      `INSERT INTO financial_profiles (service_provider_id, provider_type)
       VALUES ($1, $2)
       ON CONFLICT (service_provider_id, provider_type) DO UPDATE SET
       bank_account_last_4 = $3,
       bank_routing_last_4 = $4,
       payment_method = $5,
       has_banking_info = true,
       updated_at = NOW()`,
      [service_provider_id, provider_type, account_last_4, routing_last_4, payment_method]
    );

    await recalculateCompliance(service_provider_id, provider_type);

    return res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
