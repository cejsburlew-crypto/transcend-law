# Global Command Palette Implementation

A powerful, keyboard-driven command palette for the Transcend platform with fuzzy search, recent tracking, and analytics.

## Features

- ✨ **Keyboard-First**: Press Cmd+K (Mac) or Ctrl+K (Windows/Linux)
- 🔍 **Fuzzy Search**: Intelligent search across all commands
- 📊 **Recently Used**: Automatically tracks your recently executed commands
- ⌨️ **Full Keyboard Navigation**: Arrow keys, Enter, Escape
- 🎨 **Beautiful UI**: Modern design with light/dark mode support
- 📈 **Analytics**: Track command usage and user behavior
- 🎯 **Customizable**: Easy to add custom commands per user
- 📱 **Responsive**: Works seamlessly on mobile and desktop

## Quick Start

### 1. Basic Setup in App.tsx

```tsx
import React from 'react';
import { CommandPaletteIntegration } from './components/CommandPaletteExample';

function App() {
  const handleNavigate = (path: string) => {
    // Use your router here (React Router, Next.js, etc.)
    window.location.href = path;
  };

  return (
    <>
      {/* Your app content */}
      <YourMainContent />
      
      {/* Add Command Palette */}
      <CommandPaletteIntegration onNavigate={handleNavigate} />
    </>
  );
}

export default App;
```

### 2. Custom Commands

```tsx
import { Command } from './hooks/useCommandPalette';

const customCommands: Command[] = [
  {
    id: 'custom-report',
    title: 'Generate Monthly Report',
    description: 'Create a new monthly report',
    category: 'action',
    icon: '📋',
    action: async () => {
      // Your action logic here
      await generateReport();
    },
    keywords: ['report', 'monthly', 'generate', 'export'],
    metadata: {
      userId: 'user-123',
      createdAt: new Date().toISOString(),
    },
  },
];
```

## API Reference

### Command Interface

```typescript
interface Command {
  // Unique identifier
  id: string;
  
  // Display title
  title: string;
  
  // Optional description shown in results
  description?: string;
  
  // Category for grouping and styling
  category: 'navigation' | 'action' | 'settings' | 'quick-action' | 'custom';
  
  // Optional emoji or icon
  icon?: string;
  
  // Optional keyboard shortcut display text
  shortcut?: string;
  
  // Function to execute when command is selected
  action: () => void | Promise<void>;
  
  // Keywords for better search matching
  keywords?: string[];
  
  // Optional metadata for tracking
  metadata?: {
    userId?: string;
    createdAt?: string;
  };
}
```

### useCommandPalette Hook

```typescript
const {
  state,              // Current state (isOpen, query, selectedIndex, etc.)
  inputRef,           // Ref for the input element
  handleQueryChange,  // Update search query
  handleExecuteCommand, // Execute a command
  togglePalette,      // Toggle palette open/closed
  closePalette,       // Close palette
  openPalette,        // Open palette
} = useCommandPalette({
  commands,           // Array of commands
  maxRecentItems: 5,  // Max recent commands to track (default: 5)
  onAnalytics,        // Optional analytics callback
  storageKey: 'key',  // LocalStorage key for recent commands
});
```

### CommandPalette Component Props

```typescript
interface CommandPaletteProps {
  // Array of available commands
  commands: Command[];
  
  // Analytics event callback
  onAnalytics?: (event: AnalyticsEvent) => void;
  
  // Maximum number of recent items to track
  maxRecentItems?: number;
  
  // Input placeholder text
  placeholder?: string;
}
```

### Analytics Events

```typescript
interface AnalyticsEvent {
  type: 'open' | 'close' | 'execute' | 'search' | 'navigate';
  commandId?: string;      // ID of executed command
  query?: string;          // Search query
  timestamp: number;       // Unix timestamp
}
```

## Usage Examples

### Example 1: Basic Integration

```tsx
import { CommandPalette, type Command } from './components/CommandPalette';

function MyApp() {
  const commands: Command[] = [
    {
      id: 'go-home',
      title: 'Go Home',
      category: 'navigation',
      icon: '🏠',
      action: () => navigate('/'),
      keywords: ['home', 'start'],
    },
  ];

  return <CommandPalette commands={commands} />;
}
```

### Example 2: With Analytics

```tsx
const handleAnalytics = (event: AnalyticsEvent) => {
  if (event.type === 'execute') {
    // Send to analytics service
    analyticsService.trackCommand(event.commandId);
  }
};

<CommandPalette
  commands={commands}
  onAnalytics={handleAnalytics}
/>
```

### Example 3: Dynamic Commands

```tsx
const generateDynamicCommands = (user: User): Command[] => {
  const baseCommands = [/* ... */];
  
  // Add user-specific commands
  if (user.role === 'attorney') {
    baseCommands.push({
      id: 'attorney-clients',
      title: 'My Clients',
      description: 'View your client list',
      category: 'navigation',
      action: () => navigate('/attorney/clients'),
    });
  }
  
  return baseCommands;
};
```

### Example 4: Custom Command Categories

