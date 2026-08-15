# Command Palette Setup Checklist

Complete step-by-step guide to get the Command Palette up and running in your project.

## Pre-Implementation (5 mins)

- [ ] Review `COMMAND_PALETTE_IMPLEMENTATION_SUMMARY.md` for overview
- [ ] Review file locations and structure
- [ ] Check React version (16.8+ required for hooks)
- [ ] Ensure TypeScript is configured in project

## Files Verification (2 mins)

Verify all files are created in correct locations:

```bash
# Run this in transcend-frontend directory
ls -la src/components/CommandPalette.tsx
ls -la src/components/CommandPalette.css
ls -la src/components/CommandPaletteExample.tsx
ls -la src/components/CommandPaletteIndex.ts
ls -la src/hooks/useCommandPalette.ts
ls -la src/components/__tests__/CommandPalette.test.tsx
ls -la COMMAND_PALETTE_DOCS.md
ls -la COMMAND_PALETTE_ADVANCED.md
```

Expected output: All 8 files should exist.

## Step 1: Basic Integration (10 mins)

### 1.1 Update App.tsx

```tsx
// src/App.tsx

import React from 'react';
import { CommandPaletteIntegration } from './components/CommandPaletteExample';

function App() {
  // ... your existing code ...

  return (
    <>
      {/* Your existing content */}
      
      {/* Add this line at the end */}
      <CommandPaletteIntegration onNavigate={(path) => {
        // Use your router here
        // Example for React Router:
        // navigate(path);
        // Example for Next.js:
        // router.push(path);
        console.log('Navigate to:', path);
      }} />
    </>
  );
}

export default App;
```

### 1.2 Verify CSS Import

CommandPalette.css is automatically imported by the component. No additional CSS import needed.

### 1.3 Test Basic Functionality

```bash
# Start your dev server
npm run dev

# In browser:
# Press Cmd+K (Mac) or Ctrl+K (Windows/Linux)
# You should see the command palette open
```

## Step 2: Connect Router (5 mins)

### For React Router v6:

```tsx
// src/App.tsx

import { useNavigate } from 'react-router-dom';
import { CommandPaletteIntegration } from './components/CommandPaletteExample';

function App() {
  const navigate = useNavigate();

  return (
    <>
      {/* Your content */}
      <CommandPaletteIntegration onNavigate={navigate} />
    </>
  );
}
```

### For Next.js:

```tsx
// src/app/layout.tsx or _app.tsx

import { useRouter } from 'next/router';
import { CommandPaletteIntegration } from '@/components/CommandPaletteExample';

function RootLayout() {
  const router = useRouter();

  return (
    <>
      {/* Your content */}
      <CommandPaletteIntegration onNavigate={(path) => router.push(path)} />
    </>
  );
}
```

### For Remix:

```tsx
// src/root.tsx

import { useNavigate } from '@remix-run/react';
import { CommandPaletteIntegration } from './components/CommandPaletteExample';

export default function App() {
  const navigate = useNavigate();

  return (
    <>
      {/* Your content */}
      <CommandPaletteIntegration onNavigate={navigate} />
    </>
  );
}
```

## Step 3: Customize Commands (15 mins)

### 3.1 Review Current Commands

Open `src/components/CommandPaletteExample.tsx` and review the 18 example commands.

### 3.2 Add Custom Commands

Edit the `commands` array in `CommandPaletteIntegration.tsx`:

```tsx
// Add after existing commands
{
  id: 'custom-my-feature',
  title: 'My Custom Feature',
  description: 'What this does',
  category: 'action',
  icon: '✨',
  action: () => onNavigate?.('/my-feature'),
  keywords: ['custom', 'feature', 'my'],
}
```

### 3.3 Remove Unused Commands

Delete any commands you don't need from the `baseCommands` array.

### 3.4 Verify Commands Appear

```bash
npm run dev
# Press Cmd/Ctrl+K
# Type to search for your custom command
```

## Step 4: Setup Analytics (10 mins)

### 4.1 Create Analytics Handler

