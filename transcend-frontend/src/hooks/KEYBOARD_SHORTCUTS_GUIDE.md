# Keyboard Shortcuts Implementation Guide

## Overview

This guide explains how to implement and use the keyboard shortcuts system in the Transcend frontend application.

## Files

- `useKeyboardShortcuts.ts` - Custom React hook for managing keyboard shortcuts
- `ShortcutsHelp.tsx` - Modal component for displaying shortcuts
- `ShortcutsHelp.css` - Styles for the shortcuts help modal

## Features

### Global Shortcuts
- `?` - Show help modal
- `Cmd+K` (Mac) or `Ctrl+K` (Windows) - Open search
- `Esc` - Close modals and dialogs

### Page-Specific Shortcuts
Add custom shortcuts per page or feature

### Customizable Shortcuts
- Add/remove shortcuts dynamically
- Enable/disable shortcuts
- Update shortcut callbacks

### Platform Support
- Mac: Uses `Cmd` key
- Windows/Linux: Uses `Ctrl` key
- Automatically detects platform

### Vim-Style Navigation (Optional)
- `j` - Move down
- `k` - Move up
- `h` - Move left
- `l` - Move right
- `Shift+G` - Jump to bottom
- `g` - Jump to top

## Basic Usage

### 1. In App.tsx (Root Component)

```typescript
import React, { useState } from 'react';
import { useKeyboardShortcuts, DEFAULT_GLOBAL_SHORTCUTS } from './hooks/useKeyboardShortcuts';
import { ShortcutsHelp } from './components/ShortcutsHelp';

export const App: React.FC = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  // Define global shortcuts
  const shortcuts = [
    ...DEFAULT_GLOBAL_SHORTCUTS.map(s => ({
      ...s,
      callback: s.key === '?' 
        ? () => {} // Help is handled by the hook
        : s.key === ['Cmd', 'K'] || (Array.isArray(s.key) && s.key.includes('K'))
        ? () => setIsSearchOpen(true)
        : () => {}
    }))
  ];

  const { isHelpOpen, setIsHelpOpen, getActiveShortcuts } = useKeyboardShortcuts({
    shortcuts,
    enabled: true,
    allowInInput: false,
  });

  return (
    <>
      <YourAppContent />
      <ShortcutsHelp 
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        shortcuts={getActiveShortcuts()}
      />
    </>
  );
};
```

### 2. In a Page Component (e.g., Dashboard.tsx)

```typescript
import React from 'react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

export const Dashboard: React.FC = () => {
  const { addShortcut, removeShortcut } = useKeyboardShortcuts({
    shortcuts: [],
  });

  React.useEffect(() => {
    // Add page-specific shortcuts
    addShortcut({
      key: 'n',
      description: 'Create new case',
      category: 'Dashboard',
      callback: () => {
        // Handle new case creation
      },
    });

    addShortcut({
      key: 's',
      description: 'Save changes',
      category: 'Dashboard',
      callback: () => {
        // Handle save
      },
    });

    // Cleanup
    return () => {
      removeShortcut('n');
      removeShortcut('s');
    };
  }, [addShortcut, removeShortcut]);

  return (
    // Your component JSX
  );
};
```

### 3. Advanced: With Vim Navigation

```typescript
import React from 'react';
import { 
  useKeyboardShortcuts, 
  VIM_NAVIGATION_SHORTCUTS 
} from '../hooks/useKeyboardShortcuts';

export const ListView: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = React.useState(0);

  const vimShortcuts = VIM_NAVIGATION_SHORTCUTS.map(s => ({
    ...s,
    enabled: true, // Enable Vim shortcuts
    callback: () => {
      const key = Array.isArray(s.key) ? s.key[s.key.length - 1] : s.key;
      
      switch (key.toLowerCase()) {
        case 'j':
          setSelectedIndex(i => i + 1);
          break;
        case 'k':
          setSelectedIndex(i => Math.max(0, i - 1));
          break;
        // ... handle other keys
      }
    },
  }));

  useKeyboardShortcuts({
    shortcuts: vimShortcuts,
    enabled: true,
    allowInInput: false,
  });

  return (
    // List view with vim navigation
  );
};
```

## API Reference

### useKeyboardShortcuts Hook

#### Parameters

```typescript
interface KeyboardShortcutsConfig {
  shortcuts: KeyboardShortcut[];      // Array of shortcuts
  enabled?: boolean;                   // Enable/disable all shortcuts
  allowInInput?: boolean;              // Allow shortcuts in input fields
  allowInContentEditable?: boolean;   // Allow shortcuts in contenteditable elements
}
```

#### Return Values

