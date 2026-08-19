/**
 * Bulk Operations Routes
 * API endpoints for CSV import/export and bulk data operations
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import {
  bulkOperationsService,
  BulkJob,
  ExportOptions,
  OperationResult,
} from '../services/bulkOperations';
import { authenticateUser, authorizeAdmin } from '../middleware/auth';
import { queryParam, routeParam } from '../src/utils/httpParams';

const router = Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// ============================================
// BULK IMPORT ENDPOINTS
// ============================================

/**
 * POST /api/bulk/import
 * Create and process a bulk import job
 * Body: CSV file
 * Query: ?template=user&dryRun=true&stopOnError=false
 */
router.post(
  '/import',
  authenticateUser,
  authorizeAdmin,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'CSV file is required' });
      }

      const template = queryParam(req.query.template); const dryRun = queryParam(req.query.dryRun); const stopOnError = queryParam(req.query.stopOnError);
      const userId = req.user?.id;

      if (!template || typeof template !== 'string') {
        return res.status(400).json({
          error:
            'Template parameter is required (user, attorney, case, service)',
        });
      }

      // Parse CSV
      const csvContent = req.file.buffer.toString('utf-8');
      const { data, validationErrors, warnings } =
        await bulkOperationsService.parseCSV(csvContent, template);

      if (validationErrors.length > 0 && !dryRun) {
        // Return errors if not in dry-run mode
        return res.status(400).json({
          error: 'CSV validation failed',
          validationErrors: validationErrors.slice(0, 100), // Limit to first 100
          totalErrors: validationErrors.length,
          warnings,
        });
      }

      // Create job
      const job = bulkOperationsService.createJob(
        `Import ${template} - ${req.file.originalname}`,
        'import',
        userId!,
        {
          dryRun: dryRun === 'true',
          totalRows: data.length,
        }
      );

      // Start processing asynchronously
      processImportJob(job.id, data, template, dryRun === 'true')
        .catch((error) => {
          console.error('Import job error:', error);
          const job = bulkOperationsService.getJob(job.id);
          if (job) {
            job.status = 'failed';
            job.errors.push({
              rowNumber: 0,
              rowData: {},
              error: error.message || 'Unknown error',
              severity: 'error',
            });
          }
        });

      res.json({
        jobId: job.id,
        status: 'processing',
        totalRows: data.length,
        dryRun: dryRun === 'true',
        validationErrorCount: validationErrors.length,
        warnings,
      });
    } catch (error) {
      console.error('Error processing import:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Import failed',
      });
    }
  }
);

/**
 * POST /api/bulk/import/validate
 * Validate CSV without processing
 */
router.post(
  '/import/validate',
  authenticateUser,
  authorizeAdmin,
  upload.single('file'),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'CSV file is required' });
      }

      const template = queryParam(req.query.template);

      if (!template || typeof template !== 'string') {
        return res
          .status(400)
          .json({ error: 'Template parameter is required' });
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const { data, validationErrors, warnings } =
        await bulkOperationsService.parseCSV(csvContent, template);

      res.json({
        isValid: validationErrors.length === 0,
        totalRows: data.length,
        validationErrors: validationErrors.slice(0, 100),
        totalErrors: validationErrors.length,
        warnings,
        summary: {
          valid: data.length - validationErrors.length,
          invalid: validationErrors.length,
        },
      });
    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Validation failed',
      });
    }
  }
);

/**
 * GET /api/bulk/import/template/:templateName
 * Download CSV template for a given type
 */
router.get('/import/template/:templateName', (req: Request, res: Response) => {
  try {
    const templateName = routeParam(req.params.templateName);
    const template = bulkOperationsService.generateTemplate(templateName);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="template-${templateName}.csv"`
    );
    res.send(template);
  } catch (error) {
    console.error('Template generation error:', error);
    res.status(404).json({
      error: error instanceof Error ? error.message : 'Template not found',
    });
  }
});

// ============================================
// BULK EXPORT ENDPOINTS
// ============================================

/**
 * POST /api/bulk/export
 * Export data as CSV
 * Body: { template: string, fields?: string[], filters?: object }
 */
router.post(
  '/export',
  authenticateUser,
  authorizeAdmin,
  async (req: Request, res: Response) => {
    try {
      const { template, fields, filters, format } = req.body;
      const userId = req.user?.id;

      if (!template) {
        return res.status(400).json({ error: 'Template is required' });
      }

      // Create export job
      const job = bulkOperationsService.createJob(
        `Export ${template}`,
        'export',
        userId!
      );

      // Simulate fetching data from database based on template
      const data = await fetchDataByTemplate(template, filters);

      // Generate CSV
      const csvContent = await bulkOperationsService.exportDataAsCSV(data, {
        format: (format as 'csv' | 'json' | 'xlsx') || 'csv',
        template,
        fields,
        includeHeaders: true,
      });

      // Mark job as completed
      job.status = 'completed';
      job.totalRows = data.length;
      job.successRows = data.length;
      job.processedRows = data.length;
      job.progress = 100;
      job.endTime = new Date();

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="export-${template}-${Date.now()}.csv"`
      );
      res.send(csvContent);
    } catch (error) {
      console.error('Export error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Export failed',
      });
    }
  }
);

// ============================================
// JOB STATUS ENDPOINTS
// ============================================

/**
 * GET /api/bulk/jobs/:jobId
 * Get status of a specific job
 */
router.get('/jobs/:jobId', authenticateUser, (req: Request, res: Response) => {
  try {
    const jobId = routeParam(req.params.jobId);
    const job = bulkOperationsService.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Check authorization - only creator can view
    if (job.createdBy !== req.user?.id && !req.user?.isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch job',
    });
  }
});

/**
 * GET /api/bulk/jobs
 * Get all jobs for authenticated user
 */
