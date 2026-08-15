// Session Timeout Configuration
// Customize inactivity timeouts and warning thresholds per role

import { RoleTimeoutConfig, TimeoutConfig } from '../middleware/sessionTimeout';

// ============================================
// ENVIRONMENT-SPECIFIC CONFIGURATIONS
// ============================================

// Development configuration (longer timeouts for testing)
const developmentConfig: RoleTimeoutConfig = {
  admin: {
    inactivityTimeout: 60 * 60 * 1000, // 1 hour for dev
    warningTime: 10 * 60 * 1000,
    extendSessionDuration: 15 * 60 * 1000,
    requireReauth: true,
  },
  attorney: {
    inactivityTimeout: 60 * 60 * 1000,
    warningTime: 10 * 60 * 1000,
    extendSessionDuration: 15 * 60 * 1000,
    requireReauth: true,
  },
  firm: {
    inactivityTimeout: 60 * 60 * 1000,
    warningTime: 10 * 60 * 1000,
    extendSessionDuration: 15 * 60 * 1000,
    requireReauth: true,
  },
  client: {
    inactivityTimeout: 60 * 60 * 1000,
    warningTime: 10 * 60 * 1000,
    extendSessionDuration: 15 * 60 * 1000,
    requireReauth: true,
  },
};

// Production configuration (strict security)
const productionConfig: RoleTimeoutConfig = {
  admin: {
    inactivityTimeout: 20 * 60 * 1000, // 20 minutes
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 10 * 60 * 1000,
    requireReauth: true,
  },
  attorney: {
    inactivityTimeout: 30 * 60 * 1000, // 30 minutes - attorneys often in consultations
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 10 * 60 * 1000,
    requireReauth: true,
  },
  firm: {
    inactivityTimeout: 25 * 60 * 1000, // 25 minutes
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 10 * 60 * 1000,
    requireReauth: true,
  },
  client: {
    inactivityTimeout: 15 * 60 * 1000, // 15 minutes - stricter for client data security
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 5 * 60 * 1000,
    requireReauth: true,
  },
};

// Staging configuration (between dev and prod)
const stagingConfig: RoleTimeoutConfig = {
  admin: {
    inactivityTimeout: 30 * 60 * 1000,
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 10 * 60 * 1000,
    requireReauth: true,
  },
  attorney: {
    inactivityTimeout: 30 * 60 * 1000,
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 10 * 60 * 1000,
    requireReauth: true,
  },
  firm: {
    inactivityTimeout: 30 * 60 * 1000,
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 10 * 60 * 1000,
    requireReauth: true,
  },
  client: {
    inactivityTimeout: 20 * 60 * 1000,
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 10 * 60 * 1000,
    requireReauth: true,
  },
};

// ============================================
// CUSTOM CONFIGURATIONS FOR SPECIFIC SCENARIOS
// ============================================

// High Security Configuration (for sensitive operations)
export const highSecurityConfig: RoleTimeoutConfig = {
  admin: {
    inactivityTimeout: 10 * 60 * 1000, // 10 minutes
    warningTime: 3 * 60 * 1000,
    extendSessionDuration: 5 * 60 * 1000,
    requireReauth: true,
  },
  attorney: {
    inactivityTimeout: 15 * 60 * 1000,
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 5 * 60 * 1000,
    requireReauth: true,
  },
  firm: {
    inactivityTimeout: 15 * 60 * 1000,
    warningTime: 5 * 60 * 1000,
    extendSessionDuration: 5 * 60 * 1000,
    requireReauth: true,
  },
  client: {
    inactivityTimeout: 10 * 60 * 1000,
    warningTime: 3 * 60 * 1000,
    extendSessionDuration: 5 * 60 * 1000,
    requireReauth: true,
  },
};

