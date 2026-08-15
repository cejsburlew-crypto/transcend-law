import { useEffect, useCallback, useRef, useState } from 'react';

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  key: string | string[]; // Key combination (e.g., '?' or ['Ctrl', 'K'] or ['Cmd', 'K'])
  description: string;
  category?: string;
  callback: (event: KeyboardEvent) => void;
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * Keyboard shortcuts configuration
 */
export interface KeyboardShortcutsConfig {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
  allowInInput?: boolean; // Whether to allow shortcuts when focused on input/textarea
  allowInContentEditable?: boolean;
}

/**
 * Platform detection
 */
const getPlatform = (): 'mac' | 'windows' | 'linux' => {
  if (typeof navigator === 'undefined') return 'linux';
  const userAgent = navigator.userAgent.toLowerCase();
  if (userAgent.includes('macintosh') || userAgent.includes('mac os x')) return 'mac';
  if (userAgent.includes('windows')) return 'windows';
  return 'linux';
};

/**
 * Get the modifier key name based on platform
 */
const getModifierKey = (platform: 'mac' | 'windows' | 'linux' = getPlatform()): string => {
  return platform === 'mac' ? 'Cmd' : 'Ctrl';
};

/**
 * Normalize key combination string
 * Examples: 'Cmd+K', 'Ctrl+Shift+F', 'Enter', '?'
 */
const normalizeKeyCombo = (combo: string): string[] => {
  return combo
    .split('+')
    .map(key => key.trim().toLowerCase())
    .filter(key => key.length > 0);
};

/**
 * Check if a KeyboardEvent matches a shortcut key combination
 */
const matchesKeyCombo = (event: KeyboardEvent, keyCombo: string | string[]): boolean => {
  const platform = getPlatform();
  const modifierKey = getModifierKey(platform);

  // Normalize input
  const comboArray = Array.isArray(keyCombo) ? keyCombo : [keyCombo];
  const normalizedCombo = normalizeKeyCombo(comboArray.join('+'));

  // Extract modifiers from event
  const eventModifiers = new Set<string>();
  if (event.ctrlKey || event.metaKey) {
    eventModifiers.add(modifierKey.toLowerCase());
  }
  if (event.shiftKey) {
    eventModifiers.add('shift');
  }
  if (event.altKey) {
    eventModifiers.add('alt');
  }

  // Get the actual key pressed
  const pressedKey = event.key.toLowerCase();
  const pressedCode = event.code.toLowerCase();

  // Parse the combo
  const requiredModifiers = new Set<string>();
  let targetKey = '';

  for (const part of normalizedCombo) {
    if (['ctrl', 'cmd', 'meta', 'shift', 'alt'].includes(part)) {
      requiredModifiers.add(part === 'cmd' || part === 'meta' ? modifierKey.toLowerCase() : part);
    } else {
      targetKey = part;
    }
  }

  // Check if modifiers match
  if (requiredModifiers.size !== eventModifiers.size) {
    return false;
  }

  for (const modifier of requiredModifiers) {
    if (!eventModifiers.has(modifier)) {
      return false;
    }
  }

  // Check if target key matches
  if (targetKey === '?') {
    return event.shiftKey && pressedKey === '/';
  }

  if (targetKey === '/') {
    return !event.shiftKey && pressedKey === '/';
  }

  // For regular keys
  return pressedKey === targetKey || pressedCode.includes(targetKey.toUpperCase());
};

/**
 * Default global shortcuts
 */
export const DEFAULT_GLOBAL_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: '?',
    description: 'Show help',
    category: 'Global',
    callback: () => {
      // This will be overridden by the hook consumer
    },
    preventDefault: true,
  },
  {
    key: ['Cmd', 'K'], // Cmd+K on Mac, Ctrl+K on Windows
    description: 'Search',
    category: 'Global',
    callback: () => {
      // This will be overridden by the hook consumer
    },
    preventDefault: true,
  },
  {
    key: 'Escape',
    description: 'Close modals and dialogs',
    category: 'Global',
    callback: () => {
      // This will be overridden by the hook consumer
    },
    preventDefault: false,
  },
];

/**
 * Vim-style navigation shortcuts
 */
export const VIM_NAVIGATION_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: 'j',
    description: 'Move down (Vim-style)',
    category: 'Navigation',
    callback: () => {},
    enabled: false,
  },
  {
    key: 'k',
    description: 'Move up (Vim-style)',
    category: 'Navigation',
    callback: () => {},
    enabled: false,
  },
  {
    key: 'h',
    description: 'Move left (Vim-style)',
    category: 'Navigation',
    callback: () => {},
    enabled: false,
  },
  {
    key: 'l',
    description: 'Move right (Vim-style)',
    category: 'Navigation',
    callback: () => {},
    enabled: false,
  },
  {
    key: ['Shift', 'G'],
    description: 'Jump to bottom (Vim-style)',
    category: 'Navigation',
    callback: () => {},
    enabled: false,
  },
  {
    key: 'g',
    description: 'Jump to top (Vim-style)',
    category: 'Navigation',
    callback: () => {},
    enabled: false,
  },
];