```tsx
const commands: Command[] = [
  {
    id: 'ai-write',
    title: 'Write with AI',
    description: 'Generate content with AI assistance',
    category: 'custom',
    icon: '✨',
    action: () => openAIAssistant(),
    keywords: ['ai', 'write', 'generate', 'content'],
  },
];
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Cmd+K** / **Ctrl+K** | Open/close command palette |
| **↑** / **↓** | Navigate through commands |
| **Enter** | Execute selected command |
| **Esc** | Close palette |
| **Type** | Search/filter commands |

## Fuzzy Search Algorithm

The command palette uses a fuzzy search algorithm that:
- Matches any sequence of characters (doesn't require consecutive matches)
- Scores matches based on position and consecutive character matches
- Prioritizes results based on match quality
- Searches across title, description, and keywords

### Search Examples

```
Query: "srv" → Matches: "Services", "Create Service", "Service Directory"
Query: "doc" → Matches: "Documents", "Upload Document", "My Documents"
Query: "new case" → Matches: "Start New Case", "New Legal Service"
```

## Recently Used Commands

The palette automatically tracks your recently used commands:
- Stored in localStorage
- Displays when the palette is opened with empty search
- Configurable limit (default: 5 items)
- Persists across browser sessions

## Data Storage

### LocalStorage Keys

```javascript
// Recent commands history
localStorage.getItem('transcend-command-palette-recent')
// Returns: ["cmd-1", "cmd-2", "cmd-3", ...]
```

## Dark Mode Support

The command palette automatically adapts to your system's theme preference:
- Respects `prefers-color-scheme` media query
- Smooth transitions between themes
- All colors optimized for readability

## Accessibility

- Full keyboard navigation
- ARIA labels for screen readers
- High contrast mode support
- Semantic HTML structure
- Focus management

## Performance Considerations

- Fuzzy search: O(n*m) where n=commands, m=query length
- Recent commands cached in component state
- Debounced search to prevent excessive re-renders
- Virtualized list (optional, for 100+ commands)

## Mobile Considerations

- Touch-friendly interface
- Optimized for smaller screens
- Trigger button hidden on mobile (use keyboard shortcut)
- Full-height modal on mobile devices

## Integration with Popular Routers

### React Router v6

```tsx
import { useNavigate } from 'react-router-dom';

function App() {
  const navigate = useNavigate();
  
  return (
    <CommandPaletteIntegration
      onNavigate={(path) => navigate(path)}
    />
  );
}
```

### Next.js

```tsx
import { useRouter } from 'next/router';

function App() {
  const router = useRouter();
  
  return (
    <CommandPaletteIntegration
      onNavigate={(path) => router.push(path)}
    />
  );
}
```

## Best Practices

### 1. Command Organization

```tsx
// Group commands by category for better UX
const commands = [
  // Navigation commands
  { id: 'nav-1', category: 'navigation', /* ... */ },
  // Action commands
  { id: 'act-1', category: 'action', /* ... */ },
  // Settings
  { id: 'set-1', category: 'settings', /* ... */ },
];
```

### 2. Keyword Strategy

```tsx
{
  id: 'create-case',
  title: 'Create New Case',
  keywords: [
    'create', 'new', 'case', 'start',
    'legal', 'service', 'request',
  ],
  // More keywords = better discoverability
}
```

### 3. Analytics Tracking

```tsx
const handleAnalytics = (event: AnalyticsEvent) => {
  // Track to your analytics service
  mixpanel.track(`command_${event.type}`, {
    command_id: event.commandId,
    search_query: event.query,
  });
};
```

### 4. Error Handling

```tsx
{
  id: 'export-data',
  title: 'Export Data',
  action: async () => {
    try {
      await exportData();
    } catch (error) {
      toast.error('Export failed: ' + error.message);
    }
  },
}
```

## Troubleshooting

### Command Not Appearing

- Check if command ID is unique
- Verify keywords are lowercase
- Ensure command object has all required fields

### Search Not Working

- Clear localStorage cache
- Check browser console for errors
- Verify command keywords are relevant

### Analytics Not Firing

- Check if `onAnalytics` callback is provided
- Verify callback is not throwing errors
- Check browser console for warnings

## File Structure

```
transcend-frontend/src/
├── components/
│   ├── CommandPalette.tsx           # Main component
│   ├── CommandPalette.css           # Styles
│   ├── CommandPaletteExample.tsx    # Integration example
│   └── CommandPaletteIndex.ts       # Exports
├── hooks/
│   └── useCommandPalette.ts         # Hook with logic
└── COMMAND_PALETTE_DOCS.md          # This file
```

## Examples in Production

The Command Palette is ready to use in:
- Attorney dashboards
- Client service pages
- Admin panels
- Provider management
- Case management systems

## Contributing

To add new features:
1. Update the `Command` interface if needed
2. Add new command categories
3. Extend fuzzy search algorithm
4. Improve accessibility features

## License

Part of the Transcend SSP Platform

## Support

For issues or questions:
- Check the troubleshooting section
- Review the examples
- Check browser console for errors
- Contact support@transcend.legal
