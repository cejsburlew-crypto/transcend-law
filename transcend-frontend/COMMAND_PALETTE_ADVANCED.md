# Command Palette - Advanced Usage Guide

Advanced patterns and techniques for extending the Command Palette with custom functionality.

## Table of Contents

1. [Dynamic Command Loading](#dynamic-command-loading)
2. [Command Providers](#command-providers)
3. [Analytics Integration](#analytics-integration)
4. [Advanced Filtering](#advanced-filtering)
5. [Command Shortcuts](#command-shortcuts)
6. [User Preferences](#user-preferences)
7. [Performance Optimization](#performance-optimization)

## Dynamic Command Loading

### Loading Commands from API

```tsx
import { useState, useEffect } from 'react';
import { Command } from '../hooks/useCommandPalette';

function useApiCommands() {
  const [commands, setCommands] = useState<Command[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCommands = async () => {
      try {
        const response = await fetch('/api/commands');
        const data = await response.json();
        
        // Transform API response to Command format
        const apiCommands = data.map((cmd: any) => ({
          id: cmd.id,
          title: cmd.name,
          description: cmd.description,
          category: cmd.category,
          icon: cmd.icon,
          action: () => fetch(`/api/commands/${cmd.id}/execute`, { method: 'POST' }),
          keywords: cmd.keywords || [],
        }));
        
        setCommands(apiCommands);
      } catch (error) {
        console.error('Failed to load commands:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCommands();
  }, []);

  return { commands, loading };
}

// Usage
function App() {
  const { commands, loading } = useApiCommands();
  
  return loading ? <div>Loading...</div> : <CommandPalette commands={commands} />;
}
```

## Command Providers

### Creating Reusable Command Providers

```tsx
// hooks/useNavigationCommands.ts
import { Command } from './useCommandPalette';

export const useNavigationCommands = (navigate: (path: string) => void): Command[] => [
  {
    id: 'nav-dashboard',
    title: 'Dashboard',
    category: 'navigation',
    icon: '📊',
    action: () => navigate('/dashboard'),
    keywords: ['dashboard', 'home', 'overview'],
  },
  {
    id: 'nav-settings',
    title: 'Settings',
    category: 'navigation',
    icon: '⚙️',
    action: () => navigate('/settings'),
    keywords: ['settings', 'preferences', 'config'],
  },
  // ... more navigation commands
];

// hooks/useActionCommands.ts
export const useActionCommands = (
  openDialog: (type: string) => void
): Command[] => [
  {
    id: 'action-new-case',
    title: 'Create New Case',
    category: 'action',
    icon: '📋',
    action: () => openDialog('new-case'),
    keywords: ['create', 'case', 'new'],
  },
  // ... more action commands
];

// Usage in component
function App() {
  const navigate = useNavigate();
  const [dialogType, setDialogType] = useState<string | null>(null);
  
  const navigationCommands = useNavigationCommands(navigate);
  const actionCommands = useActionCommands(setDialogType);
  
  const allCommands = [...navigationCommands, ...actionCommands];
  
  return <CommandPalette commands={allCommands} />;
}
```

### Role-Based Commands

```tsx
import { Command } from '../hooks/useCommandPalette';
import { User } from '../types';

export const useRoleBasedCommands = (user: User | null): Command[] => {
  const baseCommands: Command[] = [/* ... */];

  if (!user) return baseCommands;

  if (user.role === 'attorney') {
    baseCommands.push(
      {
        id: 'attorney-clients',
        title: 'My Clients',
        category: 'navigation',
        action: () => navigate('/attorney/clients'),
        keywords: ['clients', 'my', 'list'],
      },
      {
        id: 'attorney-billing',
        title: 'Billing Dashboard',
        category: 'navigation',
        action: () => navigate('/attorney/billing'),
        keywords: ['billing', 'invoices', 'payments'],
      }
    );
  }

  if (user.role === 'admin') {
    baseCommands.push(
      {
        id: 'admin-users',
        title: 'Manage Users',
        category: 'action',
        action: () => navigate('/admin/users'),
        keywords: ['users', 'manage', 'admin'],
      },
      {
        id: 'admin-analytics',
        title: 'Analytics',
        category: 'navigation',
        action: () => navigate('/admin/analytics'),
        keywords: ['analytics', 'reports', 'data'],
      }
    );
  }

  return baseCommands;
};
```

## Analytics Integration

### Advanced Analytics Tracking

```tsx
import { AnalyticsEvent } from '../hooks/useCommandPalette';

interface CommandAnalytics {
  commandId: string;
  executedAt: number;
  searchQuery?: string;
  executionTime?: number;
  category: string;
  userId?: string;
}

class CommandAnalyticsService {
  private events: CommandAnalytics[] = [];

  trackEvent(event: AnalyticsEvent, userId?: string) {
    if (event.type === 'execute' && event.commandId) {
      const analytics: CommandAnalytics = {
        commandId: event.commandId,
        executedAt: event.timestamp,
        searchQuery: event.query,
        category: this.getCategoryForCommand(event.commandId),
        userId,
      };

      this.events.push(analytics);
      this.sendToServer(analytics);
    }
  }

  private getCategoryForCommand(commandId: string): string {
    // Logic to get category based on commandId
    return 'navigation';
  }

  private sendToServer(analytics: CommandAnalytics) {
    fetch('/api/analytics/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(analytics),
    }).catch(console.error);
  }

  getStats() {
    return {
      totalCommands: this.events.length,
      mostUsed: this.getMostUsedCommands(),
      byCategory: this.groupByCategory(),
    };
  }

  private getMostUsedCommands(limit = 5) {
    const counts = new Map<string, number>();
    
    this.events.forEach((event) => {
      counts.set(event.commandId, (counts.get(event.commandId) || 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);
  }

  private groupByCategory() {
    const groups = new Map<string, number>();
    
    this.events.forEach((event) => {
      groups.set(event.category, (groups.get(event.category) || 0) + 1);
    });

    return Object.fromEntries(groups);
  }
}

// Usage
const analyticsService = new CommandAnalyticsService();

function App() {
  const { user } = useAuth();

  const handleAnalytics = (event: AnalyticsEvent) => {
    analyticsService.trackEvent(event, user?.id);
  };

  return (
    <CommandPalette
      commands={commands}
      onAnalytics={handleAnalytics}
    />
  );
}
```

## Advanced Filtering

### Custom Search Algorithm

```tsx
import { Command } from '../hooks/useCommandPalette';

interface SearchResult {
  command: Command;
  score: number;
  matchedFields: string[];
}

class AdvancedSearchEngine {
  search(query: string, commands: Command[]): SearchResult[] {
    if (!query.trim()) return [];

    const results = commands
      .map((cmd) => this.scoreCommand(query, cmd))
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score);

    return results;
  }

  private scoreCommand(query: string, command: Command): SearchResult {
    const lowerQuery = query.toLowerCase();
    let score = 0;
    const matchedFields: string[] = [];

    // Title match (highest weight)
    if (command.title.toLowerCase().includes(lowerQuery)) {
      score += 100;
      matchedFields.push('title');
    }

    // Description match
    if (command.description?.toLowerCase().includes(lowerQuery)) {
      score += 50;
      matchedFields.push('description');
    }

    // Keywords match
    const keywordMatch = command.keywords?.filter((k) =>
      k.toLowerCase().includes(lowerQuery)
    ) || [];

    if (keywordMatch.length > 0) {
      score += 25 * keywordMatch.length;
      matchedFields.push('keywords');
    }

    // Category match
    if (command.category.includes(lowerQuery)) {
      score += 10;
      matchedFields.push('category');
    }

    // Fuzzy score
    const fuzzyScore = this.calculateFuzzyScore(lowerQuery, command.title.toLowerCase());
    score += fuzzyScore;

    return { command, score, matchedFields };
  }

  private calculateFuzzyScore(query: string, text: string): number {
    let score = 0;
    let queryIdx = 0;

    for (let i = 0; i < text.length && queryIdx < query.length; i++) {
      if (text[i] === query[queryIdx]) {
        score++;
        queryIdx++;
      }
    }

    return queryIdx === query.length ? score : 0;
  }
}
```

## Command Shortcuts

### Custom Keyboard Shortcuts

```tsx
import { useEffect } from 'react';
import { Command } from '../hooks/useCommandPalette';

export const useCommandShortcuts = (commands: Command[]) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Define custom shortcuts
      const shortcuts: Record<string, string> = {
        'n': 'nav-services',      // 'N' for new
        'd': 'nav-dashboard',     // 'D' for dashboard
        's': 'settings-profile',  // 'S' for settings
        '?': 'quick-help',        // '?' for help
      };

      // Check if Shift is held (to avoid conflicts with text input)
      if (e.shiftKey && e.key in shortcuts) {
        e.preventDefault();
        const commandId = shortcuts[e.key];
        const command = commands.find((c) => c.id === commandId);
        if (command) {
          command.action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commands]);
};

// Usage
function App() {
  useCommandShortcuts(commands);
  return <CommandPalette commands={commands} />;
}
```

## User Preferences

### Storing Command Preferences

```tsx
interface CommandPreferences {
  favoriteCommands: string[];
  hiddenCommands: string[];
  customCommandOrder: string[];
  theme: 'light' | 'dark' | 'auto';
}

class CommandPreferencesService {
  private storageKey = 'command-palette-preferences';

  getPreferences(): CommandPreferences {
    const stored = localStorage.getItem(this.storageKey);
    return stored
      ? JSON.parse(stored)
      : {
          favoriteCommands: [],
          hiddenCommands: [],
          customCommandOrder: [],
          theme: 'auto',
        };
  }

  savePreferences(preferences: CommandPreferences) {
    localStorage.setItem(this.storageKey, JSON.stringify(preferences));
  }

  addFavorite(commandId: string) {
    const prefs = this.getPreferences();
    if (!prefs.favoriteCommands.includes(commandId)) {
      prefs.favoriteCommands.push(commandId);
      this.savePreferences(prefs);
    }
  }

  removeFavorite(commandId: string) {
    const prefs = this.getPreferences();
    prefs.favoriteCommands = prefs.favoriteCommands.filter((id) => id !== commandId);
    this.savePreferences(prefs);
  }

  hideCommand(commandId: string) {
    const prefs = this.getPreferences();
    if (!prefs.hiddenCommands.includes(commandId)) {
      prefs.hiddenCommands.push(commandId);
      this.savePreferences(prefs);
    }
  }

  getVisibleCommands(commands: Command[]): Command[] {
    const prefs = this.getPreferences();
    return commands.filter((cmd) => !prefs.hiddenCommands.includes(cmd.id));
  }
}

// Usage
const preferencesService = new CommandPreferencesService();

function App() {
  const allCommands = getCommands();
  const visibleCommands = preferencesService.getVisibleCommands(allCommands);

  return <CommandPalette commands={visibleCommands} />;
}
```

## Performance Optimization

### Virtualization for Large Command Lists

```tsx
import { useState, useMemo } from 'react';
import { Command } from '../hooks/useCommandPalette';

interface VirtualizerProps {
  items: Command[];
  itemHeight: number;
  maxVisible: number;
  renderItem: (item: Command) => React.ReactNode;
}

const CommandVirtualizer: React.FC<VirtualizerProps> = ({
  items,
  itemHeight,
  maxVisible,
  renderItem,
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);

  const startIdx = Math.floor(scrollOffset / itemHeight);
  const endIdx = Math.min(startIdx + maxVisible, items.length);
  const visibleItems = items.slice(startIdx, endIdx);
  const offsetY = startIdx * itemHeight;

  return (
    <div
      style={{ height: maxVisible * itemHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollOffset(e.currentTarget.scrollTop)}
    >
      <div style={{ transform: `translateY(${offsetY}px)` }}>
        {visibleItems.map((item) => (
          <div key={item.id} style={{ height: itemHeight }}>
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
};

// Usage with large command lists
function App() {
  const commands = getLotsOfCommands(); // 1000+ commands

  return (
    <CommandVirtualizer
      items={commands}
      itemHeight={44}
      maxVisible={10}
      renderItem={(cmd) => <CommandItem command={cmd} />}
    />
  );
}
```

### Memoization for Performance

```tsx
import { useMemo, useCallback } from 'react';
import { Command } from '../hooks/useCommandPalette';

function useOptimizedCommands(
  allCommands: Command[],
  query: string,
  maxRecentItems: number
) {
  return useMemo(() => {
    if (!query.trim()) return allCommands.slice(0, maxRecentItems);

    return fuzzySearch(query, allCommands);
  }, [query, allCommands, maxRecentItems]);
}

function useOptimizedCommandExecution(commands: Command[]) {
  return useCallback((commandId: string) => {
    const command = commands.find((c) => c.id === commandId);
    if (command) {
      return command.action();
    }
  }, [commands]);
}
```

## Integration Example: Complete Advanced Setup

```tsx
import React, { useMemo, useCallback } from 'react';
import { CommandPalette, type Command } from './components/CommandPalette';
import { useAuth } from './context/AuthContext';
import { useNavigate } from 'react-router-dom';

export function AdvancedCommandPaletteApp() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const preferencesService = new CommandPreferencesService();
  const analyticsService = new CommandAnalyticsService();
  const searchEngine = new AdvancedSearchEngine();

  // Generate commands based on user role
  const commands = useMemo(() => {
    const navCommands = useNavigationCommands(navigate);
    const actionCommands = useActionCommands(() => {});
    const roleCommands = useRoleBasedCommands(user);

    return [...navCommands, ...actionCommands, ...roleCommands];
  }, [user, navigate]);

  // Filter based on preferences
  const visibleCommands = useMemo(
    () => preferencesService.getVisibleCommands(commands),
    [commands]
  );

  // Handle analytics
  const handleAnalytics = useCallback(
    (event) => {
      analyticsService.trackEvent(event, user?.id);
    },
    [user?.id]
  );

  // Use custom shortcuts
  useCommandShortcuts(commands);

  return (
    <CommandPalette
      commands={visibleCommands}
      onAnalytics={handleAnalytics}
      maxRecentItems={10}
    />
  );
}
```

## Best Practices

1. **Keep Commands Organized**: Use command providers for different areas
2. **Track Analytics**: Monitor which commands are most used
3. **Respect Preferences**: Allow users to customize their experience
4. **Optimize Performance**: Use memoization and virtualization for large lists
5. **Error Handling**: Always wrap async actions in try-catch
6. **Accessibility**: Test with keyboard and screen readers
7. **Testing**: Write unit tests for custom search and filtering logic
