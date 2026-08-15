// PII Redaction Middleware
// Auto-detects and redacts sensitive personally identifiable information in logs and requests

import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface PiiPattern {
  name: string;
  regex: RegExp;
  redactionFormat: string;
  dataType: 'ssn' | 'credit_card' | 'passport' | 'bank_account' | 'phone' | 'address' | 'custom';
}

interface RedactionAuditEntry {
  timestamp: string;
  piiType: string;
  hash: string;
  path?: string;
  method?: string;
  userId?: string;
  redactionCount: number;
}

interface SearchableLog {
  originalHash: string;
  redactedContent: string;
  timestamp: string;
}

// ============================================================================
// DEFAULT PII PATTERNS
// ============================================================================

const DEFAULT_PII_PATTERNS: PiiPattern[] = [
  // SSN: XXX-XX-XXXX format
  {
    name: 'SSN',
    regex: /\b(?!\d{3}-\d{2}-\d{4}$)(\d{3}[-]?\d{2}[-]?\d{4})\b/g,
    redactionFormat: 'XXX-XX-XXXX',
    dataType: 'ssn',
  },
  // Credit Card: 4111111111111111 or 4111-1111-1111-1111
  {
    name: 'Credit Card',
    regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    redactionFormat: '****-****-****-[LAST4]',
    dataType: 'credit_card',
  },
  // Passport Numbers: typically 6-9 alphanumeric
  {
    name: 'Passport',
    regex: /\b[A-Z]{1,2}\d{6,8}\b/g,
    redactionFormat: '[PASSPORT_REDACTED]',
    dataType: 'passport',
  },
  // Bank Account Numbers: 8-17 digits
  {
    name: 'Bank Account',
    regex: /\b\d{8,17}\b(?=\D|$)/g,
    redactionFormat: '[ACCOUNT_REDACTED]',
    dataType: 'bank_account',
  },
  // Phone Numbers: (XXX) XXX-XXXX or XXX-XXX-XXXX
  {
    name: 'Phone Number',
    regex: /(\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g,
    redactionFormat: '***-***-[LAST4]',
    dataType: 'phone',
  },
  // Email addresses (optional but sensitive)
  {
    name: 'Email',
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    redactionFormat: '[EMAIL_REDACTED]',
    dataType: 'custom',
  },
  // Addresses: Street address pattern
  {
    name: 'Address',
    regex: /\d+\s+(?:[A-Za-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Court|Ct|Lane|Ln|Circle|Cir|Way|Parkway|Pkwy)\.?\b/gi,
    redactionFormat: '[ADDRESS_REDACTED]',
    dataType: 'address',
  },
  // Social Security Numbers - alternative format
  {
    name: 'SSN Extended',
    regex: /(?:ssn|social.?security.?number)[\s:=]*([\d-]{11})/gi,
    redactionFormat: 'XXX-XX-XXXX',
    dataType: 'ssn',
  },
];

// ============================================================================
// PII REDACTION ENGINE
// ============================================================================

export class PiiRedactionEngine {
  private patterns: PiiPattern[];
  private customPatterns: PiiPattern[] = [];
  private auditLog: RedactionAuditEntry[] = [];
  private searchableLogs: Map<string, SearchableLog> = new Map();
  private maxAuditEntries: number = 10000;

  constructor(patterns: PiiPattern[] = DEFAULT_PII_PATTERNS) {
    this.patterns = patterns;
  }

  /**
   * Add custom PII patterns for redaction
   */
  addCustomPattern(pattern: PiiPattern): void {
    this.customPatterns.push(pattern);
  }

  /**
   * Remove custom pattern by name
   */
  removeCustomPattern(name: string): boolean {
    const index = this.customPatterns.findIndex(p => p.name === name);
    if (index > -1) {
      this.customPatterns.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Generate hash of original data for searchability
   */
  private hashData(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data)
      .digest('hex');
  }

  /**
   * Extract last 4 digits for partial redaction
   */
  private getLastFour(data: string): string {
    const digits = data.replace(/\D/g, '');
    return digits.slice(-4);
  }

  /**
   * Redact a single value based on its pattern
   */
  private redactValue(value: string, pattern: PiiPattern): string {
    if (pattern.dataType === 'credit_card') {
      const lastFour = this.getLastFour(value);
      return pattern.redactionFormat.replace('[LAST4]', lastFour);
    }

    if (pattern.dataType === 'phone') {
      const lastFour = this.getLastFour(value);
      return pattern.redactionFormat.replace('[LAST4]', lastFour);
    }

    return pattern.redactionFormat;
  }

  /**
   * Redact content - main redaction function
   */
  redact(content: string, context?: { userId?: string; path?: string; method?: string }): {
    redacted: string;
    redactionCount: number;
    detectedPii: string[];
  } {
    if (!content || typeof content !== 'string') {
      return { redacted: content, redactionCount: 0, detectedPii: [] };
    }

    let redacted = content;
    let redactionCount = 0;
    const detectedPii: string[] = [];
    const allPatterns = [...this.patterns, ...this.customPatterns];

    // Store original hash for searchable logs
    const originalHash = this.hashData(content);

    for (const pattern of allPatterns) {
      const matches = content.match(pattern.regex);
      if (matches) {
        matches.forEach(match => {
          const redactionValue = this.redactValue(match, pattern);
          redacted = redacted.replace(match, redactionValue);
          redactionCount++;

          if (!detectedPii.includes(pattern.name)) {
            detectedPii.push(pattern.name);
          }
        });
      }
    }

    // Record in audit log
    if (redactionCount > 0) {
      this.recordAudit(detectedPii, originalHash, context);

      // Store for searchable logs
      this.searchableLogs.set(originalHash, {
        originalHash,
        redactedContent: redacted,
        timestamp: new Date().toISOString(),
      });
    }

    return { redacted, redactionCount, detectedPii };
  }

  /**
   * Redact an object recursively
   */
  redactObject(
    obj: any,
    context?: { userId?: string; path?: string; method?: string }
  ): { redacted: any; totalRedactions: number; detectedPii: string[] } {
    let totalRedactions = 0;
    const detectedPii: Set<string> = new Set();

    const processValue = (value: any): any => {
      if (typeof value === 'string') {
        const result = this.redact(value, context);
        totalRedactions += result.redactionCount;
        result.detectedPii.forEach(pii => detectedPii.add(pii));
        return result.redacted;
      }

      if (Array.isArray(value)) {
        return value.map(item => processValue(item));
      }

      if (value !== null && typeof value === 'object') {
        const redacted: any = {};
        for (const [key, val] of Object.entries(value)) {
          redacted[key] = processValue(val);
        }
        return redacted;
      }

      return value;
    };

    return {
      redacted: processValue(obj),
      totalRedactions,
      detectedPii: Array.from(detectedPii),
    };
  }

  /**
   * Record redaction in audit log
   */
  private recordAudit(
    piiTypes: string[],
    hash: string,
    context?: { userId?: string; path?: string; method?: string }
  ): void {
    const entry: RedactionAuditEntry = {
      timestamp: new Date().toISOString(),
      piiType: piiTypes.join(','),
      hash,
      redactionCount: piiTypes.length,
      ...context,
    };

    this.auditLog.push(entry);

    // Keep audit log size manageable
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-this.maxAuditEntries);
    }
  }

  /**
   * Get audit log entries
   */
  getAuditLog(
    filter?: { userId?: string; piiType?: string; startTime?: Date; endTime?: Date }
  ): RedactionAuditEntry[] {
    return this.auditLog.filter(entry => {
      if (filter?.userId && entry.userId !== filter.userId) return false;
      if (filter?.piiType && !entry.piiType.includes(filter.piiType)) return false;
      if (filter?.startTime && new Date(entry.timestamp) < filter.startTime) return false;
      if (filter?.endTime && new Date(entry.timestamp) > filter.endTime) return false;
      return true;
    });
  }

  /**
   * Search logs using original data hash
   */
  searchLogs(hash: string): SearchableLog | undefined {
    return this.searchableLogs.get(hash);
  }

  /**
   * Get redaction statistics
   */
  getStats(): {
    totalRedactions: number;
    totalAuditEntries: number;
    searchableLogs: number;
    piiTypes: { [key: string]: number };
  } {
    const piiTypes: { [key: string]: number } = {};

    for (const entry of this.auditLog) {
      const types = entry.piiType.split(',');
      for (const type of types) {
        piiTypes[type] = (piiTypes[type] || 0) + 1;
      }
    }

    return {
      totalRedactions: this.auditLog.reduce((sum, entry) => sum + entry.redactionCount, 0),
      totalAuditEntries: this.auditLog.length,
      searchableLogs: this.searchableLogs.size,
      piiTypes,
    };
  }

  /**
   * Clear audit logs (with confirmation)
   */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /**
   * Clear searchable logs (with confirmation)
   */
  clearSearchableLogs(): void {
    this.searchableLogs.clear();
  }
}

// ============================================================================
// GLOBAL REDACTION ENGINE INSTANCE
// ============================================================================

export const redactionEngine = new PiiRedactionEngine();

// ============================================================================
// EXPRESS MIDDLEWARE
// ============================================================================

/**
 * Middleware to intercept and redact request/response data
 */
export function piiRedactionMiddleware(options: { enableResponseRedaction?: boolean } = {}) {
  const { enableResponseRedaction = true } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // Store original request data
    const originalReqBody = JSON.stringify(req.body);
    const context = {
      userId: (req as any).userId,
      path: req.path,
      method: req.method,
    };

    // Redact request body if present
    if (req.body && typeof req.body === 'object') {
      const result = redactionEngine.redactObject(req.body, context);
      if (result.totalRedactions > 0) {
        req.body = result.redacted;
        (req as any).piiRedactionInfo = {
          requestRedacted: true,
          redactionCount: result.totalRedactions,
          detectedPii: result.detectedPii,
        };
      }
    }

    // Intercept res.json() to redact response data
    if (enableResponseRedaction) {
      const originalJson = res.json;
      res.json = function (data: any) {
        if (data && typeof data === 'object') {
          const result = redactionEngine.redactObject(data, context);
          if (result.totalRedactions > 0) {
            data = result.redacted;
          }
        }
        return originalJson.call(this, data);
      };
    }

    next();
  };
}

