import { useState, useEffect, useCallback } from 'react';
import {
  saveProviderProfile,
  loadProviderProfile,
  checkDuplicateProvider,
  registerProviderInRegistry,
  verifyProviderDataIntegrity,
  logSensitiveDataAccess,
} from '../utils/providerDataPersistence';

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
}

interface UseProviderDataReturn {
  provider: ProviderData | null;
  loading: boolean;
  error: string | null;
  saveProfile: (provider: ProviderData) => Promise<boolean>;
  checkDuplicate: (name: string, state: string, county: string) => { isDuplicate: boolean };
  registerProvider: (county: string) => Promise<boolean>;
  logDataAccess: (field: 'email' | 'phone' | 'contact_info') => void;
}

export const useProviderData = (): UseProviderDataReturn => {
  const [provider, setProvider] = useState<ProviderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load provider profile on mount
  useEffect(() => {
    try {
      const savedProvider = loadProviderProfile();
      setProvider(savedProvider);
    } catch (err) {
      setError('Failed to load provider profile');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Save provider profile
  const saveProfile = useCallback(
    async (updatedProvider: ProviderData): Promise<boolean> => {
      try {
        // Verify data integrity
        if (!verifyProviderDataIntegrity(updatedProvider)) {
          setError('Invalid provider data');
          return false;
        }

        // Save to storage
        const success = saveProviderProfile(updatedProvider);
        if (success) {
          setProvider(updatedProvider);
          setError(null);
        } else {
          setError('Failed to save profile');
        }
        return success;
      } catch (err) {
        setError('Error saving profile');
        console.error(err);
        return false;
      }
    },
    []
  );

  // Check for duplicate providers
  const checkDuplicate = useCallback(
    (name: string, state: string, county: string): { isDuplicate: boolean } => {
      try {
        return checkDuplicateProvider(name, state, county);
      } catch (err) {
        console.error('Error checking duplicates:', err);
        return { isDuplicate: false };
      }
    },
    []
  );

  // Register provider after verification
  const registerProvider = useCallback(
    async (county: string): Promise<boolean> => {
      try {
        if (!provider) {
          setError('No provider data to register');
          return false;
        }

        const success = registerProviderInRegistry(provider, county);
        if (!success) {
          setError('Failed to register provider');
        }
        return success;
      } catch (err) {
        setError('Error registering provider');
        console.error(err);
        return false;
      }
    },
    [provider]
  );

  // Log access to sensitive data
  const logDataAccess = useCallback(
    (field: 'email' | 'phone' | 'contact_info') => {
      if (provider) {
        logSensitiveDataAccess(provider.id, field);
      }
    },
    [provider]
  );

  return {
    provider,
    loading,
    error,
    saveProfile,
    checkDuplicate,
    registerProvider,
    logDataAccess,
  };
};
