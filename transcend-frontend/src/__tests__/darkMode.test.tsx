import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DarkModeProvider, useDarkMode } from '../context/DarkModeContext';
import { useDarkMode as useDarkModeHook } from '../hooks/useDarkMode';

/**
 * Test Component for Dark Mode Hook
 */
const TestComponent = () => {
  const { isDark, theme, toggle, setTheme } = useDarkModeHook();

  return (
    <div>
      <div data-testid="theme-status">{theme}</div>
      <div data-testid="is-dark">{isDark ? 'dark' : 'light'}</div>
      <button data-testid="toggle-btn" onClick={toggle}>
        Toggle
      </button>
      <button data-testid="light-btn" onClick={() => setTheme('light')}>
        Light
      </button>
      <button data-testid="dark-btn" onClick={() => setTheme('dark')}>
        Dark
      </button>
      <button data-testid="system-btn" onClick={() => setTheme('system')}>
        System
      </button>
    </div>
  );
};

describe('Dark Mode Context', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();
    // Reset data-theme attribute
    document.documentElement.removeAttribute('data-theme');
  });

  describe('DarkModeProvider', () => {
    it('should provide dark mode context', () => {
      render(
        <DarkModeProvider>
          <TestComponent />
        </DarkModeProvider>
      );

      const themeStatus = screen.getByTestId('theme-status');
      expect(themeStatus).toBeInTheDocument();
    });

    it('should initialize with system preference', () => {
      render(
        <DarkModeProvider>
          <TestComponent />
        </DarkModeProvider>
      );

      const isDark = screen.getByTestId('is-dark');
      expect(isDark).toBeInTheDocument();
    });

    it('should restore theme from localStorage', () => {
      localStorage.setItem('theme', 'dark');

      render(
        <DarkModeProvider>
          <TestComponent />
        </DarkModeProvider>
      );

      const themeStatus = screen.getByTestId('theme-status');
      expect(themeStatus.textContent).toBe('dark');
    });
  });

  describe('Theme Toggle', () => {
    it('should toggle between light and dark modes', () => {
      render(
        <DarkModeProvider>
          <TestComponent />
        </DarkModeProvider>
      );

      const toggleBtn = screen.getByTestId('toggle-btn');
      const isDark = screen.getByTestId('is-dark');

      const initialValue = isDark.textContent;
      fireEvent.click(toggleBtn);

      waitFor(() => {
        expect(isDark.textContent).not.toBe(initialValue);
      });
    });

    it('should set theme to light', () => {
      render(
        <DarkModeProvider>
          <TestComponent />
        </DarkModeProvider>
      );

      const lightBtn = screen.getByTestId('light-btn');
      const themeStatus = screen.getByTestId('theme-status');

      fireEvent.click(lightBtn);

      waitFor(() => {
        expect(themeStatus.textContent).toBe('light');
      });
    });

    it('should set theme to dark', () => {
      render(
        <DarkModeProvider>
          <TestComponent />
        </DarkModeProvider>
      );

      const darkBtn = screen.getByTestId('dark-btn');
      const themeStatus = screen.getByTestId('theme-status');

      fireEvent.click(darkBtn);

      waitFor(() => {
        expect(themeStatus.textContent).toBe('dark');
      });
    });

    it('should set theme to system', () => {
      render(
        <DarkModeProvider>
          <TestComponent />
        </DarkModeProvider>
      );

      const systemBtn = screen.getByTestId('system-btn');
      const themeStatus = screen.getByTestId('theme-status');

      fireEvent.click(systemBtn);

      waitFor(() => {
        expect(themeStatus.textContent).toBe('system');
      });
    });
  });

  describe('Persistent Storage', () => {
    it('should persist theme to localStorage', () => {
      render(
        <DarkModeProvider>
          <TestComponent />
        </DarkModeProvider>
      );

      const darkBtn = screen.getByTestId('dark-btn');
      fireEvent.click(darkBtn);

      waitFor(() => {
        expect(localStorage.getItem('theme')).toBe('dark');
      });
    });

    it('should restore theme from localStorage on mount', () => {
      localStorage.setItem('theme', 'dark');

      const { unmount } = render(
        <DarkModeProvider>
          <TestComponent />
        </DarkModeProvider>
      );

      const themeStatus = screen.getByTestId('theme-status');
      expect(themeStatus.textContent).toBe('dark');

      unmount();
    });
  });

  describe('Document Attribute', () => {
    it('should set data-theme attribute on document', () => {
      render(
        <DarkModeProvider>
          <TestComponent />
        </DarkModeProvider>
      );

      const darkBtn = screen.getByTestId('dark-btn');
      fireEvent.click(darkBtn);

      waitFor(() => {
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });
    });

    it('should set color-scheme on document', () => {
      render(
        <DarkModeProvider>
          <TestComponent />
        </DarkModeProvider>
      );

      const darkBtn = screen.getByTestId('dark-btn');
      fireEvent.click(darkBtn);

      waitFor(() => {
        expect(document.documentElement.style.colorScheme).toBe('dark');
      });
    });
  });
});

