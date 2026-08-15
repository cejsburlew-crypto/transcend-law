/**
 * Accessibility Hooks for React Components
 * Common patterns for WCAG 2.1 AA compliance
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { generateId, trapFocus, announceToScreenReader, getFocusableElements } from '../accessibility/utils';

/**
 * Hook for managing focus in modals/dialogs
 * Traps focus within the modal and restores it when closed
 */
export const useFocusTrap = (active: boolean = true) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const savedFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    // Save currently focused element
    savedFocusRef.current = document.activeElement as HTMLElement;

    // Trap focus in container
    const cleanup = trapFocus(containerRef.current);

    return () => {
      cleanup();
      // Restore focus to previously focused element
      if (savedFocusRef.current?.focus) {
        savedFocusRef.current.focus();
      }
    };
  }, [active]);

  return containerRef;
};

/**
 * Hook for keyboard event handling
 * Provides common keyboard shortcuts and patterns
 */
export const useKeyboardNavigation = (
  onEscape?: () => void,
  onEnter?: () => void,
  onArrowUp?: () => void,
  onArrowDown?: () => void
) => {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent | KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onEscape?.();
          break;
        case 'Enter':
          e.preventDefault();
          onEnter?.();
          break;
        case 'ArrowUp':
          e.preventDefault();
          onArrowUp?.();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onArrowDown?.();
          break;
        default:
          break;
      }
    },
    [onEscape, onEnter, onArrowUp, onArrowDown]
  );

  return { onKeyDown: handleKeyDown };
};

/**
 * Hook for managing form field with error messages
 * Automatically links error messages to field using aria-describedby
 */
export const useFormField = (id?: string) => {
  const fieldId = useRef(id || generateId('form-field'));
  const [error, setError] = useState<string | null>(null);

  const errorId = error ? `${fieldId.current}-error` : undefined;

  const fieldProps = {
    id: fieldId.current,
    'aria-invalid': !!error,
    'aria-describedby': errorId,
  };

  return {
    fieldId: fieldId.current,
    error,
    setError,
    errorId,
    fieldProps,
  };
};

/**
 * Hook for screen reader announcements
 * Announces messages politely or assertively
 */
export const useAnnouncement = () => {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    announceToScreenReader(message, priority);
  }, []);

  return { announce };
};

/**
 * Hook for managing accessible dropdowns
 * Handles keyboard navigation and selection
 */
export const useAccessibleDropdown = (defaultOpen: boolean = false) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          } else {
            const options = containerRef.current?.querySelectorAll('[role="option"]');
            if (options) {
              setSelectedIndex((prev) => (prev + 1) % options.length);
              (options[Math.min(selectedIndex + 1, options.length - 1)] as HTMLElement)?.focus();
            }
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (isOpen) {
            const options = containerRef.current?.querySelectorAll('[role="option"]');
            if (options) {
              setSelectedIndex((prev) => (prev - 1 + options.length) % options.length);
              (options[Math.max(selectedIndex - 1, 0)] as HTMLElement)?.focus();
            }
          }
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          if (!isOpen) {
            setIsOpen(true);
          }
          break;

        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          trigger.current?.focus();
          break;

        default:
          break;
      }
    },
    [isOpen, selectedIndex]
  );

  const handleSelect = useCallback((index: number) => {
    setSelectedIndex(index);
    setIsOpen(false);
    trigger.current?.focus();
  }, []);

  return {
    containerRef,
    trigger,
    isOpen,
    setIsOpen,
    selectedIndex,
    handleKeyDown,
    handleSelect,
    dropdownProps: {
      role: 'listbox',
      onKeyDown: handleKeyDown,
    },
    triggerProps: {
      ref: trigger,
      'aria-haspopup': 'listbox',
      'aria-expanded': isOpen,
      'aria-controls': 'dropdown-listbox',
    },
  };
};

/**
 * Hook for managing accordion components
 * Handles keyboard navigation and selection
 */
export const useAccessibleAccordion = () => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number, itemCount: number) => {
      const buttons = document.querySelectorAll('[role="tab"]');

      switch (e.key) {
        case 'Enter':
        case ' ':
          e.preventDefault();
          setExpandedIndex(expandedIndex === index ? null : index);
          break;

        case 'ArrowUp':
        case 'Home':
          e.preventDefault();
          (buttons[0] as HTMLElement)?.focus();
          setExpandedIndex(0);
          break;

        case 'ArrowDown':
        case 'End':
          e.preventDefault();
          (buttons[Math.min(index + 1, itemCount - 1)] as HTMLElement)?.focus();
          setExpandedIndex(Math.min(index + 1, itemCount - 1));
          break;

        default:
          break;
      }
    },
    [expandedIndex]
  );

  return {
    expandedIndex,
    setExpandedIndex,
    handleKeyDown,
  };
};

/**
 * Hook for managing focus on list items (like in a searchable list)
 * Provides arrow key navigation through items
 */
export const useListKeyboardNavigation = (itemCount: number) => {
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, itemCount - 1));
          break;

        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;

        case 'Home':
          e.preventDefault();
          setFocusedIndex(0);
          break;

        case 'End':
          e.preventDefault();
          setFocusedIndex(itemCount - 1);
          break;

        default:
          break;
      }
    },
    [itemCount]
  );

  return {
    focusedIndex,
    setFocusedIndex,
    handleKeyDown,
  };
};

/**
 * Hook for managing tabs component
 * Handles ARIA roles and keyboard navigation
 */
