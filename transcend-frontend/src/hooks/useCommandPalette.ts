import { useState, useEffect, useCallback, useRef } from 'react';

export interface Command {
  id: string;
  title: string;
  description?: string;
  category: 'navigation' | 'action' | 'settings' | 'quick-action' | 'custom';
  icon?: string;
  shortcut?: string;
  action: () => void | Promise<void>;
  keywords?: string[];
  metadata?: {
    userId?: string;
    createdAt?: string;
  };
}

export interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  filteredCommands: Command[];
  recentCommands: Command[];
}

interface CommandPaletteOptions {
  commands: Command[];
  maxRecentItems?: number;
  onAnalytics?: (event: AnalyticsEvent) => void;
  storageKey?: string;
}

export interface AnalyticsEvent {
  type: 'open' | 'close' | 'execute' | 'search' | 'navigate';
  commandId?: string;
  query?: string;
  timestamp: number;
}

// Fuzzy search algorithm
const fuzzySearch = (query: string, items: Command[]): Command[] => {
  if (!query.trim()) return items;

  const lowerQuery = query.toLowerCase();

  return items
    .map((item) => {
      const searchText = `${item.title} ${item.description || ''} ${(item.keywords || []).join(' ')}`.toLowerCase();

      // Calculate fuzzy match score
      let score = 0;
      let queryIndex = 0;
      let textIndex = 0;
      let consecutiveMatches = 0;

      while (queryIndex < lowerQuery.length && textIndex < searchText.length) {
        if (lowerQuery[queryIndex] === searchText[textIndex]) {
          score += 1 + consecutiveMatches;
          consecutiveMatches++;
          queryIndex++;
        } else {
          consecutiveMatches = 0;
        }
        textIndex++;
      }

      // If all characters matched
      const isMatch = queryIndex === lowerQuery.length;

      return {
        item,
        score: isMatch ? score : -1,
        isMatch
      };
    })
    .filter((result) => result.isMatch)
    .sort((a, b) => b.score - a.score)
    .map((result) => result.item);
};

export const useCommandPalette = (options: CommandPaletteOptions) => {
  const {
    commands: initialCommands,
    maxRecentItems = 5,
    onAnalytics,
    storageKey = 'transcend-command-palette-recent'
  } = options;

  const [state, setState] = useState<CommandPaletteState>({
    isOpen: false,
    query: '',
    selectedIndex: 0,
    filteredCommands: initialCommands,
    recentCommands: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);

  // Load recent commands from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const recentIds = JSON.parse(stored) as string[];
        const recentCommands = recentIds
          .map((id) => initialCommands.find((cmd) => cmd.id === id))
          .filter((cmd): cmd is Command => cmd !== undefined);

        setState((prev) => ({ ...prev, recentCommands }));
      } catch (e) {
        console.error('Failed to load recent commands:', e);
      }
    }
  }, [initialCommands, storageKey]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to open/close
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setState((prev) => {
          const newIsOpen = !prev.isOpen;
          if (newAnalytics && onAnalytics) {
            onAnalytics({
              type: newIsOpen ? 'open' : 'close',
              timestamp: Date.now(),
            });
          }
          return { ...prev, isOpen: newIsOpen, query: '', selectedIndex: 0 };
        });
      }

      // Escape to close
      if (e.key === 'Escape' && state.isOpen) {
        setState((prev) => ({ ...prev, isOpen: false }));
        if (onAnalytics) {
          onAnalytics({
            type: 'close',
            timestamp: Date.now(),
          });
        }
      }

      // Arrow navigation
      if (state.isOpen) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          const commands =
            state.query.trim() === '' ? state.recentCommands : state.filteredCommands;
          setState((prev) => ({
            ...prev,
            selectedIndex: (prev.selectedIndex + 1) % commands.length,
          }));
        }

        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const commands =
            state.query.trim() === '' ? state.recentCommands : state.filteredCommands;
          setState((prev) => ({
            ...prev,
            selectedIndex:
              prev.selectedIndex === 0
                ? commands.length - 1
                : prev.selectedIndex - 1,
          }));
        }

        // Enter to execute
        if (e.key === 'Enter') {
          e.preventDefault();
          const commands =
            state.query.trim() === '' ? state.recentCommands : state.filteredCommands;
          const selectedCommand = commands[state.selectedIndex];
          if (selectedCommand) {
            handleExecuteCommand(selectedCommand);
          }
        }
      }
    };

    const newAnalytics = true; // Flag to track analytics call
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, onAnalytics]);

  // Focus input when palette opens
  useEffect(() => {
    if (state.isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [state.isOpen]);

  const handleQueryChange = useCallback((query: string) => {
    const filtered =
      query.trim() === ''
        ? state.recentCommands
        : fuzzySearch(query, initialCommands);

    setState((prev) => ({
      ...prev,
      query,
      filteredCommands: filtered,
      selectedIndex: 0,
    }));

    if (onAnalytics) {
      onAnalytics({
        type: 'search',
        query,
        timestamp: Date.now(),
      });
    }
  }, [initialCommands, onAnalytics, state.recentCommands]);

  const handleExecuteCommand = useCallback(
    async (command: Command) => {
      try {
        await command.action();

        // Update recent commands
        setState((prev) => {
          const recentIds = [
            command.id,
            ...prev.recentCommands
              .filter((cmd) => cmd.id !== command.id)
              .slice(0, maxRecentItems - 1)
              .map((cmd) => cmd.id),
          ];

          localStorage.setItem(storageKey, JSON.stringify(recentIds));

          return {
            ...prev,
            isOpen: false,
            query: '',
            selectedIndex: 0,
            recentCommands: recentIds
              .map((id) => initialCommands.find((cmd) => cmd.id === id))
              .filter((cmd): cmd is Command => cmd !== undefined),
          };
        });

        if (onAnalytics) {
          onAnalytics({
            type: 'execute',
            commandId: command.id,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error('Failed to execute command:', error);
      }
    },
    [initialCommands, maxRecentItems, storageKey, onAnalytics]
  );

  const togglePalette = useCallback(() => {
    setState((prev) => {
      const newIsOpen = !prev.isOpen;
      if (onAnalytics) {
        onAnalytics({
          type: newIsOpen ? 'open' : 'close',
          timestamp: Date.now(),
        });
      }
      return { ...prev, isOpen: newIsOpen, query: '', selectedIndex: 0 };
    });
  }, [onAnalytics]);

  const closePalette = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const openPalette = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true }));
  }, []);

  return {
    state,
    inputRef,
    handleQueryChange,
    handleExecuteCommand,
    togglePalette,
    closePalette,
    openPalette,
  };
};