/**
 * useKeyboardShortcuts Hook
 * Manages keyboard shortcuts with support for:
 * - Global shortcuts
 * - Page-specific shortcuts
 * - Customizable shortcuts
 * - Platform-specific key combinations (Cmd on Mac, Ctrl on Windows)
 * - Vim-style navigation (optional)
 * - Input/textarea exclusion
 */
export const useKeyboardShortcuts = (config: KeyboardShortcutsConfig) => {
  const { shortcuts = [], enabled = true, allowInInput = false, allowInContentEditable = false } = config;

  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const shortcutsRef = useRef<KeyboardShortcut[]>(shortcuts);
  const enabledRef = useRef(enabled);
  const platform = getPlatform();

  // Update refs when config changes
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  /**
   * Check if an element is an input-like element
   */
  const isInputElement = useCallback((target: EventTarget | null): boolean => {
    if (!target || !(target instanceof HTMLElement)) return false;

    const tagName = target.tagName.toLowerCase();
    const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select';
    const isContentEditable = target.contentEditable === 'true' ||
      (target.closest('[contenteditable="true"]') !== null);

    return isInput || (isContentEditable && !allowInContentEditable) || (!allowInInput && isInput);
  }, [allowInInput, allowInContentEditable]);

  /**
   * Handle keyboard event
   */
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabledRef.current) return;

      // Skip if target is an input-like element and not allowed
      if (!allowInInput && isInputElement(event.target)) {
        return;
      }

      // Find matching shortcut
      for (const shortcut of shortcutsRef.current) {
        if (shortcut.enabled === false) continue;

        if (matchesKeyCombo(event, shortcut.key)) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }

          // Special case for help shortcut
          if ((shortcut.key === '?' || (Array.isArray(shortcut.key) && shortcut.key[0] === '?'))) {
            setIsHelpOpen(true);
            return;
          }

          shortcut.callback(event);
          return;
        }
      }
    },
    [allowInInput, isInputElement]
  );

  /**
   * Register event listeners
   */
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  /**
   * Add a shortcut dynamically
   */
  const addShortcut = useCallback((shortcut: KeyboardShortcut) => {
    shortcutsRef.current = [...shortcutsRef.current, shortcut];
  }, []);

  /**
   * Remove a shortcut by key
   */
  const removeShortcut = useCallback((key: string | string[]) => {
    shortcutsRef.current = shortcutsRef.current.filter(s => s.key !== key);
  }, []);

  /**
   * Update a shortcut
   */
  const updateShortcut = useCallback((key: string | string[], updates: Partial<KeyboardShortcut>) => {
    shortcutsRef.current = shortcutsRef.current.map(s =>
      (s.key === key ? { ...s, ...updates } : s)
    );
  }, []);

  /**
   * Enable/disable a shortcut
   */
  const toggleShortcut = useCallback((key: string | string[], enabled: boolean) => {
    updateShortcut(key, { enabled });
  }, [updateShortcut]);

  /**
   * Get active shortcuts
   */
  const getActiveShortcuts = useCallback((): KeyboardShortcut[] => {
    return shortcutsRef.current.filter(s => s.enabled !== false);
  }, []);

  /**
   * Get shortcuts by category
   */
  const getShortcutsByCategory = useCallback((category: string): KeyboardShortcut[] => {
    return getActiveShortcuts().filter(s => s.category === category);
  }, [getActiveShortcuts]);

  /**
   * Format key combination for display
   */
  const formatKeyCombo = useCallback(
    (keyCombo: string | string[]): string => {
      const comboArray = Array.isArray(keyCombo) ? keyCombo : [keyCombo];
      const normalized = normalizeKeyCombo(comboArray.join('+'));

      return normalized
        .map(part => {
          if (part === 'cmd') return 'Cmd';
          if (part === 'ctrl') {
            return platform === 'mac' ? 'Cmd' : 'Ctrl';
          }
          if (part === 'meta') return platform === 'mac' ? 'Cmd' : 'Ctrl';
          if (part === 'shift') return 'Shift';
          if (part === 'alt') return platform === 'mac' ? 'Opt' : 'Alt';
          if (part === 'enter') return 'Enter';
          if (part === 'escape') return 'Esc';
          if (part === ' ') return 'Space';
          return part.toUpperCase();
        })
        .join(platform === 'mac' ? ' ' : '+');
    },
    [platform]
  );

  /**
   * Get all shortcuts grouped by category
   */
  const getGroupedShortcuts = useCallback((): Record<string, KeyboardShortcut[]> => {
    const grouped: Record<string, KeyboardShortcut[]> = {};

    getActiveShortcuts().forEach(shortcut => {
      const category = shortcut.category || 'General';
      if (!grouped[category]) {
        grouped[category] = [];
      }
      grouped[category].push(shortcut);
    });

    return grouped;
  }, [getActiveShortcuts]);

  return {
    // State
    isHelpOpen,
    setIsHelpOpen,
    platform,

    // Shortcut management
    addShortcut,
    removeShortcut,
    updateShortcut,
    toggleShortcut,

    // Shortcut queries
    getActiveShortcuts,
    getShortcutsByCategory,
    getGroupedShortcuts,

    // Utilities
    formatKeyCombo,
    matchesKeyCombo,
    getModifierKey,
  };
};

export default useKeyboardShortcuts;
