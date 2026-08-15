/**
 * PII Redaction Middleware - Usage Examples
 * Demonstrates all features and use cases
 */

import {
  PiiRedactionEngine,
  redactionEngine,
  piiRedactionMiddleware,
  piiRedactionLoggingMiddleware,
  LogRedactor,
  initializePiiRedaction,
  exportAuditLog,
  getPiiRedactionStats,
} from './piiRedaction';

// ============================================================================
// EXAMPLE 1: Basic String Redaction
// ============================================================================

export function example1_BasicStringRedaction() {
  console.log('\n=== Example 1: Basic String Redaction ===');

  const sensitiveData = 'My SSN is 123-45-6789 and my phone is (555) 987-6543';

  const result = redactionEngine.redact(sensitiveData);

  console.log('Original:', sensitiveData);
  console.log('Redacted:', result.redacted);
  console.log('Redaction count:', result.redactionCount);
  console.log('Detected PII:', result.detectedPii);

  // Output:
  // Original: My SSN is 123-45-6789 and my phone is (555) 987-6543
  // Redacted: My SSN is XXX-XX-XXXX and my phone is ***-***-6543
  // Redaction count: 2
  // Detected PII: [ 'SSN', 'Phone Number' ]
}

// ============================================================================
// EXAMPLE 2: Object Redaction
// ============================================================================

export function example2_ObjectRedaction() {
  console.log('\n=== Example 2: Object Redaction ===');

  const userData = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john.doe@example.com',
    ssn: '123-45-6789',
    phone: '(555) 123-4567',
    bankAccount: '987654321098',
    address: '123 Main Street, Springfield, IL',
    creditCard: '4111-1111-1111-1111',
  };

  const result = redactionEngine.redactObject(userData);

  console.log('Original:', JSON.stringify(userData, null, 2));
  console.log('Redacted:', JSON.stringify(result.redacted, null, 2));
  console.log('Total redactions:', result.totalRedactions);
  console.log('Detected PII types:', result.detectedPii);

  // Output shows all PII fields redacted appropriately
}

// ============================================================================
// EXAMPLE 3: Custom PII Patterns
// ============================================================================

export function example3_CustomPatterns() {
  console.log('\n=== Example 3: Custom PII Patterns ===');

  // Create a new engine with custom patterns
  const customEngine = new PiiRedactionEngine();

  // Add custom patterns for your business needs
  customEngine.addCustomPattern({
    name: 'Driver License',
    regex: /\b[A-Z]{1,2}\d{5,8}\b/g,
    redactionFormat: '[DL_REDACTED]',
    dataType: 'custom',
  });

  customEngine.addCustomPattern({
    name: 'Medical Record Number',
    regex: /MR-\d{6,10}/g,
    redactionFormat: '[MED_RECORD_REDACTED]',
    dataType: 'custom',
  });

  customEngine.addCustomPattern({
    name: 'Case Number',
    regex: /CASE-\d{4}-\d{6}/g,
    redactionFormat: '[CASE_REDACTED]',
    dataType: 'custom',
  });

  // Test with custom pattern
  const data = 'Driver License: CA12345 and Medical Record: MR-2024001234';
  const result = customEngine.redact(data);

  console.log('Original:', data);
  console.log('Redacted:', result.redacted);
  console.log('Detected:', result.detectedPii);

  // Output:
  // Original: Driver License: CA12345 and Medical Record: MR-2024001234
  // Redacted: Driver License: [DL_REDACTED] and Medical Record: [MED_RECORD_REDACTED]
  // Detected: [ 'Driver License', 'Medical Record Number' ]
}

// ============================================================================
// EXAMPLE 4: Audit Log Access
// ============================================================================

export function example4_AuditLogAccess() {
  console.log('\n=== Example 4: Audit Log Access ===');

  // Simulate some redactions
  redactionEngine.redact('SSN: 123-45-6789', {
    userId: 'user-001',
    path: '/api/register',
    method: 'POST',
  });

  redactionEngine.redact('Phone: (555) 123-4567', {
    userId: 'user-002',
    path: '/api/profile',
    method: 'PUT',
  });

  // Get all audit entries
  const allEntries = redactionEngine.getAuditLog();
  console.log('All audit entries:', allEntries.length);

  // Filter by user
  const user001Entries = redactionEngine.getAuditLog({ userId: 'user-001' });
  console.log('Entries for user-001:', user001Entries);

  // Filter by PII type
  const ssnRedactions = redactionEngine.getAuditLog({ piiType: 'SSN' });
  console.log('SSN redactions:', ssnRedactions);
}

// ============================================================================
// EXAMPLE 5: Searchable Logs
// ============================================================================

