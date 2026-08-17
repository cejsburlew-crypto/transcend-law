// Provider data persistence utilities
// Handles saving and loading provider profile data from localStorage
// In production, this would connect to a backend API

interface ProviderData {
  id: string;
  name: string;
  email: string;
  phone: string;
  specialization: string;
  state: string;
  rating: number;
  reviews: number;
  yearsExperience: number;
  hourlyRate: number;
  verified: boolean;
  profileVisible: boolean;
  showContactInfo: boolean;
  lastUpdated: string;
}

const STORAGE_KEY = 'provider_profile';
const DUPLICATE_CHECK_KEY = 'provider_registry';

// Save provider profile to storage
export const saveProviderProfile = (provider: ProviderData): boolean => {
  try {
    const dataToSave = {
      ...provider,
      lastUpdated: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    return true;
  } catch (error) {
    console.error('Failed to save provider profile:', error);
    return false;
  }
};

// Load provider profile from storage
export const loadProviderProfile = (): ProviderData | null => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load provider profile:', error);
    return null;
  }
};

// Check for duplicate providers (same state + county + name)
export const checkDuplicateProvider = (
  name: string,
  state: string,
  county: string
): { isDuplicate: boolean; existingProvider?: any } => {
  try {
    const registry = localStorage.getItem(DUPLICATE_CHECK_KEY);
    if (!registry) return { isDuplicate: false };

    const providers = JSON.parse(registry);
    const duplicate = providers.find(
      (p: any) =>
        p.name.toLowerCase() === name.toLowerCase() &&
        p.state === state &&
        p.county === county
    );

    return {
      isDuplicate: !!duplicate,
      existingProvider: duplicate,
    };
  } catch (error) {
    console.error('Failed to check for duplicates:', error);
    return { isDuplicate: false };
  }
};

// Register provider in the registry (after ID.Me verification)
export const registerProviderInRegistry = (
  provider: ProviderData,
  county: string
): boolean => {
  try {
    let registry: any[] = [];
    const existing = localStorage.getItem(DUPLICATE_CHECK_KEY);
    if (existing) {
      registry = JSON.parse(existing);
    }

    // Check if provider already exists
    const existingIndex = registry.findIndex((p) => p.id === provider.id);
    if (existingIndex > -1) {
      registry[existingIndex] = { ...provider, county, registeredAt: new Date().toISOString() };
    } else {
      registry.push({ ...provider, county, registeredAt: new Date().toISOString() });
    }

    localStorage.setItem(DUPLICATE_CHECK_KEY, JSON.stringify(registry));
    return true;
  } catch (error) {
    console.error('Failed to register provider:', error);
    return false;
  }
};

// Get all registered providers (for duplicate checking and analytics)
export const getRegisteredProviders = (): any[] => {
  try {
    const registry = localStorage.getItem(DUPLICATE_CHECK_KEY);
    return registry ? JSON.parse(registry) : [];
  } catch (error) {
    console.error('Failed to get registry:', error);
    return [];
  }
};

// Verify provider data hasn't been tampered with
export const verifyProviderDataIntegrity = (provider: ProviderData): boolean => {
  // Check required fields
  const requiredFields = ['id', 'name', 'email', 'phone', 'specialization', 'state'];
  for (const field of requiredFields) {
    if (!provider[field as keyof ProviderData]) {
      return false;
    }
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(provider.email)) {
    return false;
  }

  // Validate phone format (basic)
  const phoneRegex = /^\d{10,}$/;
  if (!phoneRegex.test(provider.phone.replace(/\D/g, ''))) {
    return false;
  }

  // Validate rating range
  if (provider.rating < 0 || provider.rating > 5) {
    return false;
  }

  // Validate years of experience
  if (provider.yearsExperience < 0 || provider.yearsExperience > 70) {
    return false;
  }

  return true;
};

// Log access to sensitive data
export const logSensitiveDataAccess = (
  providerId: string,
  fieldAccessed: 'email' | 'phone' | 'contact_info'
): void => {
  try {
    const logs = localStorage.getItem('sensitive_access_logs') || '[]';
    const logArray = JSON.parse(logs);
    logArray.push({
      providerId,
      fieldAccessed,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
    // Keep only last 1000 logs
    if (logArray.length > 1000) {
      logArray.shift();
    }
    localStorage.setItem('sensitive_access_logs', JSON.stringify(logArray));
  } catch (error) {
    console.error('Failed to log access:', error);
  }
};
