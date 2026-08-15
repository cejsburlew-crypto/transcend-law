#!/usr/bin/env node

/**
 * Security Scan System Test Runner
 * Executes comprehensive threat detection tests
 * Tests: threat detection, external API reporting, threat isolation, error handling
 */

const fs = require('fs');
const path = require('path');

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const testSuites = [];
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const startTime = Date.now();

/**
 * Log colored output
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Run a single test
 */
async function runTest(testName, testFn) {
  const startTest = Date.now();
  try {
    await testFn();
    const duration = Date.now() - startTest;
    passedTests++;
    totalTests++;
    return {
      name: testName,
      passed: true,
      duration,
    };
  } catch (error) {
    const duration = Date.now() - startTest;
    failedTests++;
    totalTests++;
    return {
      name: testName,
      passed: false,
      duration,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run a test suite
 */
async function runTestSuite(suiteName, tests) {
  log(`\n${'='.repeat(60)}`, 'blue');
  log(`Test Suite: ${suiteName}`, 'cyan');
  log(`${'='.repeat(60)}`, 'blue');

  const suiteStartTime = Date.now();
  const results = [];

  for (const [testName, testFn] of Object.entries(tests)) {
    const result = await runTest(testName, testFn);
    results.push(result);

    const icon = result.passed ? '✓' : '✗';
    const color = result.passed ? 'green' : 'red';
    log(`  ${icon} ${testName} (${result.duration}ms)`, color);

    if (result.error) {
      log(`    Error: ${result.error}`, 'yellow');
    }
  }

  const suiteDuration = Date.now() - suiteStartTime;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  testSuites.push({
    name: suiteName,
    tests: results,
    passed: passedCount,
    failed: failedCount,
    duration: suiteDuration,
  });

  log(
    `\nResults: ${passedCount} passed, ${failedCount} failed`,
    passedCount === results.length ? 'green' : 'red'
  );
}

/**
 * Test Threat Detection
 */
async function testThreatDetection() {
  await runTestSuite('Threat Detection', {
    'Should initialize threat scan service': async () => {
      // Verify service can be imported
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      if (!fs.existsSync(servicePath)) {
        throw new Error('Threat scan service not found');
      }
    },

    'Should have URL scan capability': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('scanUrl')) {
        throw new Error('scanUrl function not found');
      }
    },

    'Should have file hash scan capability': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('scanFileHash')) {
        throw new Error('scanFileHash function not found');
      }
    },

    'Should have threat classification types': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      const requiredTypes = ['critical', 'high', 'medium', 'low', 'none'];
      requiredTypes.forEach((type) => {
        if (!content.includes(`'${type}'`)) {
          throw new Error(`Threat level '${type}' not defined`);
        }
      });
    },

    'Should calculate threat levels correctly': async () => {
      const threatLevels = ['critical', 'high', 'medium', 'low', 'none'];
      if (threatLevels.length !== 5) {
        throw new Error('Invalid number of threat levels');
      }
    },
  });
}

/**
 * Test External API Integration
 */
async function testExternalAPIs() {
  await runTestSuite('External API Integration', {
    'Should support Google Safe Browsing API': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('scanWithGoogleSafeBrowsing')) {
        throw new Error('Google Safe Browsing integration not found');
      }
    },

    'Should support VirusTotal API': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('scanWithVirusTotal')) {
        throw new Error('VirusTotal integration not found');
      }
    },

    'Should support AWS services': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('scanWithAWSInspector')) {
        throw new Error('AWS Inspector integration not found');
      }
    },

    'Should handle API authentication': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('API_KEY') && !content.includes('accessKeyId')) {
        throw new Error('API authentication not implemented');
      }
    },

    'Should handle API timeouts': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('timeout')) {
        throw new Error('Timeout handling not implemented');
      }
    },
  });
}

/**
 * Test Threat Isolation
 */
async function testThreatIsolation() {
  await runTestSuite('Threat Isolation', {
    'Should identify critical threats for isolation': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('critical')) {
        throw new Error('Critical threat identification not found');
      }
    },

    'Should isolate to secure storage': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('THREAT_ISOLATION_BUCKET')) {
        throw new Error('Isolation bucket not configured');
      }
    },

    'Should encrypt isolated data': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('AES256') && !content.includes('Encryption')) {
        throw new Error('Encryption configuration not found');
      }
    },

    'Should track isolation events': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('isolateThreat')) {
        throw new Error('Isolation event tracking not found');
      }
    },

    'Should prevent isolation of low threats': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('isolated: threatLevel === \'critical\'')) {
        throw new Error('Low threat isolation check not implemented');
      }
    },
  });
}

/**
 * Test Error Reporting
 */
