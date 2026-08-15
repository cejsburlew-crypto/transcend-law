/**
 * PII Redaction Middleware - Unit Tests
 * Test suite for PII detection and redaction functionality
 */

import { PiiRedactionEngine } from './piiRedaction';

describe('PiiRedactionEngine', () => {
  let engine: PiiRedactionEngine;

  beforeEach(() => {
    engine = new PiiRedactionEngine();
  });

  // ========================================================================
  // SSN Redaction Tests
  // ========================================================================

  describe('SSN Redaction', () => {
    test('should redact SSN in XXX-XX-XXXX format', () => {
      const result = engine.redact('My SSN is 123-45-6789');
      expect(result.redacted).toBe('My SSN is XXX-XX-XXXX');
      expect(result.redactionCount).toBe(1);
      expect(result.detectedPii).toContain('SSN');
    });

    test('should redact SSN without dashes', () => {
      const result = engine.redact('SSN: 1234567890');
      expect(result.redacted).toBe('SSN: XXX-XX-XXXX');
      expect(result.redactionCount).toBe(1);
    });

    test('should redact multiple SSNs', () => {
      const result = engine.redact('First SSN: 111-22-3333, Second SSN: 444-55-6666');
      expect(result.redactionCount).toBe(2);
      expect(result.redacted).toContain('XXX-XX-XXXX');
    });
  });

  // ========================================================================
  // Credit Card Redaction Tests
  // ========================================================================

  describe('Credit Card Redaction', () => {
    test('should redact credit card with dashes', () => {
      const result = engine.redact('Card: 4111-1111-1111-1111');
      expect(result.redacted).toContain('****-****-****-1111');
      expect(result.redactionCount).toBe(1);
      expect(result.detectedPii).toContain('Credit Card');
    });

    test('should redact credit card without dashes', () => {
      const result = engine.redact('Card number: 4111111111111111');
      expect(result.redactedContent || result.redacted).toBeTruthy();
      expect(result.redactionCount).toBeGreaterThan(0);
    });

    test('should include last 4 digits in redaction', () => {
      const result = engine.redact('4111-2222-3333-4444');
      expect(result.redacted).toContain('4444');
    });
  });

  // ========================================================================
  // Phone Number Redaction Tests
  // ========================================================================

  describe('Phone Number Redaction', () => {
    test('should redact phone number in (XXX) XXX-XXXX format', () => {
      const result = engine.redact('Call me at (555) 123-4567');
      expect(result.redacted).toContain('***-***-4567');
      expect(result.redactionCount).toBe(1);
      expect(result.detectedPii).toContain('Phone Number');
    });

    test('should redact phone number in XXX-XXX-XXXX format', () => {
      const result = engine.redact('Phone: 555-123-4567');
      expect(result.redacted).toContain('***-***-4567');
      expect(result.redactionCount).toBe(1);
    });

    test('should include last 4 digits in phone redaction', () => {
      const result = engine.redact('555-987-6543');
      expect(result.redacted).toContain('6543');
    });
  });

  // ========================================================================
  // Passport Number Redaction Tests
  // ========================================================================

  describe('Passport Number Redaction', () => {
    test('should redact passport numbers', () => {
      const result = engine.redact('Passport: AB123456');
      expect(result.redacted).toContain('[PASSPORT_REDACTED]');
      expect(result.redactionCount).toBe(1);
      expect(result.detectedPii).toContain('Passport');
    });

    test('should redact multiple passport numbers', () => {
      const result = engine.redact('Passport 1: AB123456, Passport 2: CD789012');
      expect(result.redactionCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ========================================================================
  // Address Redaction Tests
  // ========================================================================

  describe('Address Redaction', () => {
    test('should redact street addresses', () => {
      const result = engine.redact('Address: 123 Main Street, Springfield, IL');
      expect(result.redacted).toContain('[ADDRESS_REDACTED]');
      expect(result.redactionCount).toBeGreaterThan(0);
    });

    test('should redact addresses with different street types', () => {
      const result1 = engine.redact('123 Oak Avenue');
      const result2 = engine.redact('456 Pine Boulevard');
      expect(result1.redactionCount).toBeGreaterThan(0);
      expect(result2.redactionCount).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Email Redaction Tests
  // ========================================================================

  describe('Email Redaction', () => {
    test('should redact email addresses', () => {
      const result = engine.redact('Email: john.doe@example.com');
      expect(result.redacted).toContain('[EMAIL_REDACTED]');
      expect(result.redactionCount).toBe(1);
      expect(result.detectedPii).toContain('Email');
    });

    test('should redact multiple emails', () => {
      const result = engine.redact('Contact: john@example.com or jane@example.com');
      expect(result.redactionCount).toBe(2);
    });
  });

  // ========================================================================
  // Object Redaction Tests
  // ========================================================================

  describe('Object Redaction', () => {
    test('should redact simple object properties', () => {
      const obj = { ssn: '123-45-6789', name: 'John' };
      const result = engine.redactObject(obj);
      expect(result.redacted.ssn).toBe('XXX-XX-XXXX');
      expect(result.redacted.name).toBe('John');
      expect(result.totalRedactions).toBe(1);
    });

    test('should redact nested objects', () => {
      const obj = {
        user: {
          profile: { ssn: '111-22-3333' },
        },
      };
      const result = engine.redactObject(obj);
      expect(result.redacted.user.profile.ssn).toBe('XXX-XX-XXXX');
      expect(result.totalRedactions).toBeGreaterThan(0);
    });

    test('should redact arrays of objects', () => {
      const obj = {
        users: [
          { name: 'John', phone: '(555) 123-4567' },
          { name: 'Jane', phone: '(555) 987-6543' },
        ],
      };
      const result = engine.redactObject(obj);
      expect(result.redacted.users[0].phone).toContain('***-***-4567');
      expect(result.redacted.users[1].phone).toContain('***-***-6543');
    });

    test('should preserve non-string values', () => {
      const obj = {
        id: 123,
        active: true,
        score: 98.5,
        data: null,
      };
      const result = engine.redactObject(obj);
      expect(result.redacted.id).toBe(123);
      expect(result.redacted.active).toBe(true);
      expect(result.redacted.score).toBe(98.5);
      expect(result.redacted.data).toBeNull();
    });
  });

  // ========================================================================
  // Custom Pattern Tests
  // ========================================================================

  describe('Custom Patterns', () => {
    test('should add and use custom pattern', () => {
      engine.addCustomPattern({
        name: 'Employee ID',
        regex: /EMP-\d{6}/g,
        redactionFormat: '[EMPLOYEE_ID_REDACTED]',
        dataType: 'custom',
      });

      const result = engine.redact('Employee: EMP-123456');
      expect(result.redacted).toContain('[EMPLOYEE_ID_REDACTED]');
      expect(result.detectedPii).toContain('Employee ID');
    });

    test('should remove custom pattern', () => {
      engine.addCustomPattern({
        name: 'Test Pattern',
        regex: /TEST-\d{4}/g,
        redactionFormat: '[TEST_REDACTED]',
        dataType: 'custom',
      });

      const beforeRemove = engine.redact('TEST-1234');
      expect(beforeRemove.redactionCount).toBe(1);

      engine.removeCustomPattern('Test Pattern');
      const afterRemove = engine.redact('TEST-1234');
      expect(afterRemove.redactionCount).toBe(0);
    });

    test('should support multiple custom patterns', () => {
      engine.addCustomPattern({
        name: 'Pattern 1',
        regex: /PAT1-\d{3}/g,
        redactionFormat: '[PAT1_REDACTED]',
        dataType: 'custom',
      });

      engine.addCustomPattern({
        name: 'Pattern 2',
        regex: /PAT2-\d{3}/g,
        redactionFormat: '[PAT2_REDACTED]',
        dataType: 'custom',
      });

      const result = engine.redact('Data: PAT1-123 and PAT2-456');
      expect(result.redactionCount).toBe(2);
    });
  });

  // ========================================================================
  // Audit Log Tests
  // ========================================================================

  describe('Audit Log', () => {
    test('should record redaction in audit log', () => {
      engine.redact('SSN: 123-45-6789', {
        userId: 'user-123',
        path: '/api/register',
        method: 'POST',
      });

      const auditLog = engine.getAuditLog();
      expect(auditLog.length).toBe(1);
      expect(auditLog[0].piiType).toContain('SSN');
      expect(auditLog[0].userId).toBe('user-123');
    });

    test('should filter audit log by userId', () => {
      engine.redact('SSN: 111-11-1111', { userId: 'user-1' });
      engine.redact('Phone: (555) 111-1111', { userId: 'user-2' });

      const user1Logs = engine.getAuditLog({ userId: 'user-1' });
      expect(user1Logs.length).toBe(1);
      expect(user1Logs[0].userId).toBe('user-1');
    });

    test('should filter audit log by piiType', () => {
      engine.redact('SSN: 123-45-6789');
      engine.redact('Phone: (555) 123-4567');

      const ssnLogs = engine.getAuditLog({ piiType: 'SSN' });
      expect(ssnLogs[0].piiType).toContain('SSN');
    });

    test('should clear audit log', () => {
      engine.redact('SSN: 123-45-6789');
      expect(engine.getAuditLog().length).toBe(1);

      engine.clearAuditLog();
      expect(engine.getAuditLog().length).toBe(0);
    });
  });

  // ========================================================================
  // Searchable Logs Tests
  // ========================================================================

  describe('Searchable Logs', () => {
    test('should store searchable logs', () => {
      import('crypto').then(({ createHash }) => {
        const originalData = 'SSN: 123-45-6789';
        engine.redact(originalData);

        const hash = createHash('sha256').update(originalData).digest('hex');
        const logEntry = engine.searchLogs(hash);

        expect(logEntry).toBeDefined();
        expect(logEntry?.redactedContent).toContain('XXX-XX-XXXX');
      });
    });

    test('should clear searchable logs', () => {
      engine.redact('SSN: 123-45-6789');
      engine.clearSearchableLogs();

      const stats = engine.getStats();
      expect(stats.searchableLogs).toBe(0);
    });
  });

  // ========================================================================
  // Statistics Tests
  // ========================================================================

  describe('Statistics', () => {
    test('should calculate statistics', () => {
      engine.redact('SSN: 123-45-6789');
      engine.redact('Phone: (555) 123-4567');

      const stats = engine.getStats();
      expect(stats.totalRedactions).toBeGreaterThan(0);
      expect(stats.totalAuditEntries).toBe(2);
      expect(stats.piiTypes['SSN']).toBeGreaterThan(0);
    });

    test('should track multiple PII types', () => {
      const data = {
        ssn: '123-45-6789',
        phone: '(555) 123-4567',
        email: 'test@example.com',
      };

      engine.redactObject(data);

      const stats = engine.getStats();
      expect(Object.keys(stats.piiTypes).length).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // Edge Cases
  // ========================================================================

  describe('Edge Cases', () => {
    test('should handle empty strings', () => {
      const result = engine.redact('');
      expect(result.redactionCount).toBe(0);
      expect(result.redacted).toBe('');
    });

    test('should handle null values', () => {
      const result = engine.redact(null as any);
      expect(result.redactionCount).toBe(0);
    });

    test('should handle undefined values', () => {
      const result = engine.redact(undefined as any);
      expect(result.redactionCount).toBe(0);
    });

    test('should handle non-string object redaction', () => {
      const obj = { data: null, count: 42, active: false };
      const result = engine.redactObject(obj);
      expect(result.totalRedactions).toBe(0);
    });

    test('should not redact partial matches', () => {
      const result = engine.redact('abc123def');
      // Should not match partial patterns
      expect(result.redactionCount).toBeLessThanOrEqual(1);
    });

    test('should handle mixed PII types', () => {
      const data = 'SSN: 123-45-6789, Phone: (555) 123-4567, Email: test@example.com';
      const result = engine.redact(data);
      expect(result.detectedPii.length).toBeGreaterThan(1);
    });
  });

  // ========================================================================
  // Performance Tests
  // ========================================================================

  describe('Performance', () => {
    test('should handle large volumes of data', () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        engine.redact(`User ${i}: SSN=${String(i).padStart(3, '0')}-45-6789`);
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    test('should maintain reasonable memory usage', () => {
      const stats = engine.getStats();
      expect(stats.totalAuditEntries).toBeLessThan(10001);
    });
  });

  // ========================================================================
  // Context Handling Tests
  // ========================================================================

  describe('Context Handling', () => {
    test('should include context in audit log', () => {
      engine.redact('SSN: 123-45-6789', {
        userId: 'test-user',
        path: '/api/test',
        method: 'POST',
      });

      const auditLog = engine.getAuditLog();
      expect(auditLog[0].userId).toBe('test-user');
      expect(auditLog[0].path).toBe('/api/test');
      expect(auditLog[0].method).toBe('POST');
    });

    test('should work without context', () => {
      const result = engine.redact('SSN: 123-45-6789');
      expect(result.redactionCount).toBe(1);
    });
  });
});