```tsx
// src/services/commandAnalytics.ts

import { AnalyticsEvent } from '../hooks/useCommandPalette';

export const trackCommandEvent = (event: AnalyticsEvent) => {
  // Send to your analytics service
  
  // Google Analytics example:
  if (window.gtag) {
    window.gtag('event', `command_${event.type}`, {
      command_id: event.commandId,
      search_query: event.query,
      timestamp: event.timestamp,
    });
  }
  
  // Or to custom backend:
  fetch('/api/analytics/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  }).catch(console.error);
};
```

### 4.2 Connect Handler to Component

```tsx
// src/App.tsx

import { trackCommandEvent } from './services/commandAnalytics';

function App() {
  return (
    <>
      {/* Your content */}
      <CommandPaletteIntegration 
        onNavigate={navigate}
      />
      
      {/* Or create custom integration with analytics */}
      <CommandPalette
        commands={commands}
        onAnalytics={trackCommandEvent}
      />
    </>
  );
}
```

### 4.3 Verify Analytics

- Open Command Palette
- Execute a command
- Check browser console or analytics service
- You should see event logged

## Step 5: Test All Features (10 mins)

### 5.1 Keyboard Shortcuts

```
Test: Cmd+K / Ctrl+K → Palette opens
Test: Type "doc" → Shows document-related commands
Test: Arrow Up/Down → Selects different commands
Test: Enter → Executes selected command
Test: Esc → Closes palette
Test: Click outside → Closes palette
```

### 5.2 Recent Commands

```
Test: Execute a command
Test: Close palette (Esc)
Test: Open palette again
Test: Should show recent commands first
```

### 5.3 Search

```
Test: Type "service" → Shows relevant commands
Test: Type "srv" → Fuzzy search works
Test: Type "xyz" → Empty state shows
Test: Click clear button → Search clears
```

### 5.4 Mobile

```
Test: Open on mobile/tablet
Test: Tap search input
Test: Use keyboard to navigate
Test: Execute command
Test: Palette closes after execution
```

## Step 6: Run Tests (5 mins)

```bash
# Run test suite
npm test -- CommandPalette.test.tsx

# Expected output:
# PASS src/components/__tests__/CommandPalette.test.tsx
# ✓ All tests pass (30+ tests)
```

If tests fail:
- Check React Testing Library is installed
- Verify all dependencies in package.json
- Run `npm install` to update packages

## Step 7: Production Checklist (5 mins)

- [ ] Remove console.log statements
- [ ] Test in production build: `npm run build`
- [ ] Verify keyboard shortcuts work in production build
- [ ] Check performance with React DevTools Profiler
- [ ] Test on target browsers (Chrome, Firefox, Safari)
- [ ] Verify dark mode works (if applicable)
- [ ] Check accessibility with screen reader
- [ ] Verify analytics events are tracking

## Optional: Advanced Setup

### Create Role-Based Commands

```tsx
// src/hooks/useRoleBasedCommands.ts

import { useAuth } from '../context/AuthContext';

export function useRoleBasedCommands() {
  const { user } = useAuth();
  
  const extraCommands = [];
  
  if (user?.role === 'attorney') {
    extraCommands.push({
      id: 'attorney-dashboard',
      title: 'Attorney Dashboard',
      category: 'navigation',
      action: () => navigate('/attorney'),
      keywords: ['attorney', 'dashboard'],
    });
  }
  
  return extraCommands;
}
```

### Store User Preferences

```tsx
// src/services/commandPreferences.ts

export const saveCommandPreference = (commandId: string, preference: 'favorite' | 'hidden') => {
  const key = `command-preference-${commandId}`;
  localStorage.setItem(key, preference);
};

export const getCommandPreference = (commandId: string) => {
  return localStorage.getItem(`command-preference-${commandId}`);
};
```

## Troubleshooting

### Palette Won't Open

**Problem**: Cmd+K / Ctrl+K doesn't open palette

**Solutions**:
- [ ] Check browser console for JavaScript errors
- [ ] Verify component is in DOM: `document.querySelector('.command-palette-modal')`
- [ ] Check if another app is intercepting Cmd+K
- [ ] Try in different browser

### Search Not Working