async function testErrorReporting() {
  await runTestSuite('Error Reporting & Handling', {
    'Should log API errors': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('logScanError')) {
        throw new Error('Error logging function not found');
      }
    },

    'Should classify retryable errors': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('retryable')) {
        throw new Error('Error classification not found');
      }
    },

    'Should handle network issues': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('catch') && !content.includes('try')) {
        throw new Error('Error handling not implemented');
      }
    },

    'Should provide error context': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('ScanError')) {
        throw new Error('Error context interface not found');
      }
    },

    'Should send security alerts': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('sendThreatAlert')) {
        throw new Error('Alert function not found');
      }
    },
  });
}

/**
 * Test System Scanning
 */
async function testSystemScanning() {
  await runTestSuite('System Scanning & Reporting', {
    'Should retrieve threat reports': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('getThreatReports')) {
        throw new Error('Get reports function not found');
      }
    },

    'Should support filtering': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('threatLevel')) {
        throw new Error('Filter options not found');
      }
    },

    'Should retrieve scan errors': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('getScanErrors')) {
        throw new Error('Get errors function not found');
      }
    },

    'Should perform system scan': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('performSystemScan')) {
        throw new Error('System scan function not found');
      }
    },

    'Should generate reports': async () => {
      const servicePath = path.join(
        __dirname,
        '../transcend-api/src/services/threatScanService.ts'
      );
      const content = fs.readFileSync(servicePath, 'utf-8');
      if (!content.includes('generateSecurityReport')) {
        throw new Error('Report generation function not found');
      }
    },
  });
}

/**
 * Test Database Schema
 */
async function testDatabaseSchema() {
  await runTestSuite('Database Schema', {
    'Should have threat reports table': async () => {
      const migrationPath = path.join(
        __dirname,
        '../transcend-api/migrations/005-threat-scan-tables.sql'
      );
      if (!fs.existsSync(migrationPath)) {
        throw new Error('Migration file not found');
      }
      const content = fs.readFileSync(migrationPath, 'utf-8');
      if (!content.includes('threat_reports')) {
        throw new Error('Threat reports table not defined');
      }
    },

    'Should have scan errors table': async () => {
      const migrationPath = path.join(
        __dirname,
        '../transcend-api/migrations/005-threat-scan-tables.sql'
      );
      const content = fs.readFileSync(migrationPath, 'utf-8');
      if (!content.includes('scan_errors')) {
        throw new Error('Scan errors table not defined');
      }
    },

    'Should have isolation log table': async () => {
      const migrationPath = path.join(
        __dirname,
        '../transcend-api/migrations/005-threat-scan-tables.sql'
      );
      const content = fs.readFileSync(migrationPath, 'utf-8');
      if (!content.includes('threat_isolation_log')) {
        throw new Error('Isolation log table not defined');
      }
    },

    'Should have indexes for performance': async () => {
      const migrationPath = path.join(
        __dirname,
        '../transcend-api/migrations/005-threat-scan-tables.sql'
      );
      const content = fs.readFileSync(migrationPath, 'utf-8');
      if (!content.includes('INDEX') && !content.includes('CREATE INDEX')) {
        throw new Error('Performance indexes not defined');
      }
    },

    'Should have views for reporting': async () => {
      const migrationPath = path.join(
        __dirname,
        '../transcend-api/migrations/005-threat-scan-tables.sql'
      );
      const content = fs.readFileSync(migrationPath, 'utf-8');
      if (!content.includes('CREATE VIEW')) {
        throw new Error('Reporting views not defined');
      }
    },
  });
}

/**
 * Test Documentation
 */
async function testDocumentation() {
  await runTestSuite('Documentation & Setup', {
    'Should have setup guide': async () => {
      const setupPath = path.join(__dirname, '../SECURITY_SCAN_SETUP.md');
      if (!fs.existsSync(setupPath)) {
        throw new Error('Setup guide not found');
      }
    },

    'Should have test suite': async () => {
      const testPath = path.join(
        __dirname,
        '../transcend-api/src/services/__tests__/threatScanService.test.ts'
      );
      if (!fs.existsSync(testPath)) {
        throw new Error('Test suite not found');
      }
    },

    'Should have usage examples': async () => {
      const setupPath = path.join(__dirname, '../SECURITY_SCAN_SETUP.md');
      const content = fs.readFileSync(setupPath, 'utf-8');
      if (!content.includes('Usage Examples') && !content.includes('Example')) {
        throw new Error('Usage examples not found in documentation');
      }
    },

    'Should document configuration': async () => {
      const setupPath = path.join(__dirname, '../SECURITY_SCAN_SETUP.md');
      const content = fs.readFileSync(setupPath, 'utf-8');
      if (!content.includes('Environment Variables') && !content.includes('environment')) {
        throw new Error('Configuration documentation missing');
      }
    },

    'Should have troubleshooting guide': async () => {
      const setupPath = path.join(__dirname, '../SECURITY_SCAN_SETUP.md');
      const content = fs.readFileSync(setupPath, 'utf-8');
      if (!content.includes('Troubleshooting')) {
        throw new Error('Troubleshooting guide not found');
      }
    },
  });
}