// Relaxed Configuration (for low-risk internal tools)
export const relaxedConfig: RoleTimeoutConfig = {
  admin: {
    inactivityTimeout: 2 * 60 * 60 * 1000, // 2 hours
    warningTime: 30 * 60 * 1000,
    extendSessionDuration: 30 * 60 * 1000,
    requireReauth: true,
  },
  attorney: {
    inactivityTimeout: 2 * 60 * 60 * 1000,
    warningTime: 30 * 60 * 1000,
    extendSessionDuration: 30 * 60 * 1000,
    requireReauth: true,
  },
  firm: {
    inactivityTimeout: 2 * 60 * 60 * 1000,
    warningTime: 30 * 60 * 1000,
    extendSessionDuration: 30 * 60 * 1000,
    requireReauth: true,
  },
  client: {
    inactivityTimeout: 2 * 60 * 60 * 1000,
    warningTime: 30 * 60 * 1000,
    extendSessionDuration: 30 * 60 * 1000,
    requireReauth: false,
  },
};

// ============================================
// CONFIG GETTER
// ============================================

/**
 * Get session timeout configuration based on environment
 */
export function getSessionTimeoutConfig(): RoleTimeoutConfig {
  const env = process.env.NODE_ENV || 'development';
  const securityLevel = process.env.SESSION_SECURITY_LEVEL || 'default';

  // Allow environment variable override for security level
  if (securityLevel === 'high') {
    return highSecurityConfig;
  }

  if (securityLevel === 'relaxed') {
    return relaxedConfig;
  }

  // Default to environment-based config
  switch (env) {
    case 'production':
      return productionConfig;
    case 'staging':
      return stagingConfig;
    case 'development':
    default:
      return developmentConfig;
  }
}

/**
 * Get configuration for a specific role
 */
export function getRoleTimeoutConfig(role: string): TimeoutConfig {
  const config = getSessionTimeoutConfig();
  return (
    config[role] || {
      inactivityTimeout: 15 * 60 * 1000,
      warningTime: 5 * 60 * 1000,
      extendSessionDuration: 5 * 60 * 1000,
      requireReauth: true,
    }
  );
}

/**
 * Validate timeout configuration
 */
export function validateTimeoutConfig(config: TimeoutConfig): boolean {
  if (!Number.isInteger(config.inactivityTimeout) || config.inactivityTimeout <= 0) {
    console.error('Invalid inactivityTimeout: must be positive integer');
    return false;
  }

  if (!Number.isInteger(config.warningTime) || config.warningTime <= 0) {
    console.error('Invalid warningTime: must be positive integer');
    return false;
  }

  if (config.warningTime >= config.inactivityTimeout) {
    console.error('Invalid config: warningTime must be less than inactivityTimeout');
    return false;
  }

  if (!Number.isInteger(config.extendSessionDuration) || config.extendSessionDuration <= 0) {
    console.error('Invalid extendSessionDuration: must be positive integer');
    return false;
  }

  return true;
}

/**
 * Format timeout in milliseconds to human-readable string
 */
export function formatTimeout(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

// ============================================
// CONFIG DISPLAY UTILITIES
// ============================================

/**
 * Display configuration for debugging
 */
export function displaySessionConfig(): void {
  const config = getSessionTimeoutConfig();

  console.log('\n=== Session Timeout Configuration ===');
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Security Level: ${process.env.SESSION_SECURITY_LEVEL || 'default'}\n`);

  for (const [role, timeouts] of Object.entries(config)) {
    console.log(`${role.toUpperCase()}:`);
    console.log(
      `  Timeout: ${formatTimeout(timeouts.inactivityTimeout)}`
    );
    console.log(
      `  Warning: ${formatTimeout(timeouts.warningTime)}`
    );
    console.log(
      `  Extend: ${formatTimeout(timeouts.extendSessionDuration)}`
    );
    console.log('');
  }
}

// ============================================
// EXPORTS
// ============================================

export {
  developmentConfig,
  productionConfig,
  stagingConfig,
};

export default getSessionTimeoutConfig();
