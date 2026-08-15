/**
 * Command Palette Integration Example
 *
 * This file demonstrates how to integrate the CommandPalette into your app.
 * Copy this pattern into your main App component or a layout component.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { CommandPalette, type Command } from './CommandPalette';
import { useAuth } from '../context/AuthContext';
import type { AnalyticsEvent } from '../hooks/useCommandPalette';

export const CommandPaletteIntegration: React.FC<{
  onNavigate?: (path: string) => void;
}> = ({ onNavigate }) => {
  const { logout } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsEvent[]>([]);

  // Generate dynamic commands based on app state
  const commands: Command[] = useMemo(() => {
    const baseCommands: Command[] = [
      // Navigation Commands
      {
        id: 'nav-dashboard',
        title: 'Dashboard',
        description: 'Go to home dashboard',
        category: 'navigation',
        icon: '📊',
        action: () => onNavigate?.('/dashboard'),
        keywords: ['home', 'dashboard', 'main', 'overview'],
      },
      {
        id: 'nav-services',
        title: 'Services Directory',
        description: 'Browse available legal services',
        category: 'navigation',
        icon: '⚖️',
        action: () => onNavigate?.('/services'),
        keywords: ['services', 'directory', 'legal', 'browse'],
      },
      {
        id: 'nav-law-firms',
        title: 'Law Firms',
        description: 'Find and contact law firms',
        category: 'navigation',
        icon: '🏢',
        action: () => onNavigate?.('/firms'),
        keywords: ['firms', 'lawyers', 'attorneys', 'law'],
      },
      {
        id: 'nav-notary',
        title: 'Notary Services',
        description: '24/7 online notary services',
        category: 'navigation',
        icon: '📝',
        action: () => onNavigate?.('/notary'),
        keywords: ['notary', 'services', 'document', 'sign'],
      },
      {
        id: 'nav-cases',
        title: 'My Cases',
        description: 'View your active cases',
        category: 'navigation',
        icon: '📋',
        action: () => onNavigate?.('/cases'),
        keywords: ['cases', 'my', 'active', 'ongoing'],
      },
      {
        id: 'nav-documents',
        title: 'Documents',
        description: 'Access your documents',
        category: 'navigation',
        icon: '📄',
        action: () => onNavigate?.('/documents'),
        keywords: ['documents', 'files', 'uploads', 'storage'],
      },

      // Action Commands
      {
        id: 'action-start-service',
        title: 'Start New Service',
        description: 'Begin a new legal service request',
        category: 'action',
        icon: '➕',
        action: () => onNavigate?.('/services/new'),
        keywords: ['new', 'start', 'service', 'request', 'create'],
      },
      {
        id: 'action-schedule',
        title: 'Schedule Consultation',
        description: 'Book a consultation with an attorney',
        category: 'action',
        icon: '📅',
        action: () => onNavigate?.('/schedule'),
        keywords: ['schedule', 'book', 'appointment', 'meeting', 'consultation'],
      },
      {
        id: 'action-upload-document',
        title: 'Upload Document',
        description: 'Add a document to your case',
        category: 'action',
        icon: '📤',
        action: () => {
          // Trigger file upload dialog
          const input = document.createElement('input');
          input.type = 'file';
          input.click();
        },
        keywords: ['upload', 'document', 'file', 'add'],
      },

      // Settings & User Commands
      {
        id: 'settings-profile',
        title: 'My Profile',
        description: 'View and edit your profile',
        category: 'settings',
        icon: '👤',
        action: () => onNavigate?.('/profile'),
        keywords: ['profile', 'user', 'account', 'settings'],
      },
      {
        id: 'settings-preferences',
        title: 'Preferences',
        description: 'Update your preferences',
        category: 'settings',
        icon: '⚙️',
        action: () => onNavigate?.('/preferences'),
        keywords: ['preferences', 'settings', 'config', 'options'],
      },
      {
        id: 'settings-billing',
        title: 'Billing & Payments',
        description: 'Manage your billing',
        category: 'settings',
        icon: '💳',
        action: () => onNavigate?.('/billing'),
        keywords: ['billing', 'payment', 'invoice', 'charge', 'card'],
      },
      {
        id: 'settings-notifications',
        title: 'Notifications',
        description: 'Configure notification settings',
        category: 'settings',
        icon: '🔔',
        action: () => onNavigate?.('/notifications'),
        keywords: ['notifications', 'alerts', 'email', 'sms'],
      },
      {
        id: 'settings-security',
        title: 'Security',
        description: 'Manage security settings',
        category: 'settings',
        icon: '🔐',
        action: () => onNavigate?.('/security'),
        keywords: ['security', '2fa', 'password', 'two-factor'],
      },

      // Quick Actions
      {
        id: 'quick-help',
        title: 'Help & Support',
        description: 'Get help or contact support',
        category: 'quick-action',
        icon: '❓',
        action: () => window.open('/help', '_blank'),
        keywords: ['help', 'support', 'faq', 'contact'],
      },
      {
        id: 'quick-documentation',
        title: 'Documentation',
        description: 'Read the documentation',
        category: 'quick-action',
        icon: '📖',
        action: () => window.open('/docs', '_blank'),
        keywords: ['docs', 'documentation', 'guide', 'tutorial'],
      },
      {
        id: 'quick-feedback',
        title: 'Send Feedback',
        description: 'Share your feedback with us',
        category: 'quick-action',
        icon: '💬',
        action: () => onNavigate?.('/feedback'),
        keywords: ['feedback', 'suggestion', 'bug', 'issue'],
      },
      {
        id: 'quick-logout',
        title: 'Logout',
        description: 'Sign out of your account',
        category: 'quick-action',
        icon: '🚪',
        action: () => {
          logout();
          onNavigate?.('/');
        },
        keywords: ['logout', 'sign-out', 'exit', 'leave'],
      },
    ];

    return baseCommands;
  }, [onNavigate, logout]);

  // Handle analytics events
  const handleAnalytics = useCallback((event: AnalyticsEvent) => {
    console.log('Command Palette Event:', event);
    setAnalytics((prev) => [...prev, event]);

    // Send to analytics service (optional)
    if (window.gtag) {
      window.gtag('event', `command_palette_${event.type}`, {
        command_id: event.commandId,
        query: event.query,
        timestamp: event.timestamp,
      });
    }

    // Log to API (optional)
    if (event.type === 'execute' && event.commandId) {
      // You could send this to your analytics backend
      console.log(`Command executed: ${event.commandId}`);
    }
  }, []);

  return (
    <CommandPalette
      commands={commands}
      onAnalytics={handleAnalytics}
      maxRecentItems={5}
      placeholder="Search commands, pages, or actions... (Cmd+K / Ctrl+K)"
    />
  );
};

/**
 * Usage in App.tsx:
 *
 * import { CommandPaletteIntegration } from './components/CommandPaletteExample';
 *
 * function App() {
 *   const handleNavigate = (path: string) => {
 *     // Handle navigation - use your router here
 *     window.location.href = path;
 *   };
 *
 *   return (
 *     <>
 *       {/* Your app content */}
 *       <CommandPaletteIntegration onNavigate={handleNavigate} />
 *     </>
 *   );
 * }
 */

export default CommandPaletteIntegration;
