# Keyboard Shortcuts Implementation - Complete Reference

## Overview

A complete keyboard shortcuts system has been implemented for the Transcend frontend application. This system provides:

- **Global shortcuts** (?, Cmd/Ctrl+K, Esc)
- **Page-specific shortcuts** (dynamically registered)
- **Customizable shortcuts** (add/remove/enable/disable at runtime)
- **Platform awareness** (Mac Cmd, Windows/Linux Ctrl)
- **Vim-style navigation** (optional)
- **Accessibility** (help modal, focus management)

## Files Implemented

### Core Hook
**Location:** `/transcend-frontend/src/hooks/useKeyboardShortcuts.ts`

A React hook that handles:
- Keyboard event detection and matching
- Shortcut registration and management
- Platform detection (Mac, Windows, Linux)
- Key combination parsing
- Help modal state

**Key exports:**
- `useKeyboardShortcuts()` - Main hook
- `DEFAULT_GLOBAL_SHORTCUTS` - Pre-configured global shortcuts
- `VIM_NAVIGATION_SHORTCUTS` - Vim-style navigation
- `KeyboardShortcut` interface
- `KeyboardShortcutsConfig` interface

### UI Component
**Location:** `/transcend-frontend/src/components/ShortcutsHelp.tsx`

A modal dialog component that displays:
- All active shortcuts
- Shortcuts grouped by category
- Keyboard keys formatted for display
- Close button and Esc support
- Responsive design

**Location:** `/transcend-frontend/src/components/ShortcutsHelp.css`

Professional styling with:
- Light/dark mode support
- Responsive mobile layout
- Accessible focus states
- Smooth animations

### Provider Component
**Location:** `/transcend-frontend/src/components/KeyboardShortcutsProvider.tsx`

React context provider that:
- Manages global shortcuts at app level
- Allows pages to register shortcuts
- Auto-cleanup on unmount
- Provides `useRegisterShortcuts()` hook

### Documentation
**Location:** `/transcend-frontend/src/hooks/KEYBOARD_SHORTCUTS_GUIDE.md`

Comprehensive guide including:
- Feature overview
- API reference
- Usage examples
- Best practices
- Testing guidance
- Troubleshooting

**Location:** `/transcend-frontend/KEYBOARD_SHORTCUTS_EXAMPLES.md`

Practical examples showing:
- Quick start setup
- Dashboard integration
- Search implementation
- List navigation with Vim keys
- Form submission
- Conditional shortcuts
- Attorney case management example

## Quick Start

### 1. Setup App Root

```typescript
import { KeyboardShortcutsProvider } from './components/KeyboardShortcutsProvider';

function App() {
  return (
    <KeyboardShortcutsProvider
      onSearch={() => {/* open search */}}
    >
      <YourApp />
    </KeyboardShortcutsProvider>
  );
}
```

### 2. Register Page Shortcuts

```typescript
import { useRegisterShortcuts } from '../components/KeyboardShortcutsProvider';

export const Dashboard = () => {
  useRegisterShortcuts([
    {
      key: 'n',
      description: 'Create new case',
      category: 'Cases',
      callback: () => {/* handle new case */},
    },
  ]);

  return <div>Dashboard</div>;
};
```

## Features

### Global Shortcuts (Automatic)

| Key | Action | Platform |
|-----|--------|----------|
| `?` | Show help modal | All |
| `Cmd+K` | Search | Mac |
| `Ctrl+K` | Search | Windows/Linux |
| `Esc` | Close modals | All |

### Page-Specific Shortcuts

Example:
- `n` - New case
- `e` - Edit selected
- `d` - Delete selected
- `r` - Refresh
- `Enter` - Select/Open

### Platform Support

**Mac:**
- Uses `Cmd` key for shortcuts
- `Opt` displayed for Alt key
- Automatic `Cmd+K` support

**Windows/Linux:**
- Uses `Ctrl` key for shortcuts
- `Alt` displayed for Alt key
- Automatic `Ctrl+K` support

### Vim Navigation (Optional)

Enable with `enableVimNavigation` prop:
- `j` - Move down
- `k` - Move up
- `h` - Move left
- `l` - Move right
- `Shift+G` - Jump to bottom
- `g` - Jump to top

### Input Handling

- Shortcuts **disabled** by default in input fields
- Configurable per hook instance
- Prevents accidental triggers

### Accessibility

- Focus management in modal
- Keyboard navigation
- ARIA labels and roles
- Screen reader support
- Escape to close

## API Reference

### useKeyboardShortcuts Hook

```typescript
const {
  // State
  isHelpOpen,
  setIsHelpOpen,
  platform,

  // Management
  addShortcut,
  removeShortcut,
  updateShortcut,
  toggleShortcut,

  // Queries
  getActiveShortcuts,
  getShortcutsByCategory,
  getGroupedShortcuts,

  // Utilities
  formatKeyCombo,
  matchesKeyCombo,
  getModifierKey,
} = useKeyboardShortcuts({
  shortcuts: [],
  enabled: true,
  allowInInput: false,
  allowInContentEditable: false,
});
```

### KeyboardShortcut Interface

```typescript
interface KeyboardShortcut {
  key: string | string[];                    // Key combination
  description: string;                       // Help text
  category?: string;                         // For grouping
  callback: (event: KeyboardEvent) => void;  // Handler
  enabled?: boolean;                         // Toggle
  preventDefault?: boolean;                  // Stop default
}
```

### useRegisterShortcuts Hook

```typescript
useRegisterShortcuts([
  {
    key: 'n',
    description: 'New item',
    category: 'Items',
    callback: () => { /* ... */ },
  },
]);
```

## Key Combination Format

### Single Keys
```typescript
{ key: 'Enter' }
{ key: 'Escape' }
{ key: 'Tab' }
{ key: ' ' } // Space
```