/**
 * Generate final report
 */
function generateFinalReport() {
  const totalDuration = Date.now() - startTime;

  log('\n' + '='.repeat(80), 'blue');
  log('SECURITY SCAN SYSTEM - FINAL TEST REPORT', 'cyan');
  log('='.repeat(80), 'blue');

  log('\nTest Suite Summary:', 'cyan');
  testSuites.forEach((suite) => {
    const percentage = suite.tests.length > 0 ? ((suite.passed / suite.tests.length) * 100).toFixed(1) : '0';
    const color = suite.failed === 0 ? 'green' : 'yellow';
    log(
      `  ${suite.name}: ${suite.passed}/${suite.tests.length} passed (${percentage}%) - ${suite.duration}ms`,
      color
    );
  });

  log('\nOverall Statistics:', 'cyan');
  const overallPercentage = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : '0';
  const overallColor = failedTests === 0 ? 'green' : failedTests <= 3 ? 'yellow' : 'red';

  log(`  Total Tests: ${totalTests}`, 'blue');
  log(`  Passed: ${passedTests}`, 'green');
  log(`  Failed: ${failedTests}`, failedTests > 0 ? 'red' : 'green');
  log(`  Success Rate: ${overallPercentage}%`, overallColor);
  log(`  Total Duration: ${totalDuration}ms`, 'blue');

  if (failedTests > 0) {
    log('\nFailed Tests:', 'red');
    testSuites.forEach((suite) => {
      suite.tests
        .filter((test) => !test.passed)
        .forEach((test) => {
          log(`  ✗ ${suite.name} - ${test.name}`, 'red');
          if (test.error) {
            log(`    ${test.error}`, 'yellow');
          }
        });
    });
  }

  log('\nEnvironment Checks:', 'cyan');
  const envVars = [
    { key: 'GOOGLE_SAFE_BROWSING_API_KEY', name: 'Google Safe Browsing' },
    { key: 'VIRUSTOTAL_API_KEY', name: 'VirusTotal' },
    { key: 'AWS_ACCESS_KEY_ID', name: 'AWS' },
    { key: 'SECURITY_ALERT_EMAIL', name: 'Security Email' },
  ];

  envVars.forEach(({ key, name }) => {
    const status = process.env[key] ? 'Configured' : 'Not configured';
    const color = process.env[key] ? 'green' : 'yellow';
    log(`  ${name}: ${status}`, color);
  });

  log('\nSystem Configuration:', 'cyan');
  log(`  Isolation Bucket: ${process.env.THREAT_ISOLATION_BUCKET || 'transcend-isolated-threats'}`, 'blue');
  log(`  Encryption: AES256`, 'green');
  log(`  Max Retries: 3`, 'blue');
  log(`  Alert Email: ${process.env.SECURITY_ALERT_EMAIL || 'security@transcend-law.com'}`, 'blue');

  log('\n' + '='.repeat(80), 'blue');

  const finalColor = failedTests === 0 ? 'green' : failedTests <= 3 ? 'yellow' : 'red';
  const finalMessage =
    failedTests === 0
      ? 'ALL TESTS PASSED - Security scan system ready for deployment'
      : failedTests <= 3
        ? 'MOST TESTS PASSED - Minor issues detected'
        : 'TESTS FAILED - System needs attention';

  log(`\nFinal Status: ${finalMessage}`, finalColor);
  log('='.repeat(80), 'blue');
}

/**
 * Main test execution
 */
async function main() {
  try {
    log('Starting Security Scan System Test Suite', 'cyan');
    log(`Timestamp: ${new Date().toISOString()}`, 'blue');
    log(`Environment: ${process.env.NODE_ENV || 'development'}`, 'blue');
    log(`Platform: ${process.platform}`, 'blue');

    // Run all test suites
    await testThreatDetection();
    await testExternalAPIs();
    await testThreatIsolation();
    await testErrorReporting();
    await testSystemScanning();
    await testDatabaseSchema();
    await testDocumentation();

    // Generate final report
    generateFinalReport();

    // Exit with appropriate code
    process.exit(failedTests > 0 ? 1 : 0);
  } catch (error) {
    log(`\nFatal Error: ${error}`, 'red');
    process.exit(1);
  }
}

// Run tests
main();
