import React, { useState, useRef, useEffect } from 'react';
import './BulkImportWizard.css';

interface ValidationError {
  rowNumber: number;
  rowData: Record<string, any>;
  error: string;
  field?: string;
  severity: 'error' | 'warning';
}

interface BulkJob {
  id: string;
  name: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalRows: number;
  processedRows: number;
  failedRows: number;
  successRows: number;
  progress: number;
  dryRun: boolean;
  startTime: string;
  endTime?: string;
  errors: ValidationError[];
  warnings: string[];
  createdAt: string;
}

type Step = 'template' | 'upload' | 'validate' | 'preview' | 'confirm' | 'processing' | 'results';

interface ProgressEvent {
  jobId: string;
  progress: number;
  processedRows: number;
  totalRows: number;
}

export default function BulkImportWizard() {
  const [step, setStep] = useState<Step>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('user');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<Record<string, any>[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dryRun, setDryRun] = useState(true);
  const [stopOnError, setStopOnError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentJob, setCurrentJob] = useState<BulkJob | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [templates, setTemplates] = useState<string[]>([]);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const authToken = localStorage.getItem('authToken');

  // Load available templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  // Poll job progress
  useEffect(() => {
    if (currentJob && currentJob.status === 'processing') {
      const interval = setInterval(() => {
        if (currentJob.id) {
          checkJobStatus(currentJob.id);
        }
      }, 1000);
      setPollInterval(interval);

      return () => {
        if (interval) clearInterval(interval);
      };
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [currentJob?.id, currentJob?.status]);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/bulk/templates', {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const result = await response.json();
        setTemplates(result.templates.map((t: any) => t.name));
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const downloadTemplate = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/bulk/import/template/${selectedTemplate}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `template-${selectedTemplate}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to download template:', error);
      alert('Failed to download template');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setUploadedFile(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      setUploadedFile(files[0]);
    }
  };

  const validateCSV = async () => {
    if (!uploadedFile) {
      alert('Please select a file');
      return;
    }

    try {
      setIsLoading(true);

      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch(
        `/api/bulk/import/validate?template=${selectedTemplate}`,
        {
          method: 'POST',
          body: formData,
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      if (response.ok) {
        const result = await response.json();

        // Parse CSV content to display preview
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          const rows = content
            .split('\n')
            .slice(0, 101)
            .map((row) => {
              const values = row.split(',');
              return values;
            });

          setValidationErrors(result.validationErrors || []);
          setWarnings(result.warnings || []);
          setStep('preview');
        };
        reader.readAsText(uploadedFile);
      } else {
        const error = await response.json();
        setValidationErrors(error.validationErrors || []);
        setWarnings(error.warnings || []);
        setStep('validate');
      }
    } catch (error) {
      console.error('Validation error:', error);
      alert('Validation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const startImport = async () => {
    if (!uploadedFile) {
      alert('Please select a file');
      return;
    }

    try {
      setIsLoading(true);
      setStep('processing');

      const formData = new FormData();
      formData.append('file', uploadedFile);

      const response = await fetch(
        `/api/bulk/import?template=${selectedTemplate}&dryRun=${dryRun}&stopOnError=${stopOnError}`,
        {
          method: 'POST',
          body: formData,
          headers: { Authorization: `Bearer ${authToken}` },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setCurrentJob({
          id: result.jobId,
          name: uploadedFile.name,
          type: 'import',
          status: 'processing',
          totalRows: result.totalRows,
          processedRows: 0,
          failedRows: 0,
          successRows: 0,
          progress: 0,
          dryRun: result.dryRun,
          startTime: new Date().toISOString(),
          errors: result.validationErrors || [],
          warnings: result.warnings || [],
          createdAt: new Date().toISOString(),
        });
        setJobProgress(0);
      } else {
        alert('Failed to start import');
        setStep('confirm');
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Import failed');
      setStep('confirm');
    } finally {
      setIsLoading(false);
    }
  };

  const checkJobStatus = async (jobId: string) => {
    try {
      const response = await fetch(`/api/bulk/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const job = await response.json();
        setCurrentJob(job);
        setJobProgress(job.progress);

        if (job.status === 'completed' || job.status === 'failed') {
          setStep('results');
          if (pollInterval) {
            clearInterval(pollInterval);
            setPollInterval(null);
          }
        }
      }
    } catch (error) {
      console.error('Error checking job status:', error);
    }
  };

  const cancelJob = async () => {
    if (!currentJob) return;

    try {
      const response = await fetch(`/api/bulk/jobs/${currentJob.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        setCurrentJob({ ...currentJob, status: 'cancelled' });
        setStep('results');
      }
    } catch (error) {
      console.error('Error cancelling job:', error);
    }
  };

  const retryJob = async () => {
    if (!currentJob) return;

    try {
      setIsLoading(true);
      setStep('processing');

      const response = await fetch(`/api/bulk/jobs/${currentJob.id}/retry`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        setCurrentJob({ ...currentJob, status: 'processing' });
        setJobProgress(0);
      } else {
        alert('Failed to retry job');
      }
    } catch (error) {
      console.error('Error retrying job:', error);
      alert('Retry failed');
    } finally {
      setIsLoading(false);
    }
  };

  const resetWizard = () => {
    setStep('template');
    setUploadedFile(null);
    setCsvData([]);
    setValidationErrors([]);
    setWarnings([]);
    setCurrentJob(null);
    setJobProgress(0);
  };

  const downloadResults = async () => {
    if (!currentJob) return;

    try {
      const response = await fetch(`/api/bulk/jobs/${currentJob.id}`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (response.ok) {
        const job = await response.json();

        // Create CSV with results
        const errorRows = job.errors.map((error: ValidationError) => ({
          rowNumber: error.rowNumber,
          field: error.field || 'N/A',
          error: error.error,
          severity: error.severity,
        }));

        const csv = [
          'Row Number,Field,Error,Severity',
          ...errorRows.map((row) =>
            `${row.rowNumber},"${row.field}","${row.error}",${row.severity}`
          ),
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `import-results-${currentJob.id}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error downloading results:', error);
    }
  };

  return (
    <div className="bulk-import-wizard">
      <div className="wizard-header">
        <h1>Bulk Import Wizard</h1>
        <p>Import data using CSV files with validation and error reporting</p>
      </div>

      <div className="wizard-steps">
        <div className={`step ${step === 'template' ? 'active' : 'completed'}`}>
          <div className="step-number">1</div>
          <div className="step-label">Select Template</div>
        </div>
        <div
          className={`step ${
            step === 'upload' ? 'active' : step === 'validate' || step === 'preview' || step === 'confirm' || step === 'processing' || step === 'results' ? 'completed' : ''
          }`}
        >
          <div className="step-number">2</div>
          <div className="step-label">Upload File</div>
        </div>
        <div
          className={`step ${
            step === 'validate' ? 'active' : step === 'preview' || step === 'confirm' || step === 'processing' || step === 'results' ? 'completed' : ''
          }`}
        >
          <div className="step-number">3</div>
          <div className="step-label">Validate</div>
        </div>
        <div
          className={`step ${step === 'preview' ? 'active' : step === 'confirm' || step === 'processing' || step === 'results' ? 'completed' : ''}`}
        >
          <div className="step-number">4</div>
          <div className="step-label">Preview</div>
        </div>
        <div
          className={`step ${step === 'confirm' ? 'active' : step === 'processing' || step === 'results' ? 'completed' : ''}`}
        >
          <div className="step-number">5</div>
          <div className="step-label">Confirm</div>
        </div>
        <div className={`step ${step === 'processing' ? 'active' : step === 'results' ? 'completed' : ''}`}>
          <div className="step-number">6</div>
          <div className="step-label">Processing</div>
        </div>
        <div className={`step ${step === 'results' ? 'active' : ''}`}>
          <div className="step-number">7</div>
          <div className="step-label">Results</div>
        </div>
      </div>

      <div className="wizard-content">
        {/* Template Selection */}
        {step === 'template' && (
          <div className="wizard-panel">
            <h2>Select Import Template</h2>
            <p>Choose the type of data you want to import</p>

            <div className="template-grid">
              {templates.length > 0 ? (
                templates.map((template) => (
                  <div
                    key={template}
                    className={`template-card ${selectedTemplate === template ? 'selected' : ''}`}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="template-icon">
                      {template === 'user' && '👤'}
                      {template === 'attorney' && '⚖️'}
                      {template === 'case' && '📋'}
                      {template === 'service' && '🔧'}
                      {template === 'document' && '📄'}
                    </div>
                    <div className="template-name">
                      {template.charAt(0).toUpperCase() + template.slice(1)}
                    </div>
                  </div>
                ))
              ) : (
                <p>No templates available</p>
              )}
            </div>

            <div className="template-actions">
              <button
                className="btn btn-secondary"
                onClick={downloadTemplate}
                disabled={isLoading}
              >
                {isLoading ? 'Downloading...' : '⬇️ Download Template'}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep('upload')}
              >
                Next: Upload File →
              </button>
            </div>
          </div>
        )}

        {/* File Upload */}
        {step === 'upload' && (
          <div className="wizard-panel">
            <h2>Upload CSV File</h2>
            <p>Upload a CSV file containing your data</p>

            <div
              className="file-upload-area"
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="upload-icon">📁</div>
              <h3>Drag and drop your CSV file</h3>
              <p>or click to browse</p>
              <p className="file-info">Maximum file size: 50MB</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />

            {uploadedFile && (
              <div className="file-info-card">
                <div className="file-name">
                  <span className="icon">✓</span>
                  {uploadedFile.name}
                </div>
                <div className="file-size">
                  {(uploadedFile.size / 1024).toFixed(2)} KB
                </div>
                <button
                  className="btn-remove"
                  onClick={() => setUploadedFile(null)}
                >
                  ✕
                </button>
              </div>
            )}

            <div className="wizard-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setStep('template')}
              >
                ← Back
              </button>
              <button
                className="btn btn-primary"
                onClick={validateCSV}
                disabled={!uploadedFile || isLoading}
              >
                {isLoading ? 'Validating...' : 'Validate CSV →'}
              </button>
            </div>
          </div>
        )}

        {/* Validation */}
        {step === 'validate' && (
          <div className="wizard-panel">
            <h2>Validation Results</h2>

            {validationErrors.length === 0 ? (
              <div className="success-message">
                <span className="icon">✓</span>
                <div>
                  <strong>CSV is valid!</strong>
                  <p>No errors found in your file</p>
                </div>
              </div>
            ) : (
              <div className="error-summary">
                <h3>Found {validationErrors.length} errors</h3>
                <div className="error-list">
                  {validationErrors.slice(0, 50).map((error, index) => (
                    <div key={index} className={`error-item error-${error.severity}`}>
                      <div className="error-row">Row {error.rowNumber}</div>
                      <div className="error-field">{error.field || 'General'}</div>
                      <div className="error-message">{error.error}</div>
                    </div>
                  ))}
                  {validationErrors.length > 50 && (
                    <div className="error-more">
                      +{validationErrors.length - 50} more errors
                    </div>
                  )}
                </div>
              </div>
            )}

            {warnings.length > 0 && (
              <div className="warning-summary">
                <h3>Warnings</h3>
                <ul>
                  {warnings.slice(0, 10).map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="wizard-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setStep('upload')}
              >
                ← Back
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep('preview')}
                disabled={validationErrors.length > 0}
              >
                Preview Data →
              </button>
            </div>
          </div>
        )}

        {/* Preview */}
        {step === 'preview' && (
          <div className="wizard-panel">
            <h2>Preview Data</h2>
            <p>Review your data before importing</p>

            <div className="preview-message">
              <span className="icon">ℹ️</span>
              Your CSV file is ready to import. Review the details below and configure import options.
            </div>

            <div className="wizard-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setStep('validate')}
              >
                ← Back
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setStep('confirm')}
              >
                Configure Import →
              </button>
            </div>
          </div>
        )}

        {/* Confirm */}
        {step === 'confirm' && (
          <div className="wizard-panel">
            <h2>Configure Import</h2>

            <div className="config-section">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                />
                <span>
                  <strong>Dry Run</strong>
                  <p>Test the import without saving to database</p>
                </span>
              </label>

              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={stopOnError}
                  onChange={(e) => setStopOnError(e.target.checked)}
                />
                <span>
                  <strong>Stop on First Error</strong>
                  <p>Stop processing if any row fails validation</p>
                </span>
              </label>
            </div>

            <div className="import-summary">
              <h3>Import Summary</h3>
              <ul>
                <li>Template: <strong>{selectedTemplate}</strong></li>
                <li>File: <strong>{uploadedFile?.name}</strong></li>
                <li>Size: <strong>{uploadedFile && (uploadedFile.size / 1024).toFixed(2)} KB</strong></li>
                <li>Mode: <strong>{dryRun ? 'Dry Run (No Changes)' : 'Live Import'}</strong></li>
              </ul>
            </div>

            <div className="wizard-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setStep('preview')}
              >
                ← Back
              </button>
              <button
                className="btn btn-success"
                onClick={startImport}
                disabled={!uploadedFile || isLoading}
              >
                {isLoading ? 'Starting...' : '▶️ Start Import'}
              </button>
            </div>
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && currentJob && (
          <div className="wizard-panel">
            <h2>Importing Data</h2>

            <div className="progress-section">
              <div className="progress-header">
                <span>Progress</span>
                <span className="progress-percent">{jobProgress}%</span>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar"
                  style={{ width: `${jobProgress}%` }}
                />
              </div>
              <div className="progress-stats">
                <div className="stat">
                  <span className="label">Total:</span>
                  <span className="value">{currentJob.totalRows}</span>
                </div>
                <div className="stat">
                  <span className="label">Processed:</span>
                  <span className="value">{currentJob.processedRows}</span>
                </div>
                <div className="stat">
                  <span className="label">Success:</span>
                  <span className="value success">{currentJob.successRows}</span>
                </div>
                <div className="stat">
                  <span className="label">Failed:</span>
                  <span className="value error">{currentJob.failedRows}</span>
                </div>
              </div>
            </div>

            <div className="processing-spinner">
              <div className="spinner"></div>
              <p>Processing your data...</p>
            </div>

            <div className="wizard-actions">
              <button
                className="btn btn-secondary"
                onClick={cancelJob}
              >
                ⊘ Cancel
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {step === 'results' && currentJob && (
          <div className="wizard-panel">
            <h2>Import Results</h2>

            <div className={`result-badge result-${currentJob.status}`}>
              {currentJob.status === 'completed' && '✓ Import Completed'}
              {currentJob.status === 'failed' && '✕ Import Failed'}
              {currentJob.status === 'cancelled' && '⊘ Import Cancelled'}
            </div>

            <div className="result-summary">
              <div className="result-stat">
                <span className="label">Total Rows:</span>
                <span className="value">{currentJob.totalRows}</span>
              </div>
              <div className="result-stat success">
                <span className="label">Successfully Imported:</span>
                <span className="value">{currentJob.successRows}</span>
              </div>
              <div className="result-stat error">
                <span className="label">Failed:</span>
                <span className="value">{currentJob.failedRows}</span>
              </div>
            </div>

            {currentJob.errors.length > 0 && (
              <div className="errors-section">
                <h3>Errors ({currentJob.errors.length})</h3>
                <div className="error-list">
                  {currentJob.errors.slice(0, 20).map((error, index) => (
                    <div key={index} className="error-item">
                      <div className="error-row">Row {error.rowNumber}</div>
                      <div className="error-message">{error.error}</div>
                    </div>
                  ))}
                  {currentJob.errors.length > 20 && (
                    <div className="error-more">
                      +{currentJob.errors.length - 20} more errors
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="wizard-actions">
              {currentJob.status === 'failed' && (
                <button
                  className="btn btn-primary"
                  onClick={retryJob}
                  disabled={isLoading}
                >
                  {isLoading ? 'Retrying...' : '🔄 Retry Import'}
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={downloadResults}
              >
                ⬇️ Download Results
              </button>
              <button
                className="btn btn-secondary"
                onClick={resetWizard}
              >
                ↻ Import Another File
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