router.get('/jobs', authenticateUser, (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;
    const isAdmin = req.user?.isAdmin;

    const allJobs = bulkOperationsService.getAllJobs();
    const userJobs = isAdmin
      ? allJobs
      : allJobs.filter((job) => job.createdBy === userId);

    res.json({
      total: userJobs.length,
      jobs: userJobs.map((job) => ({
        id: job.id,
        name: job.name,
        type: job.type,
        status: job.status,
        progress: job.progress,
        totalRows: job.totalRows,
        processedRows: job.processedRows,
        successRows: job.successRows,
        failedRows: job.failedRows,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch jobs',
    });
  }
});

/**
 * POST /api/bulk/jobs/:jobId/cancel
 * Cancel a running job
 */
router.post(
  '/jobs/:jobId/cancel',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const jobId = routeParam(req.params.jobId);
      const job = bulkOperationsService.getJob(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.createdBy !== req.user?.id && !req.user?.isAdmin) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      if (job.status !== 'processing') {
        return res.status(400).json({
          error: `Cannot cancel job with status: ${job.status}`,
        });
      }

      bulkOperationsService.cancelJob(jobId);

      res.json({ message: 'Job cancelled successfully', jobId });
    } catch (error) {
      console.error('Error cancelling job:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to cancel job',
      });
    }
  }
);

/**
 * POST /api/bulk/jobs/:jobId/retry
 * Retry a failed job
 */
router.post(
  '/jobs/:jobId/retry',
  authenticateUser,
  async (req: Request, res: Response) => {
    try {
      const jobId = routeParam(req.params.jobId);
      const job = bulkOperationsService.getJob(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.createdBy !== req.user?.id && !req.user?.isAdmin) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      if (job.status !== 'failed') {
        return res.status(400).json({
          error: `Cannot retry job with status: ${job.status}`,
        });
      }

      // Implement retry logic based on job type
      await bulkOperationsService.retryJob(jobId, async (batch) => {
        // Placeholder - implement based on your database
        return batch.map(() => ({ success: true }));
      });

      res.json({ message: 'Job retry started', jobId });
    } catch (error) {
      console.error('Error retrying job:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to retry job',
      });
    }
  }
);

/**
 * DELETE /api/bulk/jobs/:jobId
 * Delete a job (cleanup)
 */
router.delete(
  '/jobs/:jobId',
  authenticateUser,
  authorizeAdmin,
  (req: Request, res: Response) => {
    try {
      const jobId = routeParam(req.params.jobId);
      const job = bulkOperationsService.getJob(jobId);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      if (job.status === 'processing') {
        return res.status(400).json({
          error: 'Cannot delete a job that is still processing',
        });
      }

      bulkOperationsService.deleteJob(jobId);

      res.json({ message: 'Job deleted successfully', jobId });
    } catch (error) {
      console.error('Error deleting job:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to delete job',
      });
    }
  }
);

// ============================================
// TEMPLATES ENDPOINTS
// ============================================

/**
 * GET /api/bulk/templates
 * Get list of available templates
 */
router.get('/templates', (req: Request, res: Response) => {
  try {
    const templates = bulkOperationsService.getAllTemplates();

    res.json({
      templates: templates.map((name) => ({
        name,
        config: bulkOperationsService.getTemplate(name),
      })),
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch templates',
    });
  }
});

/**
 * POST /api/bulk/cleanup
 * Clean up old completed jobs (admin only)
 */
router.post(
  '/cleanup',
  authenticateUser,
  authorizeAdmin,
  (req: Request, res: Response) => {
    try {
      const { olderThanHours } = req.body;
      const deleted = bulkOperationsService.cleanupOldJobs(
        olderThanHours || 24
      );

      res.json({
        message: 'Cleanup completed',
        deletedJobs: deleted,
      });
    } catch (error) {
      console.error('Cleanup error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Cleanup failed',
      });
    }
  }
);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Process import job (simulated - implement with your database)
 */
async function processImportJob(
  jobId: string,
  data: Record<string, any>[],
  template: string,
  dryRun: boolean
): Promise<void> {
  const operationHandler = async (
    batch: Record<string, any>[]
  ): Promise<OperationResult[]> => {
    // Simulate database operations based on template
    return batch.map((row) => {
      try {
        // Placeholder - implement based on your database schema
        // Example: insert row into database table based on template
        return { success: true };
      } catch (error) {
        return {
          success: false,
          errors: [error instanceof Error ? error.message : 'Unknown error'],
        };
      }
    });
  };

  await bulkOperationsService.processBulkImport(
    jobId,
    data,
    operationHandler,
    dryRun
  );
}

/**
 * Fetch data based on template for export (simulated - implement with your database)
 */
async function fetchDataByTemplate(
  template: string,
  filters?: Record<string, any>
): Promise<Record<string, any>[]> {
  // Placeholder - implement based on your database schema
  // This would query the database for the specific template type

  switch (template) {
    case 'user':
      return [
        {
          email: 'user1@example.com',
          firstName: 'John',
          lastName: 'Doe',
          phone: '+1-555-0100',
          role: 'user',
        },
        {
          email: 'user2@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          phone: '+1-555-0101',
          role: 'user',
        },
      ];
    case 'attorney':
      return [
        {
          barNumber: 'NY123456',
          firstName: 'John',
          lastName: 'Attorney',
          email: 'john@law.com',
          specialties: 'Immigration, Tax',
          yearsExperience: 10,
          licenseState: 'NY',
        },
      ];
    case 'case':
      return [
        {
          caseNumber: 'CASE-001',
          clientEmail: 'client@example.com',
          caseType: 'Immigration',
          filedDate: '2024-01-15',
          status: 'open',
        },
      ];
    default:
      return [];
  }
}

export default router;