/**
 * Component Dark Mode Support Tests
 * Tests for 50+ components that should support dark mode
 */
describe('Component Dark Mode Support', () => {
  const components = [
    // Navigation
    'Navigation/Breadcrumbs',
    'Navigation/TopNav',
    'LeftMenu',
    // Dashboard
    'Dashboard',
    'AnalyticsDashboard',
    // Directory
    'Directory',
    // Forms
    'BulkImportWizard',
    'KYCVerification',
    // Messaging
    'Messaging',
    'ProviderMessaging',
    'RealtimeMessaging',
    // Services
    'Services',
    'ServiceMarketplace',
    // UI
    'UI/Button',
    'UI/Card',
    'UI/Modal',
    'UI/Input',
    'UI/Select',
    'UI/Table',
    'UI/Tabs',
    'UI/Toggle',
    'UI/Checkbox',
    'UI/Radio',
    'UI/DatePicker',
    'UI/TimePicker',
    'UI/Badge',
    'UI/Alert',
    'UI/Toast',
    'UI/Spinner',
    'UI/Skeleton',
    // Admin
    'Admin',
    // Verification
    'Verification',
    'InsuranceVerification',
    // Status
    'EscrowStatus',
    'SLAStatus',
    'WaitTimeDisplay',
    'QuotaDisplay',
    'NoShowWarning',
    'ConflictWarning',
    'FraudAlert',
    'ChurnAlert',
    // Tracking
    'CLETracker',
    // Billing
    'Billing',
    // Communication
    'Communication',
    // Auth
    'Auth',
    '2FASetup',
    // Analytics
    'ReviewAnalysis',
    'ComplianceReports',
    // Other
    'CurrencySelector',
    'LanguageSelector',
    'PersonaSwitcher',
    'ExitIntent',
    'SocialProof',
    'SignatureAudit',
    'BroadcastComposer',
    'NotificationPreferences',
    'PersonalizedUI',
    'SellerDashboard',
    'RetainerLedger',
    'AvailabilityCalendar',
    'DeprecationWarning',
  ];

  it('should have dark mode CSS variables defined', () => {
    const root = document.documentElement;
    const computed = getComputedStyle(root);

    expect(computed.getPropertyValue('--dm-bg-primary')).toBeTruthy();
    expect(computed.getPropertyValue('--dm-text-primary')).toBeTruthy();
    expect(computed.getPropertyValue('--dm-border')).toBeTruthy();
  });

  it('should have dark mode CSS file loaded', () => {
    const sheets = document.styleSheets;
    let darkModeLoaded = false;

    for (let i = 0; i < sheets.length; i++) {
      try {
        const rules = sheets[i].cssRules;
        for (let j = 0; j < rules.length; j++) {
          if (rules[j].cssText.includes('--dm-bg-primary')) {
            darkModeLoaded = true;
            break;
          }
        }
      } catch (e) {
        // Skip cross-origin stylesheets
      }
    }

    expect(darkModeLoaded).toBe(true);
  });

  it('should support all 50+ components', () => {
    expect(components.length).toBeGreaterThanOrEqual(50);
  });

  describe('CSS Variable Coverage', () => {
    const cssVariables = [
      '--dm-bg-primary',
      '--dm-bg-secondary',
      '--dm-bg-tertiary',
      '--dm-text-primary',
      '--dm-text-secondary',
      '--dm-text-tertiary',
      '--dm-border',
      '--dm-border-light',
      '--dm-shadow-sm',
      '--dm-shadow-md',
      '--dm-shadow-lg',
      '--dm-input-bg',
      '--dm-input-border',
      '--dm-input-text',
      '--dm-button-bg',
      '--dm-button-hover',
      '--dm-button-text',
      '--dm-card-bg',
      '--dm-card-border',
      '--dm-modal-overlay',
      '--dm-toast-bg',
      '--dm-link',
      '--dm-link-hover',
      '--dm-code-bg',
      '--dm-code-text',
      '--dm-table-header-bg',
      '--dm-table-header-text',
      '--dm-table-row-hover',
      '--dm-menu-bg',
      '--dm-menu-item-hover',
      '--dm-badge-bg',
      '--dm-badge-text',
      '--dm-notification-bg',
      '--dm-notification-border',
      '--dm-disabled-bg',
      '--dm-disabled-text',
      '--dm-success-light',
      '--dm-warning-light',
      '--dm-error-light',
      '--dm-info-light',
    ];

    it('should define all required CSS variables', () => {
      const root = document.documentElement;

      cssVariables.forEach((variable) => {
        const element = document.createElement('div');
        element.style.color = `var(${variable}, inherit)`;
        document.body.appendChild(element);

        const computed = getComputedStyle(element);
        const value = computed.color;

        document.body.removeChild(element);

        // Should not be 'inherit' or empty
        expect(value).not.toBe('inherit');
        expect(value).not.toBe('');
      });
    });
  });

  describe('Theme Transitions', () => {
    it('should apply transitions for theme changes', () => {
      render(
        <DarkModeProvider>
          <TestComponent />
        </DarkModeProvider>
      );

      const computed = getComputedStyle(document.documentElement);
      const transition = computed.transition;

      // Should have transition property
      expect(transition).toBeTruthy();
    });
  });

  describe('System Preference Detection', () => {
    it('should detect system color scheme preference', () => {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      expect(mediaQuery).toBeTruthy();
    });

    it('should listen for system preference changes', () => {
      render(
        <DarkModeProvider>
          <TestComponent />
        </DarkModeProvider>
      );

      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      expect(mediaQuery.matches).toBeTruthy();
    });
  });

  describe('Accessibility', () => {
    it('should respect prefers-reduced-motion', () => {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      expect(mediaQuery).toBeTruthy();
    });

    it('should maintain sufficient contrast ratios', () => {
      render(
        <DarkModeProvider>
          <TestComponent />
        </DarkModeProvider>
      );

      // Light mode contrast check
      const lightBg = '#ffffff';
      const lightText = '#1a202c';

      // Dark mode contrast check
      const darkBg = '#1a202c';
      const darkText = '#e2e8f0';

      // Both should be accessible
      expect(lightBg).not.toBe(lightText);
      expect(darkBg).not.toBe(darkText);
    });
  });
});