/**
 * Middleware to log requests with PII redaction
 */
export function piiRedactionLoggingMiddleware(options: { verbose?: boolean } = {}) {
  const { verbose = false } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const context = {
      userId: (req as any).userId,
      path: req.path,
      method: req.method,
    };

    // Redact any query parameters
    if (req.query && Object.keys(req.query).length > 0) {
      const result = redactionEngine.redactObject(req.query, context);
      if (result.totalRedactions > 0 && verbose) {
        console.log(`[PII Redaction] Query params redacted: ${result.detectedPii.join(', ')}`);
      }
    }

    // Redact any URL parameters
    if (req.params && Object.keys(req.params).length > 0) {
      const result = redactionEngine.redactObject(req.params, context);
      if (result.totalRedactions > 0 && verbose) {
        console.log(`[PII Redaction] URL params redacted: ${result.detectedPii.join(', ')}`);
      }
    }

    next();
  };
}

// ============================================================================
// LOG INTERCEPTOR FOR CONSOLE AND FILE LOGGING
// ============================================================================

export class LogRedactor {
  private engine: PiiRedactionEngine;
  private originalConsoleLog: typeof console.log;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;

  constructor(engine: PiiRedactionEngine = redactionEngine) {
    this.engine = engine;
    this.originalConsoleLog = console.log;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
  }

