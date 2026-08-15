/**
 * Bulk Operations Service
 * Handles CSV import/export, bulk create/update/delete operations with validation,
 * error reporting, dry-run mode, progress tracking, and job scheduling
 */

import { EventEmitter } from 'events';
import Papa from 'papaparse';
import { v4 as uuidv4 } from 'uuid';

// Types and Interfaces
export interface BulkJob {
  id: string;
  name: string;
  type: 'import' | 'export' | 'delete';
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalRows: number;
  processedRows: number;
  failedRows: number;
  successRows: number;
  progress: number; // 0-100
  dryRun: boolean;
  startTime: Date;
  endTime?: Date;
  errors: BulkError[];
  warnings: string[];
  scheduledFor?: Date;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  resultFileUrl?: string;
  retryCount: number;
  maxRetries: number;
}

export interface BulkError {
  rowNumber: number;
  rowData: Record<string, any>;
  error: string;
  field?: string;
  severity: 'error' | 'warning';
}

export interface CSVValidationRule {
  field: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'email' | 'phone' | 'boolean' | 'enum';
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: string[];
  customValidator?: (value: any) => boolean;
  errorMessage?: string;
}

export interface BulkOperationConfig {
  template: string; // 'user' | 'attorney' | 'case' | 'document' | 'service' | 'custom'
  validationRules: CSVValidationRule[];
  allowDuplicates: boolean;
  stopOnError: boolean;
  batchSize: number; // Number of rows to process in a single batch
  timeout: number; // Timeout per batch in ms
  enableNotifications: boolean;
}

export interface OperationResult {
  success: boolean;
  id?: string;
  errors?: string[];
  warnings?: string[];
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  template: string;
  filters?: Record<string, any>;
  fields?: string[];
  includeHeaders: boolean;
}

/**
 * BulkOperationsService - Main service class
 */
export class BulkOperationsService extends EventEmitter {
  private jobs: Map<string, BulkJob> = new Map();
  private templates: Map<string, BulkOperationConfig> = new Map();
  private maxConcurrentJobs = 5;
  private activeJobs = 0;
  private jobQueue: string[] = [];

  constructor() {
    super();
    this.initializeTemplates();
  }

  /**
   * Initialize default templates with validation rules
   */
  private initializeTemplates(): void {
    // User template
    this.templates.set('user', {
      template: 'user',
      validationRules: [
        {
          field: 'email',
          required: true,
          type: 'email',
          errorMessage: 'Invalid email address',
        },
        {
          field: 'firstName',
          required: true,
          type: 'string',
          minLength: 1,
          maxLength: 100,
        },
        {
          field: 'lastName',
          required: true,
          type: 'string',
          minLength: 1,
          maxLength: 100,
        },
        {
          field: 'phone',
          required: false,
          type: 'phone',
        },
        {
          field: 'role',
          required: false,
          type: 'enum',
          enum: ['user', 'attorney', 'admin'],
        },
      ],
      allowDuplicates: false,
      stopOnError: false,
      batchSize: 100,
      timeout: 30000,
      enableNotifications: true,
    });

    // Attorney template
    this.templates.set('attorney', {
      template: 'attorney',
      validationRules: [
        {
          field: 'barNumber',
          required: true,
          type: 'string',
        },
        {
          field: 'firstName',
          required: true,
          type: 'string',
        },
        {
          field: 'lastName',
          required: true,
          type: 'string',
        },
        {
          field: 'email',
          required: true,
          type: 'email',
        },
        {
          field: 'specialties',
          required: false,
          type: 'string',
        },
        {
          field: 'yearsExperience',
          required: false,
          type: 'number',
        },
        {
          field: 'licenseState',
          required: true,
          type: 'string',
        },
      ],
      allowDuplicates: false,
      stopOnError: false,
      batchSize: 50,
      timeout: 45000,
      enableNotifications: true,
    });

    // Case template
    this.templates.set('case', {
      template: 'case',
      validationRules: [
        {
          field: 'caseNumber',
          required: true,
          type: 'string',
        },
        {
          field: 'clientEmail',
          required: true,
          type: 'email',
        },
        {
          field: 'caseType',
          required: true,
          type: 'string',
        },
        {
          field: 'filedDate',
          required: false,
          type: 'date',
        },
        {
          field: 'status',
          required: true,
          type: 'enum',
          enum: ['open', 'closed', 'pending', 'archived'],
        },
      ],
      allowDuplicates: false,
      stopOnError: false,
      batchSize: 100,
      timeout: 30000,
      enableNotifications: true,
    });

    // Service template
    this.templates.set('service', {
      template: 'service',
      validationRules: [
        {
          field: 'name',
          required: true,
          type: 'string',
          minLength: 1,
          maxLength: 200,
        },
        {
          field: 'category',
          required: true,
          type: 'string',
        },
        {
          field: 'description',
          required: false,
          type: 'string',
          maxLength: 1000,
        },
        {
          field: 'price',
          required: true,
          type: 'number',
        },
        {
          field: 'available',
          required: false,
          type: 'boolean',
        },
      ],
      allowDuplicates: false,
      stopOnError: false,
      batchSize: 100,
      timeout: 30000,
      enableNotifications: true,
    });
  }