export const useAccessibleTabs = (defaultTab: string) => {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const tabsRef = useRef<Map<string, HTMLButtonElement>>(new Map());

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, tabId: string, tabIds: string[]) => {
      let newTabId = tabId;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
          e.preventDefault();
          const currentIndex = tabIds.indexOf(tabId);
          newTabId = tabIds[(currentIndex + 1) % tabIds.length];
          break;

        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          const prevIndex = tabIds.indexOf(tabId);
          newTabId = tabIds[(prevIndex - 1 + tabIds.length) % tabIds.length];
          break;

        case 'Home':
          e.preventDefault();
          newTabId = tabIds[0];
          break;

        case 'End':
          e.preventDefault();
          newTabId = tabIds[tabIds.length - 1];
          break;

        default:
          return;
      }

      setActiveTab(newTabId);
      tabsRef.current.get(newTabId)?.focus();
    },
    []
  );

  const registerTab = useCallback((tabId: string, button: HTMLButtonElement) => {
    tabsRef.current.set(tabId, button);
  }, []);

  return {
    activeTab,
    setActiveTab,
    handleKeyDown,
    registerTab,
    tabProps: (tabId: string) => ({
      role: 'tab',
      'aria-selected': activeTab === tabId,
      'aria-controls': `panel-${tabId}`,
      tabIndex: activeTab === tabId ? 0 : -1,
    }),
    panelProps: (tabId: string) => ({
      role: 'tabpanel',
      id: `panel-${tabId}`,
      'aria-labelledby': tabId,
      hidden: activeTab !== tabId,
    }),
  };
};

/**
 * Hook for managing modal dialogs
 * Handles focus trap, escape key, and backdrop click
 */
export const useAccessibleModal = (onClose: () => void) => {
  const modalRef = useFocusTrap(true);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  return {
    modalRef,
    handleBackdropClick,
    handleKeyDown,
    dialogProps: {
      role: 'dialog',
      'aria-modal': true,
    },
  };
};

/**
 * Hook for skip links (to main content)
 * Makes it easy to add skip navigation
 */
export const useSkipLink = (targetId: string = 'main-content') => {
  const skipLinkRef = useRef<HTMLAnchorElement>(null);

  const handleSkipClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        target.focus();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    },
    [targetId]
  );

  return {
    skipLinkRef,
    handleSkipClick,
    skipLinkProps: {
      ref: skipLinkRef,
      href: `#${targetId}`,
      onClick: handleSkipClick,
    },
  };
};

/**
 * Hook for managing loading states with screen reader announcements
 */
export const useAccessibleLoading = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { announce } = useAnnouncement();

  const startLoading = useCallback((message: string = 'Loading...') => {
    setIsLoading(true);
    announce(message, 'polite');
  }, [announce]);

  const stopLoading = useCallback((message: string = 'Loading complete') => {
    setIsLoading(false);
    announce(message, 'polite');
  }, [announce]);

  return {
    isLoading,
    startLoading,
    stopLoading,
  };
};

/**
 * Hook for managing date picker accessibility
 */
export const useAccessibleDatePicker = () => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const { announce } = useAnnouncement();

  const handleDateChange = useCallback(
    (date: Date) => {
      setSelectedDate(date);
      announce(`Date selected: ${date.toLocaleDateString()}`, 'polite');
    },
    [announce]
  );

  return {
    selectedDate,
    handleDateChange,
    inputProps: {
      type: 'date',
      'aria-label': 'Select a date',
    },
  };
};

/**
 * Hook for managing search functionality with accessibility
 */
export const useAccessibleSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const { announce } = useAnnouncement();

  const handleSearch = useCallback(
    (searchFn: (q: string) => any[]) => {
      const newResults = searchFn(query);
      setResults(newResults);
      announce(`${newResults.length} results found`, 'polite');
      setHighlightedIndex(0);
    },
    [query, announce]
  );

  return {
    query,
    setQuery,
    results,
    highlightedIndex,
    setHighlightedIndex,
    handleSearch,
    inputProps: {
      type: 'search',
      'aria-label': 'Search',
      'aria-describedby': 'search-help',
      'aria-controls': 'search-results',
    },
    resultsProps: {
      id: 'search-results',
      role: 'listbox',
    },
  };
};

/**
 * Hook for managing toast/notification messages with proper accessibility
 */
export const useAccessibleNotification = () => {
  const [notification, setNotification] = useState<{
    id: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
  } | null>(null);

  const { announce } = useAnnouncement();

  const showNotification = useCallback(
    (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration: number = 5000) => {
      const id = generateId('notification');
      setNotification({ id, message, type });

      announce(message, type === 'error' ? 'assertive' : 'polite');

      if (duration > 0) {
        setTimeout(() => {
          setNotification(null);
        }, duration);
      }
    },
    [announce]
  );

  const closeNotification = useCallback(() => {
    setNotification(null);
  }, []);

  return {
    notification,
    showNotification,
    closeNotification,
    notificationProps: notification
      ? {
          role: notification.type === 'error' ? 'alert' : 'status',
          'aria-live': notification.type === 'error' ? 'assertive' : 'polite',
          'aria-atomic': true,
        }
      : null,
  };
};

export default {
  useFocusTrap,
  useKeyboardNavigation,
  useFormField,
  useAnnouncement,
  useAccessibleDropdown,
  useAccessibleAccordion,
  useListKeyboardNavigation,
  useAccessibleTabs,
  useAccessibleModal,
  useSkipLink,
  useAccessibleLoading,
  useAccessibleDatePicker,
  useAccessibleSearch,
  useAccessibleNotification,
};