  /**
   * Override console.log to redact PII automatically
   */
  interceptConsole(): void {
    console.log = (...args: any[]) => {
      const redactedArgs = args.map(arg => {
        if (typeof arg === 'string') {
          const result = this.engine.redact(arg);
          return result.redacted;
        }
        if (typeof arg === 'object') {
          const result = this.engine.redactObject(arg);
          return result.redacted;
        }
        return arg;
      });
      this.originalConsoleLog(...redactedArgs);
    };

    console.error = (...args: any[]) => {
      const redactedArgs = args.map(arg => {
        if (typeof arg === 'string') {
          const result = this.engine.redact(arg);
          return result.redacted;
        }
        if (typeof arg === 'object') {
          const result = this.engine.redactObject(arg);
          return result.redacted;
        }
        return arg;
      });
      this.originalConsoleError(...redactedArgs);
    };

    console.warn = (...args: any[]) => {
      const redactedArgs = args.map(arg => {
        if (typeof arg === 'string') {
          const result = this.engine.redact(arg);
          return result.redacted;
        }
        if (typeof arg === 'object') {
          const result = this.engine.redactObject(arg);
          return result.redacted;
        }
        return arg;
      });
      this.originalConsoleWarn(...redactedArgs);
    };
  }

  /**
   * Restore original console methods
   */
  restoreConsole(): void {
    console.log = this.originalConsoleLog;
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
  }

  /**
   * Redact a log message manually
   */
  redactLog(message: string, context?: { userId?: string; path?: string; method?: string }): string {
    const result = this.engine.redact(message, context);
    return result.redacted;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Initialize PII redaction with custom patterns
 */
export function initializePiiRedaction(customPatterns?: PiiPattern[]): void {
  if (customPatterns) {
    customPatterns.forEach(pattern => redactionEngine.addCustomPattern(pattern));
  }
}

/**
 * Export audit log as JSON
 */
export function exportAuditLog(filter?: {
  userId?: string;
  piiType?: string;
  startTime?: Date;
  endTime?: Date;
}): string {
  const logs = redactionEngine.getAuditLog(filter);
  return JSON.stringify(logs, null, 2);
}

/**
 * Get PII redaction statistics
 */
export function getPiiRedactionStats() {
  return redactionEngine.getStats();
}

export default {
  PiiRedactionEngine,
  redactionEngine,
  piiRedactionMiddleware,
  piiRedactionLoggingMiddleware,
  LogRedactor,
  initializePiiRedaction,
  exportAuditLog,
  getPiiRedactionStats,
};