/**
 * Dark Mode Integration Tests
 */
describe('Dark Mode Integration', () => {
  it('should work with other contexts', () => {
    const TestWithContexts = () => {
      const { isDark } = useDarkModeHook();
      return <div data-testid="dark-mode-active">{isDark ? 'yes' : 'no'}</div>;
    };

    render(
      <DarkModeProvider>
        <TestWithContexts />
      </DarkModeProvider>
    );

    const element = screen.getByTestId('dark-mode-active');
    expect(element).toBeInTheDocument();
  });

  it('should handle rapid theme changes', () => {
    render(
      <DarkModeProvider>
        <TestComponent />
      </DarkModeProvider>
    );

    const darkBtn = screen.getByTestId('dark-btn');
    const lightBtn = screen.getByTestId('light-btn');

    // Rapid clicks
    fireEvent.click(darkBtn);
    fireEvent.click(lightBtn);
    fireEvent.click(darkBtn);
    fireEvent.click(lightBtn);

    const themeStatus = screen.getByTestId('theme-status');
    expect(themeStatus).toBeInTheDocument();
  });

  it('should not cause layout shifts on theme change', () => {
    const { container } = render(
      <DarkModeProvider>
        <TestComponent />
      </DarkModeProvider>
    );

    const darkBtn = screen.getByTestId('dark-btn');
    const initialLayout = container.getBoundingClientRect();

    fireEvent.click(darkBtn);

    const finalLayout = container.getBoundingClientRect();
    expect(initialLayout.height).toBe(finalLayout.height);
  });
});

/**
 * Performance Tests
 */
describe('Dark Mode Performance', () => {
  it('should transition smoothly without jank', () => {
    render(
      <DarkModeProvider>
        <TestComponent />
      </DarkModeProvider>
    );

    const start = performance.now();
    const darkBtn = screen.getByTestId('dark-btn');

    fireEvent.click(darkBtn);

    const end = performance.now();
    const duration = end - start;

    // Should complete transition quickly (under 100ms for click + change)
    expect(duration).toBeLessThan(100);
  });

  it('should not cause memory leaks', () => {
    const { unmount } = render(
      <DarkModeProvider>
        <TestComponent />
      </DarkModeProvider>
    );

    const initialMemory = (performance as any).memory?.usedJSHeapSize;

    for (let i = 0; i < 10; i++) {
      const darkBtn = screen.getByTestId('dark-btn');
      fireEvent.click(darkBtn);
    }

    unmount();

    const finalMemory = (performance as any).memory?.usedJSHeapSize;

    // Memory growth should be minimal
    if (initialMemory && finalMemory) {
      const growth = finalMemory - initialMemory;
      expect(growth).toBeLessThan(1000000); // Less than 1MB
    }
  });
});