**Problem**: Typing doesn't filter commands

**Solutions**:
- [ ] Check input element is focused: `document.activeElement`
- [ ] Verify commands have correct keywords
- [ ] Check console for search errors

### Keyboard Navigation Broken

**Problem**: Arrow keys don't navigate

**Solutions**:
- [ ] Ensure palette is open: `state.isOpen === true`
- [ ] Check browser console for event handler errors
- [ ] Verify keyboard event listeners are attached

### Analytics Not Firing

**Problem**: Events not tracked

**Solutions**:
- [ ] Verify `onAnalytics` callback is provided
- [ ] Check backend endpoint is reachable
- [ ] Monitor network tab for API calls
- [ ] Add console.log to handler for debugging

## Performance Optimization

### For 1000+ Commands

```tsx
// Use virtualization - see COMMAND_PALETTE_ADVANCED.md
import { CommandVirtualizer } from './components/CommandVirtualizer';

// Implement useMemo for filtering
const filteredCommands = useMemo(
  () => fuzzySearch(query, commands),
  [query, commands]
);
```

### For Slow Networks

```tsx
// Cache commands
const cachedCommands = useMemo(() => commands, [commands]);

// Debounce search
const debouncedSearch = useCallback(
  debounce((query) => handleQueryChange(query), 300),
  []
);
```

## Common Customizations

### Change Trigger Button Position

Edit `.command-palette-trigger` in `CommandPalette.css`:
```css
.command-palette-trigger {
  bottom: 24px;  /* Vertical position */
  right: 24px;   /* Horizontal position */
}
```

### Change Colors

Edit CSS variables in `CommandPalette.css`:
```css
:root {
  --command-primary-color: #3b82f6;
  --command-bg: #ffffff;
  --command-text: #1f2937;
}
```

### Change Search Placeholder

```tsx
<CommandPalette
  placeholder="Custom placeholder text"
  commands={commands}
/>
```

### Change Max Recent Items

```tsx
<CommandPalette
  maxRecentItems={10}
  commands={commands}
/>
```

## Deployment

### Vercel / Netlify

No special configuration needed. Command Palette works out of the box.

### Self-Hosted

Ensure:
- [ ] TypeScript is compiled to JavaScript
- [ ] CSS is bundled with component
- [ ] No CSP violations blocking inline styles
- [ ] localStorage is available

## Post-Deployment

### Monitor

- [ ] Check error logs for JavaScript errors
- [ ] Monitor analytics for command usage
- [ ] Gather user feedback on discoverability

### Iterate

- [ ] Add new commands based on usage
- [ ] Adjust search keywords for better matching
- [ ] Update command descriptions based on feedback
- [ ] Consider A/B testing different layouts

## Next Steps

1. **Week 1**: Basic integration + testing
2. **Week 2**: Analytics tracking + monitoring
3. **Week 3**: User feedback + refinements
4. **Week 4**: Advanced features (favorites, history, etc.)

## Rollback

If issues occur:

```bash
# Remove component from App.tsx
# Restart dev server
# Command Palette will no longer appear

# To completely remove:
git checkout -- src/components/CommandPalette*
git checkout -- src/hooks/useCommandPalette.ts
```

## Success Criteria

✅ Command Palette opens with Cmd+K / Ctrl+K
✅ Search filters commands correctly
✅ Commands execute when selected
✅ Recent commands are tracked
✅ Analytics events are firing
✅ Mobile interface is responsive
✅ Keyboard navigation works smoothly
✅ No console errors

## Support Resources

- 📖 [Main Documentation](COMMAND_PALETTE_DOCS.md)
- 🚀 [Advanced Usage](COMMAND_PALETTE_ADVANCED.md)
- 📋 [Implementation Summary](COMMAND_PALETTE_IMPLEMENTATION_SUMMARY.md)
- 💬 [Example Component](src/components/CommandPaletteExample.tsx)
- 🧪 [Test Suite](src/components/__tests__/CommandPalette.test.tsx)

## Completion

Once all checks are complete, Command Palette is ready for production! 🎉

Questions? Refer to documentation files or examine test suite for implementation patterns.