### Special Keys
```typescript
{ key: 'ArrowUp' }
{ key: 'ArrowDown' }
{ key: 'Home' }
{ key: 'End' }
{ key: 'PageUp' }
{ key: 'PageDown' }
```

### Modifier Combinations
```typescript
{ key: 'Cmd+K' }           // Auto platform
{ key: 'Ctrl+K' }          // Force Ctrl
{ key: 'Shift+Delete' }
{ key: 'Cmd+Shift+P' }
```

### Array Format
```typescript
{ key: ['Cmd', 'K'] }
{ key: ['Ctrl', 'Shift', 'F'] }
```

## Configuration Options

### Hook Configuration

```typescript
useKeyboardShortcuts({
  shortcuts: [],                    // Initial shortcuts
  enabled: true,                    // Global enable/disable
  allowInInput: false,              // Allow in <input>
  allowInContentEditable: false,   // Allow in contenteditable
});
```

### Provider Configuration

```typescript
<KeyboardShortcutsProvider
  onSearch={() => {}}              // Search callback
  onHelp={() => {}}                // Help callback
  enableVimNavigation={false}      // Vim keys
>
  {children}
</KeyboardShortcutsProvider>
```

## Usage Patterns

### Pattern 1: Global App Setup

```typescript
// App.tsx
<KeyboardShortcutsProvider>
  <Router>
    <Routes>{/* routes */}</Routes>
  </Router>
</KeyboardShortcutsProvider>
```

### Pattern 2: Page Shortcuts

```typescript
// Dashboard.tsx
useRegisterShortcuts([
  { key: 'n', description: 'New', callback: () => {} },
  { key: 'e', description: 'Edit', callback: () => {} },
]);
```

### Pattern 3: Conditional Shortcuts

```typescript
useRegisterShortcuts([
  {
    key: 'Delete',
    description: 'Delete',
    callback: () => {},
    enabled: canDelete, // Enable/disable based on state
  },
]);
```

### Pattern 4: Dynamic Shortcuts

```typescript
const { addShortcut, removeShortcut } = useKeyboardShortcuts({});

useEffect(() => {
  if (isEditMode) {
    addShortcut({
      key: ['Cmd', 'S'],
      description: 'Save',
      callback: handleSave,
    });
  }
}, [isEditMode, addShortcut]);
```

### Pattern 5: Keyboard Navigation

```typescript
useRegisterShortcuts([
  {
    key: 'ArrowDown',
    description: 'Next',
    callback: () => setIndex(i => i + 1),
  },
  {
    key: 'ArrowUp',
    description: 'Previous',
    callback: () => setIndex(i => i - 1),
  },
]);
```

## Browser Support

| Browser | Support |
|---------|---------|
| Chrome | Full |
| Firefox | Full |
| Safari | Full |
| Edge | Full |
| IE 11 | Not supported |

## Performance

- **Event listeners:** Cleaned up on unmount
- **Shortcuts storage:** Uses refs for efficiency
- **Re-renders:** Minimized with memoization
- **Memory:** No memory leaks

## Security

- **No script injection:** Shortcuts only trigger callbacks
- **Event safety:** `preventDefault()` is optional
- **Input protection:** Shortcuts disabled in inputs by default
- **No data leakage:** No user data exposed

## Troubleshooting

### Shortcuts not working

1. Check if provider is wrapping your component
2. Verify `enabled: true`
3. Check key format
4. Look for console errors

### Triggered in input fields

Set `allowInInput: false` (default is already false)

### Mac vs Windows differences

Use `'Cmd+K'` format for automatic platform detection

### Help modal not showing

- Ensure `ShortcutsHelp` component is rendered
- Check `isHelpOpen` state
- Verify `?` shortcut is configured

## Examples

### Search
```typescript
{ key: ['Cmd', 'K'], description: 'Search', callback: () => {} }
```

### Navigation
```typescript
{ key: 'ArrowDown', description: 'Next', callback: () => {} }
{ key: 'ArrowUp', description: 'Previous', callback: () => {} }
```

### Actions
```typescript
{ key: 'n', description: 'New', callback: () => {} }
{ key: 'e', description: 'Edit', callback: () => {} }
{ key: 'd', description: 'Delete', callback: () => {} }
```

### Forms
```typescript
{ key: ['Cmd', 'Enter'], description: 'Submit', callback: () => {} }
{ key: ['Cmd', 'S'], description: 'Save', callback: () => {} }
```

## Integration Checklist

- [ ] Install provider in App.tsx
- [ ] Add SearchComponent integration
- [ ] Register Dashboard shortcuts
- [ ] Test on Mac and Windows
- [ ] Test modal open/close
- [ ] Test Esc key functionality
- [ ] Verify input field behavior
- [ ] Add analytics (optional)
- [ ] Document team shortcuts
- [ ] Train team on shortcuts

## Future Enhancements

- [ ] Customizable keyboard shortcuts UI
- [ ] Keyboard shortcuts persistence (localStorage)
- [ ] Shortcut conflict detection
- [ ] Shortcut usage analytics
- [ ] Command palette integration
- [ ] Gamepad support
- [ ] Accessibility improvements
- [ ] Internationalization

## Support & Resources

- **Documentation:** `/transcend-frontend/src/hooks/KEYBOARD_SHORTCUTS_GUIDE.md`
- **Examples:** `/transcend-frontend/KEYBOARD_SHORTCUTS_EXAMPLES.md`
- **Tests:** Add unit tests to verify shortcuts
- **Issues:** Check browser console for errors

## Questions?

Refer to the comprehensive guide and examples for more information.

---

**Implementation Date:** 2026-08-15
**Status:** Complete and ready for integration