export function example5_SearchableLogs() {
  console.log('\n=== Example 5: Searchable Logs ===');

  import('crypto').then(({ createHash }) => {
    // When storing data, we redact it and maintain a hash
    const originalSSN = '123-45-6789';
    const result = redactionEngine.redact(`SSN: ${originalSSN}`);

    console.log('Redacted log entry:', result.redacted);

    // Later, to find this entry, we can use the hash
    const hash = createHash('sha256').update(`SSN: ${originalSSN}`).digest('hex');
    const logEntry = redactionEngine.searchLogs(hash);

    if (logEntry) {
      console.log('Found log entry:', logEntry);
      console.log('Redacted content:', logEntry.redactedContent);
      console.log('Timestamp:', logEntry.timestamp);
    }
  });
}

// ============================================================================
// EXAMPLE 6: Statistics & Monitoring
// ============================================================================

export function example6_Statistics() {
  console.log('\n=== Example 6: Statistics & Monitoring ===');

  // Simulate various redactions
  const testData = [
    'SSN: 111-22-3333',
    'Phone: (555) 444-5555',
    'Credit Card: 4111-1111-1111-1111',
    'Email: user@example.com',
  ];

  testData.forEach(data => redactionEngine.redact(data));

  // Get statistics
  const stats = getPiiRedactionStats();

  console.log('PII Redaction Statistics:');
  console.log('  Total redactions:', stats.totalRedactions);
  console.log('  Total audit entries:', stats.totalAuditEntries);
  console.log('  Searchable logs:', stats.searchableLogs);
  console.log('  PII types breakdown:', stats.piiTypes);
}

// ============================================================================
// EXAMPLE 7: Express Middleware Integration
// ============================================================================

export function example7_ExpressMiddleware() {
  console.log('\n=== Example 7: Express Middleware Integration ===');

  import('express').then(({ default: express }) => {
    const app = express();

    // Apply middleware in correct order
    app.use(express.json());
    app.use(piiRedactionMiddleware({ enableResponseRedaction: true }));
    app.use(piiRedactionLoggingMiddleware({ verbose: true }));

    // Example route
    app.post('/api/user-data', (req, res) => {
      console.log('Request body (already redacted):', req.body);

      // Check if redaction occurred
      if ((req as any).piiRedactionInfo) {
        console.log('PII redaction applied:', (req as any).piiRedactionInfo);
      }

      res.json({
        success: true,
        message: 'User data received',
      });
    });

    console.log('Middleware configured for Express app');
  });
}

// ============================================================================
// EXAMPLE 8: Console Interception
// ============================================================================

export function example8_ConsoleInterception() {
  console.log('\n=== Example 8: Console Interception ===');

  const logRedactor = new LogRedactor(redactionEngine);

  // Override console.log to redact automatically
  logRedactor.interceptConsole();

  // Now any console.log will have PII redacted
  console.log('User SSN: 123-45-6789'); // Outputs: User SSN: XXX-XX-XXXX
  console.log('Phone: (555) 123-4567'); // Outputs: Phone: ***-***-4567

  // Restore original behavior
  logRedactor.restoreConsole();

  console.log('Console interception restored');
}

// ============================================================================
// EXAMPLE 9: Export Audit Logs
// ============================================================================

export function example9_ExportAuditLogs() {
  console.log('\n=== Example 9: Export Audit Logs ===');

  // Simulate some redactions
  redactionEngine.redact('SSN: 123-45-6789', {
    userId: 'user-001',
    path: '/api/register',
  });

  redactionEngine.redact('Phone: (555) 123-4567', {
    userId: 'user-002',
    path: '/api/profile',
  });

  // Export all logs
  const allLogs = exportAuditLog();
  console.log('All logs exported (JSON)');

  // Export filtered logs
  const user001Logs = exportAuditLog({ userId: 'user-001' });
  console.log('Filtered logs for user-001:', user001Logs);

  // In real app, save to file
  // fs.writeFileSync('audit_logs.json', allLogs);
}

// ============================================================================
// EXAMPLE 10: Compliance Reporting
// ============================================================================

export function example10_ComplianceReport() {
  console.log('\n=== Example 10: Compliance Reporting ===');

  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Generate compliance report
  const complianceReport = {
    reportDate: today.toISOString(),
    period: {
      start: startOfMonth.toISOString(),
      end: today.toISOString(),
    },
    statistics: getPiiRedactionStats(),
    recentRedactions: redactionEngine.getAuditLog({
      startTime: startOfMonth,
      endTime: today,
    }),
  };

  console.log('Compliance Report Generated:');
  console.log(JSON.stringify(complianceReport, null, 2));

  // In production: fs.writeFileSync('compliance_report.json', JSON.stringify(...))
}

// ============================================================================
// EXAMPLE 11: Production Configuration
// ============================================================================