```typescript
{
  // State
  isHelpOpen: boolean;
  setIsHelpOpen: (open: boolean) => void;
  platform: 'mac' | 'windows' | 'linux';

  // Shortcut management
  addShortcut: (shortcut: KeyboardShortcut) => void;
  removeShortcut: (key: string | string[]) => void;
  updateShortcut: (key: string | string[], updates: Partial<KeyboardShortcut>) => void;
  toggleShortcut: (key: string | string[], enabled: boolean) => void;

  // Shortcut queries
  getActiveShortcuts: () => KeyboardShortcut[];
  getShortcutsByCategory: (category: string) => KeyboardShortcut[];
  getGroupedShortcuts: () => Record<string, KeyboardShortcut[]>;

  // Utilities
  formatKeyCombo: (keyCombo: string | string[]) => string;
  matchesKeyCombo: (event: KeyboardEvent, keyCombo: string | string[]) => boolean;
  getModifierKey: () => string;
}
```

### KeyboardShortcut Interface

```typescript
interface KeyboardShortcut {
  key: string | string[];                    // Key combination
  description: string;                       // Help text
  category?: string;                         // Category for grouping
  callback: (event: KeyboardEvent) => void;  // Handler function
  enabled?: boolean;                         // Enable/disable this shortcut
  preventDefault?: boolean;                  // Prevent default behavior
}
```

## Key Combinations Format

### Single Key
```typescript
{ key: '?' }
{ key: 'Enter' }
{ key: 'Escape' }
```

### Modifier + Key
```typescript
{ key: 'Cmd+K' }           // Cmd on Mac, Ctrl on Windows
{ key: 'Ctrl+Shift+F' }    // Force Ctrl on all platforms
{ key: ['Cmd', 'K'] }      // Array format
```

### Special Keys
```typescript
'Enter', 'Escape', 'Tab', 'Space'
'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'
'Backspace', 'Delete', 'Home', 'End'
'PageUp', 'PageDown'
```

## Best Practices

### 1. Avoid Conflicts
- Check existing shortcuts before adding new ones
- Use categories to organize shortcuts
- Document your shortcuts

### 2. Accessibility
- Support both Mac and Windows
- Allow keyboard bypass for all shortcuts
- Include help text in shortcuts modal

### 3. Input Handling
- Disable shortcuts when in input fields (default behavior)
- Use `allowInInput: false` for security
- Consider context when enabling shortcuts

### 4. Performance
- Add/remove shortcuts during mount/unmount
- Use categories for efficient querying
- Avoid heavy computations in callbacks

### 5. User Experience
- Provide visual feedback for shortcuts
- Display shortcuts in UI (e.g., buttons)
- Make shortcuts discoverable via help modal

## Examples

### Search Implementation
```typescript
const [isOpen, setIsOpen] = useState(false);

useKeyboardShortcuts({
  shortcuts: [{
    key: ['Cmd', 'K'],
    description: 'Search',
    category: 'Global',
    callback: () => setIsOpen(true),
  }],
});
```

### Form Submission
```typescript
useKeyboardShortcuts({
  shortcuts: [{
    key: ['Cmd', 'Enter'],
    description: 'Submit form',
    category: 'Form',
    callback: () => {
      handleFormSubmit();
    },
  }],
  allowInInput: true, // Allow in form inputs
});
```

### Navigation
```typescript
useKeyboardShortcuts({
  shortcuts: [
    {
      key: 'j',
      description: 'Next item',
      category: 'Navigation',
      callback: () => navigateNext(),
    },
    {
      key: 'k',
      description: 'Previous item',
      category: 'Navigation',
      callback: () => navigatePrevious(),
    },
  ],
});
```

## Testing

```typescript
import { useKeyboardShortcuts, matchesKeyCombo } from './hooks/useKeyboardShortcuts';

// Test key matching
test('matches keyboard shortcuts', () => {
  const event = new KeyboardEvent('keydown', {
    key: 'k',
    ctrlKey: true,
  });

  expect(matchesKeyCombo(event, 'Ctrl+K')).toBe(true);
});

// Test hook
test('handles shortcuts', () => {
  const { result } = renderHook(() => useKeyboardShortcuts({ shortcuts: [] }));
  
  act(() => {
    result.current.addShortcut({
      key: 'Enter',
      description: 'Test',
      callback: jest.fn(),
    });
  });

  expect(result.current.getActiveShortcuts().length).toBe(1);
});
```

## Troubleshooting

### Shortcuts not working
- Check if `enabled` is `true`
- Verify key combination format
- Check browser console for errors
- Ensure component is mounted

### Shortcuts firing in inputs
- Set `allowInInput: false` (default)
- Check `allowInContentEditable` setting

### Mac/Windows key differences
- Use `'Cmd+K'` format for automatic platform detection
- Use `'Ctrl+K'` or `'Meta+K'` for explicit control

### Help modal not showing
- Ensure `ShortcutsHelp` component is rendered
- Check `isHelpOpen` state
- Verify `?` key shortcut is enabled

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- IE11: Not supported (uses modern ES6+)

## Performance Considerations

- Keyboard event listeners are cleaned up on unmount
- Shortcuts are stored in refs for efficient updates
- Modal component uses memo for optimization

## Security

- Shortcuts don't execute in untrusted content
- Event `preventDefault()` is optional and safe
- No user data is exposed in keyboard shortcut handling
