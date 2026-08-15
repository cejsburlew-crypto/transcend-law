import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  useKeyboardShortcuts,
  DEFAULT_GLOBAL_SHORTCUTS,
  KeyboardShortcut,
  KeyboardShortcutsConfig,
} from '../hooks/useKeyboardShortcuts';
import { ShortcutsHelp } from './ShortcutsHelp';

/**
 * Context for keyboard shortcuts
 */
interface KeyboardShortcutsContextType {
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  registerShortcuts: (pageShortcuts: KeyboardShortcut[]) => () => void;
  allShortcuts: KeyboardShortcut[];
}

const KeyboardShortcutsContext = createContext<KeyboardShortcutsContextType | undefined>(undefined);

/**
 * Props for KeyboardShortcutsProvider
 */
interface KeyboardShortcutsProviderProps {
  children: React.ReactNode;
  onSearch?: () => void;
  onHelp?: () => void;
  enableVimNavigation?: boolean;
}

/**
 * KeyboardShortcutsProvider Component
 * Root provider that manages global keyboard shortcuts for the entire application
 * Allows pages and components to register their own shortcuts
 */
export const KeyboardShortcutsProvider: React.FC<KeyboardShortcutsProviderProps> = ({
  children,
  onSearch,
  onHelp,
  enableVimNavigation = false,
}) => {
  const [pageShortcuts, setPageShortcuts] = useState<KeyboardShortcut[]>([]);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Build global shortcuts with callbacks
  const globalShortcuts = useMemo((): KeyboardShortcut[] => {
    return [
      {
        key: '?',
        description: 'Show keyboard shortcuts help',
        category: 'Global',
        callback: () => {
          setIsHelpOpen(true);
          onHelp?.();
        },
        preventDefault: true,
      },
      {
        key: ['Cmd', 'K'],
        description: 'Search',
        category: 'Global',
        callback: () => {
          onSearch?.();
        },
        preventDefault: true,
      },
      {
        key: 'Escape',
        description: 'Close modals and dialogs',
        category: 'Global',
        callback: () => {
          setIsHelpOpen(false);
          // Trigger custom close event
          window.dispatchEvent(new CustomEvent('keyboard:escape'));
        },
        preventDefault: false,
      },
    ];
  }, [onSearch, onHelp]);

  // Combine global and page-specific shortcuts
  const allShortcuts = useMemo(
    () => [...globalShortcuts, ...pageShortcuts],
    [globalShortcuts, pageShortcuts]
  );

  // Initialize hook with all shortcuts
  const { getActiveShortcuts, formatKeyCombo } = useKeyboardShortcuts({
    shortcuts: allShortcuts,
    enabled: true,
    allowInInput: false,
  });

  /**
   * Register shortcuts from a page/component
   * Returns cleanup function to unregister
   */
  const registerShortcuts = useCallback(
    (shortcuts: KeyboardShortcut[]): (() => void) => {
      setPageShortcuts(prev => [...prev, ...shortcuts]);

      return () => {
        setPageShortcuts(prev =>
          prev.filter(
            existing => !shortcuts.some(newShortcut => newShortcut.key === existing.key)
          )
        );
      };
    },
    []
  );

  return (
    <KeyboardShortcutsContext.Provider
      value={{
        isHelpOpen,
        setIsHelpOpen,
        registerShortcuts,
        allShortcuts: getActiveShortcuts(),
      }}
    >
      {children}
      <ShortcutsHelp
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        shortcuts={getActiveShortcuts()}
      />
    </KeyboardShortcutsContext.Provider>
  );
};

/**
 * Hook to use keyboard shortcuts context
 */
export const useKeyboardShortcutsContext = (): KeyboardShortcutsContextType => {
  const context = useContext(KeyboardShortcutsContext);
  if (!context) {
    throw new Error(
      'useKeyboardShortcutsContext must be used within KeyboardShortcutsProvider'
    );
  }
  return context;
};

/**
 * Hook to register page/component shortcuts
 */
export const useRegisterShortcuts = (shortcuts: KeyboardShortcut[]): void => {
  const { registerShortcuts } = useKeyboardShortcutsContext();

  React.useEffect(() => {
    const cleanup = registerShortcuts(shortcuts);
    return cleanup;
  }, [shortcuts, registerShortcuts]);
};

export default KeyboardShortcutsProvider;