export function example11_ProductionConfiguration() {
  console.log('\n=== Example 11: Production Configuration ===');

  // Initialize with custom patterns for your business
  const customPatterns = [
    {
      name: 'Internal Employee ID',
      regex: /EMP-\d{6}/g,
      redactionFormat: '[EMPLOYEE_ID_REDACTED]',
      dataType: 'custom' as const,
    },
    {
      name: 'Project Code',
      regex: /PROJ-[A-Z]{3}-\d{4}/g,
      redactionFormat: '[PROJECT_REDACTED]',
      dataType: 'custom' as const,
    },
  ];

  initializePiiRedaction(customPatterns);

  console.log('Production PII redaction initialized with custom patterns');
  console.log('Statistics:', getPiiRedactionStats());
}

// ============================================================================
// EXAMPLE 12: Error Handling and Context
// ============================================================================

export function example12_ErrorHandling() {
  console.log('\n=== Example 12: Error Handling & Context ===');

  // Test with different context
  const sensitiveError = new Error('Database error for user with SSN 123-45-6789');

  const result = redactionEngine.redact(sensitiveError.message, {
    userId: 'admin-001',
    path: '/api/debug',
    method: 'GET',
  });

  console.log('Original error:', sensitiveError.message);
  console.log('Redacted error:', result.redacted);
  console.log('Audit trail includes context:', redactionEngine.getAuditLog());
}

// ============================================================================
// EXAMPLE 13: Nested Object Redaction
// ============================================================================

export function example13_NestedObjectRedaction() {
  console.log('\n=== Example 13: Nested Object Redaction ===');

  const complexData = {
    user: {
      id: 'user-123',
      profile: {
        ssn: '123-45-6789',
        phone: '(555) 123-4567',
        address: {
          street: '123 Main Street',
          city: 'Springfield',
          state: 'IL',
        },
      },
      documents: [
        { type: 'passport', number: 'AB123456' },
        { type: 'driver_license', number: 'DL987654' },
      ],
    },
    financials: {
      bankAccount: '987654321098',
      creditCard: '4111-1111-1111-1111',
    },
  };

  const result = redactionEngine.redactObject(complexData);

  console.log('Redacted nested object:', JSON.stringify(result.redacted, null, 2));
  console.log('Total redactions:', result.totalRedactions);
  console.log('All PII types detected:', result.detectedPii);
}

// ============================================================================
// EXAMPLE 14: Performance Monitoring
// ============================================================================

export function example14_PerformanceMonitoring() {
  console.log('\n=== Example 14: Performance Monitoring ===');

  const startTime = Date.now();

  // Simulate high-volume redactions
  for (let i = 0; i < 1000; i++) {
    redactionEngine.redact(
      `User ${i}: SSN=${String(i).padStart(3, '0')}-45-6789, Phone=(555) 123-${String(i % 10000).padStart(4, '0')}`
    );
  }

  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log(`Processed 1000 redactions in ${duration}ms`);
  console.log(`Average: ${(duration / 1000).toFixed(3)}ms per redaction`);

  const stats = getPiiRedactionStats();
  console.log('Final statistics:', stats);
}

// ============================================================================
// EXAMPLE 15: Cleanup and Maintenance
// ============================================================================

export function example15_Cleanup() {
  console.log('\n=== Example 15: Cleanup and Maintenance ===');

  // Get stats before cleanup
  const statsBeforeCleanup = getPiiRedactionStats();
  console.log('Before cleanup:', statsBeforeCleanup);

  // Clear audit logs
  redactionEngine.clearAuditLog();
  console.log('Audit logs cleared');

  // Clear searchable logs
  redactionEngine.clearSearchableLogs();
  console.log('Searchable logs cleared');

  // Get stats after cleanup
  const statsAfterCleanup = getPiiRedactionStats();
  console.log('After cleanup:', statsAfterCleanup);
}

// ============================================================================
// Run All Examples
// ============================================================================

export function runAllExamples() {
  console.log('========================================');
  console.log('PII Redaction Middleware - All Examples');
  console.log('========================================');

  example1_BasicStringRedaction();
  example2_ObjectRedaction();
  example3_CustomPatterns();
  example4_AuditLogAccess();
  // example5_SearchableLogs(); // Async
  example6_Statistics();
  // example7_ExpressMiddleware(); // Async
  example8_ConsoleInterception();
  example9_ExportAuditLogs();
  example10_ComplianceReport();
  example11_ProductionConfiguration();
  example12_ErrorHandling();
  example13_NestedObjectRedaction();
  example14_PerformanceMonitoring();
  example15_Cleanup();

  console.log('\n========================================');
  console.log('All examples completed');
  console.log('========================================\n');
}

// Run if executed directly
if (require.main === module) {
  runAllExamples();
}
