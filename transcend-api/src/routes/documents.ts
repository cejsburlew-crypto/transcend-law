// Document Routes
// File upload, download, and management

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  uploadCaseDocument,
  downloadCaseDocument,
  deleteCaseDocument,
  getCaseDocuments,
  scanFileForViruses,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  getCaseStorageUsage,
  getUserStorageUsage,
} from '../services/s3Service';

const router = Router();

// Configure multer for file uploads
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  storage: multer.memoryStorage(),
});

/**
 * POST /api/v2/documents/:caseId/upload
 * Upload document to case
 */
router.post(
  '/:caseId/upload',
  authMiddleware,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const userId = req.userId;

      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      // Scan file for viruses
      const isSafe = await scanFileForViruses(req.file.buffer, req.file.originalname);
      if (!isSafe) {
        return res.status(400).json({ error: 'File failed virus scan' });
      }

      // Upload to S3
      const result = await uploadCaseDocument(
        caseId,
        userId,
        req.file.originalname,
        req.file.buffer,
        req.file.mimetype
      );

      return res.json({
        success: true,
        documentId: result.documentId,
        url: result.url,
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      return res.status(500).json({ error: error.message || 'Upload failed' });
    }
  }
);

/**
 * GET /api/v2/documents/:caseId
 * Get all documents for a case
 */
router.get('/:caseId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { caseId } = req.params;

    const documents = await getCaseDocuments(caseId);

    return res.json({ documents });
  } catch (error: any) {
    console.error('Get documents error:', error);
    return res.status(500).json({ error: 'Failed to get documents' });
  }
});

/**
 * GET /api/v2/documents/:documentId/download
 * Download document
 */
router.get(
  '/:documentId/download',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const userId = req.userId;

      const document = await downloadCaseDocument(documentId, userId);

      // Set response headers
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${document.fileName}"`
      );

      return res.send(document.buffer);
    } catch (error: any) {
      console.error('Download error:', error);
      return res.status(500).json({ error: error.message || 'Download failed' });
    }
  }
);

/**
 * GET /api/v2/documents/:documentId/url
 * Get presigned download URL
 */
router.get(
  '/:documentId/url',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;
      const { expiresIn } = req.query;

      const url = await getPresignedDownloadUrl(
        documentId,
        parseInt(expiresIn as string) || 3600
      );

      return res.json({ url });
    } catch (error: any) {
      console.error('Get URL error:', error);
      return res.status(500).json({ error: 'Failed to generate URL' });
    }
  }
);

/**
 * GET /api/v2/documents/:caseId/upload-url
 * Get presigned upload URL
 */
router.get(
  '/:caseId/upload-url',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;
      const { fileName, mimeType } = req.query;

      if (!fileName || !mimeType) {
        return res.status(400).json({ error: 'fileName and mimeType required' });
      }

      const url = await getPresignedUploadUrl(
        caseId,
        fileName as string,
        mimeType as string
      );

      return res.json({ url });
    } catch (error: any) {
      console.error('Get upload URL error:', error);
      return res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  }
);

/**
 * DELETE /api/v2/documents/:documentId
 * Delete document
 */
router.delete(
  '/:documentId',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { documentId } = req.params;

      await deleteCaseDocument(documentId);

      return res.json({ success: true });
    } catch (error: any) {
      console.error('Delete error:', error);
      return res.status(500).json({ error: error.message || 'Delete failed' });
    }
  }
);

/**
 * GET /api/v2/documents/usage/case/:caseId
 * Get storage usage for case
 */
router.get(
  '/usage/case/:caseId',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { caseId } = req.params;

      const usage = await getCaseStorageUsage(caseId);

      return res.json({
        usage,
        formatted: formatBytes(usage),
      });
    } catch (error: any) {
      console.error('Get usage error:', error);
      return res.status(500).json({ error: 'Failed to get usage' });
    }
  }
);

/**
 * GET /api/v2/documents/usage/user
 * Get storage usage for authenticated user
 */
router.get('/usage/user', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    const usage = await getUserStorageUsage(userId);
    const limit = 1024 * 1024 * 1024; // 1GB

    return res.json({
      usage,
      limit,
      formatted: formatBytes(usage),
      percentage: Math.round((usage / limit) * 100),
    });
  } catch (error: any) {
    console.error('Get user usage error:', error);
    return res.status(500).json({ error: 'Failed to get usage' });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
}

export default router;