  /**
   * Create a new bulk job
   */
  public createJob(
    name: string,
    type: 'import' | 'export' | 'delete',
    userId: string,
    config?: Partial<BulkJob>
  ): BulkJob {
    const jobId = uuidv4();
    const job: BulkJob = {
      id: jobId,
      name,
      type,
      status: 'pending',
      totalRows: 0,
      processedRows: 0,
      failedRows: 0,
      successRows: 0,
      progress: 0,
      dryRun: config?.dryRun || false,
      startTime: new Date(),
      errors: [],
      warnings: [],
      createdBy: userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      retryCount: 0,
      maxRetries: 3,
      ...config,
    };

    this.jobs.set(jobId, job);
    this.emit('job:created', job);

    return job;
  }

  /**
   * Parse and validate CSV file
   */
  public async parseCSV(
    csvContent: string,
    templateName: string
  ): Promise<{
    data: Record<string, any>[];
    validationErrors: BulkError[];
    warnings: string[];
  }> {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const result = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });

    if (result.errors.length > 0) {
      throw new Error(`CSV parsing error: ${result.errors[0].message}`);
    }

    const data = result.data as Record<string, any>[];
    const validationErrors: BulkError[] = [];
    const warnings: string[] = [];

    // Validate each row
    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = data[rowIndex];
      const rowErrors = await this.validateRow(
        row,
        rowIndex + 2, // +2 because row 1 is headers
        template.validationRules
      );

      validationErrors.push(...rowErrors);

      // Check for duplicates if needed
      if (!template.allowDuplicates) {
        const duplicateWarning = this.checkForDuplicates(row, data, rowIndex);
        if (duplicateWarning) {
          warnings.push(duplicateWarning);
        }
      }
    }

    return { data, validationErrors, warnings };
  }

  /**
   * Validate a single row against rules
   */
  private async validateRow(
    row: Record<string, any>,
    rowNumber: number,
    rules: CSVValidationRule[]
  ): Promise<BulkError[]> {
    const errors: BulkError[] = [];

    for (const rule of rules) {
      const value = row[rule.field];

      // Check required fields
      if (rule.required && (!value || value.toString().trim() === '')) {
        errors.push({
          rowNumber,
          rowData: row,
          error: `Required field '${rule.field}' is missing`,
          field: rule.field,
          severity: 'error',
        });
        continue;
      }

      if (!value || value.toString().trim() === '') {
        continue; // Skip validation for optional empty fields
      }

      // Type validation
      const typeError = this.validateFieldType(value, rule);
      if (typeError) {
        errors.push({
          rowNumber,
          rowData: row,
          error: typeError,
          field: rule.field,
          severity: 'error',
        });
        continue;
      }

      // String length validation
      if (rule.type === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push({
            rowNumber,
            rowData: row,
            error: `Field '${rule.field}' must be at least ${rule.minLength} characters`,
            field: rule.field,
            severity: 'error',
          });
        }

        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push({
            rowNumber,
            rowData: row,
            error: `Field '${rule.field}' must be no more than ${rule.maxLength} characters`,
            field: rule.field,
            severity: 'error',
          });
        }
      }

      // Pattern validation
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push({
          rowNumber,
          rowData: row,
          error: `Field '${rule.field}' does not match required format`,
          field: rule.field,
          severity: 'error',
        });
      }

      // Enum validation
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push({
          rowNumber,
          rowData: row,
          error: `Field '${rule.field}' must be one of: ${rule.enum.join(', ')}`,
          field: rule.field,
          severity: 'error',
        });
      }

      // Custom validator
      if (rule.customValidator && !rule.customValidator(value)) {
        errors.push({
          rowNumber,
          rowData: row,
          error: rule.errorMessage || `Field '${rule.field}' failed custom validation`,
          field: rule.field,
          severity: 'error',
        });
      }
    }

    return errors;
  }

  /**
   * Validate field type
   */
  private validateFieldType(value: any, rule: CSVValidationRule): string | null {
    switch (rule.type) {
      case 'email': {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value) ? null : 'Invalid email address';
      }

      case 'phone': {
        const phoneRegex = /^\+?[\d\s\-().]+$/;
        return phoneRegex.test(value) ? null : 'Invalid phone number';
      }

      case 'number': {
        return !isNaN(Number(value)) ? null : 'Must be a valid number';
      }

      case 'date': {
        const date = new Date(value);
        return !isNaN(date.getTime()) ? null : 'Invalid date format';
      }

      case 'boolean': {
        const boolValue = value.toString().toLowerCase();
        return ['true', 'false', 'yes', 'no', '1', '0'].includes(boolValue)
          ? null
          : 'Must be a boolean value (true/false, yes/no, 1/0)';
      }

      default:
        return null;
    }
  }

  /**
   * Check for duplicate rows
   */
  private checkForDuplicates(
    row: Record<string, any>,
    allRows: Record<string, any>[],
    currentIndex: number
  ): string | null {
    for (let i = 0; i < currentIndex; i++) {
      if (JSON.stringify(allRows[i]) === JSON.stringify(row)) {
        return `Row ${currentIndex + 2} is a duplicate of row ${i + 2}`;
      }
    }
    return null;
  }

  /**
   * Process bulk import with validation and batching
   */
  public async processBulkImport(
    jobId: string,
    data: Record<string, any>[],
    operationHandler: (batch: Record<string, any>[]) => Promise<OperationResult[]>,
    dryRun: boolean = false
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    try {
      // Add to queue if at max concurrent jobs
      if (this.activeJobs >= this.maxConcurrentJobs) {
        this.jobQueue.push(jobId);
        this.emit('job:queued', job);
      } else {
        this.activeJobs++;
      }

      job.status = 'processing';
      job.totalRows = data.length;
      job.startTime = new Date();
      this.emit('job:started', job);

      const config = this.templates.get('user'); // Default, can be customized
      const batchSize = config?.batchSize || 100;
      const timeout = config?.timeout || 30000;

      // Process in batches
      for (let i = 0; i < data.length; i += batchSize) {
        if (job.status === 'cancelled') {
          throw new Error('Job was cancelled');
        }

        const batch = data.slice(i, Math.min(i + batchSize, data.length));

        try {
          if (!dryRun) {
            const results = await Promise.race([
              operationHandler(batch),
              new Promise<OperationResult[]>((_, reject) =>
                setTimeout(() => reject(new Error('Batch timeout')), timeout)
              ),
            ]);

            // Process results
            for (let j = 0; j < results.length; j++) {
              const result = results[j];
              if (result.success) {
                job.successRows++;
              } else {
                job.failedRows++;
                if (result.errors) {
                  job.errors.push({
                    rowNumber: i + j + 2,
                    rowData: batch[j],
                    error: result.errors.join('; '),
                    severity: 'error',
                  });
                }
              }
            }
          } else {
            // Dry run: just count processed rows
            job.successRows += batch.length;
          }

          job.processedRows += batch.length;
          job.progress = Math.round((job.processedRows / job.totalRows) * 100);
          job.updatedAt = new Date();

          this.emit('job:progress', {
            jobId,
            progress: job.progress,
            processedRows: job.processedRows,
            totalRows: job.totalRows,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);

          if (config?.stopOnError) {
            throw error;
          }

          for (const row of batch) {
            job.failedRows++;
            job.errors.push({
              rowNumber: i + batch.indexOf(row) + 2,
              rowData: row,
              error: errorMsg,
              severity: 'error',
            });
          }

          job.warnings.push(
            `Batch starting at row ${i + 2} failed: ${errorMsg}`
          );
        }
      }

      job.status = 'completed';
      job.endTime = new Date();
      this.emit('job:completed', job);
    } catch (error) {
      job.status = 'failed';
      job.endTime = new Date();
      const errorMsg = error instanceof Error ? error.message : String(error);
      job.errors.push({
        rowNumber: 0,
        rowData: {},
        error: errorMsg,
        severity: 'error',
      });
      this.emit('job:failed', { job, error: errorMsg });
    } finally {
      this.activeJobs--;

      // Process next job in queue
      if (this.jobQueue.length > 0) {
        const nextJobId = this.jobQueue.shift();
        if (nextJobId) {
          this.activeJobs++;
        }
      }
    }
  }

  /**
   * Generate CSV template for a given template type
   */
  public generateTemplate(templateName: string): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    const headers = template.validationRules
      .map((rule) => `${rule.field}${rule.required ? '*' : ''}`)
      .join(',');

    const exampleRows = template.validationRules
      .map((rule) => {
        switch (rule.type) {
          case 'email':
            return 'example@email.com';
          case 'phone':
            return '+1-555-0100';
          case 'number':
            return '123';
          case 'date':
            return '2024-01-15';
          case 'boolean':
            return 'true';
          case 'enum':
            return rule.enum ? rule.enum[0] : 'value';
          default:
            return 'Sample data';
        }
      })
      .join(',');

    return `${headers}\n${exampleRows}`;
  }

  /**
   * Export data as CSV
   */
  public async exportDataAsCSV(
    data: Record<string, any>[],
    options: ExportOptions
  ): Promise<string> {
    if (data.length === 0) {
      return options.includeHeaders ? '' : '';
    }

    // Get fields to export
    let fieldsToExport = options.fields || Object.keys(data[0]);

    // Filter fields based on template if provided
    const template = this.templates.get(options.template);
    if (template) {
      const templateFields = template.validationRules.map((r) => r.field);
      fieldsToExport = fieldsToExport.filter((f) => templateFields.includes(f));
    }

    // Generate CSV
    const csv = Papa.unparse({
      fields: fieldsToExport,
      data: data.map((row) => {
        const record: Record<string, any> = {};
        for (const field of fieldsToExport) {
          record[field] = row[field] ?? '';
        }
        return record;
      }),
    });

    return csv;
  }

  /**
   * Get job status
   */
  public getJob(jobId: string): BulkJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  public getAllJobs(): BulkJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Cancel a job
   */
  public cancelJob(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (job) {
      job.status = 'cancelled';
      job.updatedAt = new Date();
      this.emit('job:cancelled', job);
    }
  }

  /**
   * Retry a failed job
   */
  public async retryJob(
    jobId: string,
    operationHandler: (batch: Record<string, any>[]) => Promise<OperationResult[]>
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.retryCount >= job.maxRetries) {
      throw new Error(`Maximum retries (${job.maxRetries}) exceeded`);
    }

    // Reset counters
    job.retryCount++;
    job.processedRows = 0;
    job.failedRows = 0;
    job.successRows = 0;
    job.progress = 0;
    job.errors = [];
    job.status = 'processing';

    this.emit('job:retrying', { job, attempt: job.retryCount });
  }

  /**
   * Get template configuration
   */
  public getTemplate(templateName: string): BulkOperationConfig | undefined {
    return this.templates.get(templateName);
  }

  /**
   * Register custom template
   */
  public registerTemplate(name: string, config: BulkOperationConfig): void {
    this.templates.set(name, config);
  }

  /**
   * Get all available templates
   */
  public getAllTemplates(): string[] {
    return Array.from(this.templates.keys());
  }

  /**
   * Delete job (cleanup)
   */
  public deleteJob(jobId: string): void {
    this.jobs.delete(jobId);
  }

  /**
   * Clean up old completed jobs
   */
  public cleanupOldJobs(olderThanHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    let deleted = 0;

    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.endTime &&
        job.endTime < cutoffTime
      ) {
        this.jobs.delete(jobId);
        deleted++;
      }
    }

    return deleted;
  }
}

// Export singleton instance
export const bulkOperationsService = new BulkOperationsService();
