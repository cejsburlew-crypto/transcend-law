# Dark Mode Integration Guide

Quick reference for adding dark mode support to existing components.

## Quick Start

### 1. Use CSS Variables in Your Component CSS

Replace hardcoded colors with CSS variables:

**Before:**
```css
.card {
  background-color: #ffffff;
  color: #1a202c;
  border: 1px solid #e2e8f0;
}

.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
```

**After:**
```css
.card {
  background-color: var(--dm-card-bg);
  color: var(--dm-text-primary);
  border: 1px solid var(--dm-card-border);
}

.card:hover {
  box-shadow: var(--dm-shadow-lg);
}
```

### 2. Update Component Props (Optional)

If you need theme-aware functionality:

```typescript
import { useDarkMode } from '../hooks/useDarkMode';

interface MyComponentProps {
  title: string;
  // ... other props
}

export const MyComponent: React.FC<MyComponentProps> = ({ title, ...props }) => {
  const { isDark } = useDarkMode();

  return (
    <div className={`my-component ${isDark ? 'dark-mode' : ''}`}>
      {title}
    </div>
  );
};
```

### 3. Test Your Component

```bash
# Run tests
npm test

# Check visual appearance in both modes
# - Change OS dark mode setting
# - Use browser dev tools
# - Use DarkModeToggle component
```

## CSS Variable Reference

### Background Colors
```css
var(--dm-bg-primary)      /* #ffffff light / #1a202c dark */
var(--dm-bg-secondary)    /* #f7fafc light / #2d3748 dark */
var(--dm-bg-tertiary)     /* #eeeeee light / #4a5568 dark */
```

### Text Colors
```css
var(--dm-text-primary)    /* #1a202c light / #e2e8f0 dark */
var(--dm-text-secondary)  /* #718096 light / #a0aec0 dark */
var(--dm-text-tertiary)   /* #a0aec0 light / #718096 dark */
```

### Component-Specific Colors

**Buttons:**
```css
var(--dm-button-bg)       /* Button background */
var(--dm-button-hover)    /* Button hover state */
var(--dm-button-text)     /* Button text color */
```

**Cards:**
```css
var(--dm-card-bg)         /* Card background */
var(--dm-card-border)     /* Card border color */
```

**Forms:**
```css
var(--dm-input-bg)        /* Input background */
var(--dm-input-border)    /* Input border */
var(--dm-input-text)      /* Input text color */
```

**Navigation:**
```css
var(--dm-menu-bg)         /* Menu/nav background */
var(--dm-menu-item-hover) /* Menu item hover state */
```

**Status & Feedback:**
```css
var(--dm-badge-bg)        /* Badge background */
var(--dm-badge-text)      /* Badge text */
var(--dm-success-light)   /* Success state background */
var(--dm-warning-light)   /* Warning state background */
var(--dm-error-light)     /* Error state background */
var(--dm-info-light)      /* Info state background */
```

**Other:**
```css
var(--dm-border)          /* Border color */
var(--dm-border-light)    /* Light border */
var(--dm-shadow-sm)       /* Small shadow */
var(--dm-shadow-md)       /* Medium shadow */
var(--dm-shadow-lg)       /* Large shadow */
var(--dm-link)            /* Link color */
var(--dm-link-hover)      /* Link hover color */
var(--dm-code-bg)         /* Code background */
var(--dm-code-text)       /* Code text color */
var(--dm-disabled-bg)     /* Disabled background */
var(--dm-disabled-text)   /* Disabled text */
```

## Common Patterns

### Pattern 1: Text Content
```css
p, span, label {
  color: var(--dm-text-primary);
}

.secondary-text {
  color: var(--dm-text-secondary);
}

.tertiary-text {
  color: var(--dm-text-tertiary);
}
```

### Pattern 2: Cards and Containers
```css
.card, .container {
  background-color: var(--dm-card-bg);
  border: 1px solid var(--dm-card-border);
  box-shadow: var(--dm-shadow-md);
}

.card:hover {
  box-shadow: var(--dm-shadow-lg);
}
```

### Pattern 3: Form Inputs
```css
input, textarea, select {
  background-color: var(--dm-input-bg);
  color: var(--dm-input-text);
  border: 1px solid var(--dm-input-border);
}

input:focus {
  border-color: var(--dm-button-bg);
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}
```

### Pattern 4: Buttons
```css
.btn {
  background-color: var(--dm-button-bg);
  color: var(--dm-button-text);
}

.btn:hover {
  background-color: var(--dm-button-hover);
}

.btn:disabled {
  background-color: var(--dm-disabled-bg);
  color: var(--dm-disabled-text);
}
```

### Pattern 5: Status Badges
```css
.badge-success {
  background-color: var(--dm-success-light);
}

.badge-warning {
  background-color: var(--dm-warning-light);
}

.badge-error {
  background-color: var(--dm-error-light);
}
```

## Component Checklist

### Before Adding Dark Mode
- [ ] Component CSS uses hardcoded colors
- [ ] No theme awareness needed
- [ ] Styles are in a separate CSS file

### Integration Steps
1. [ ] Identify all color properties in component CSS
2. [ ] Replace with appropriate `--dm-*` variable
3. [ ] Test in light mode
4. [ ] Test in dark mode
5. [ ] Test system preference changes
6. [ ] Verify transitions are smooth
7. [ ] Check contrast ratios (WCAG AA)
8. [ ] Update component documentation

## Example: Converting a Component

### Original Component
```typescript
// MyCard.tsx
import React from 'react';
import './MyCard.css';

interface MyCardProps {
  title: string;
  description: string;
}

export const MyCard: React.FC<MyCardProps> = ({ title, description }) => {
  return (
    <div className="my-card">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
};
```

```css
/* MyCard.css */
.my-card {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.my-card h3 {
  color: #1a202c;
  margin: 0 0 8px 0;
}

.my-card p {
  color: #718096;
  margin: 0;
}

.my-card:hover {
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}
```

### Updated Component (With Dark Mode)
```typescript
// MyCard.tsx
import React from 'react';
import './MyCard.css';

interface MyCardProps {
  title: string;
  description: string;
}

export const MyCard: React.FC<MyCardProps> = ({ title, description }) => {
  return (
    <div className="my-card">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
};
```

```css
/* MyCard.css */
.my-card {
  background-color: var(--dm-card-bg);
  border: 1px solid var(--dm-card-border);
  border-radius: 8px;
  padding: 16px;
  box-shadow: var(--dm-shadow-md);
  transition: box-shadow var(--dm-transition) var(--dm-easing);
}

.my-card h3 {
  color: var(--dm-text-primary);
  margin: 0 0 8px 0;
}

.my-card p {
  color: var(--dm-text-secondary);
  margin: 0;
}

.my-card:hover {
  box-shadow: var(--dm-shadow-lg);
}
```

## Using Images in Dark Mode

### Method 1: Different Images
```typescript
import { useDarkMode } from '../hooks/useDarkMode';

export const MyComponent = () => {
  const { isDark } = useDarkMode();

  return (
    <img
      src={isDark ? '/images/logo-dark.png' : '/images/logo-light.png'}
      alt="Logo"
    />
  );
};
```

### Method 2: CSS Filter
```css
.logo {
  width: 200px;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .logo {
    filter: invert(1) brightness(1.1);
  }
}

:root[data-theme="dark"] .logo {
  filter: invert(1) brightness(1.1);
}
```

### Method 3: SVG Fill
```typescript
export const MyIcon = () => {
  return (
    <svg width="24" height="24" fill="currentColor">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
};
```

```css
.my-icon {
  color: var(--dm-text-primary);
}
```

## Testing Dark Mode

### Manual Testing Checklist
- [ ] All text is readable in both modes
- [ ] Contrast ratio is WCAG AA compliant
- [ ] Buttons and interactive elements are visible
- [ ] Images render correctly
- [ ] No layout shifts on theme change
- [ ] Transitions are smooth
- [ ] System preference is respected
- [ ] Theme persists after page reload
- [ ] Works on mobile (iPhone, Android)
- [ ] Print preview looks correct

### Automated Testing
```typescript
import { render, screen } from '@testing-library/react';
import { DarkModeProvider } from '../context/DarkModeContext';

test('component displays correctly in dark mode', () => {
  // Set dark mode
  document.documentElement.setAttribute('data-theme', 'dark');

  render(
    <DarkModeProvider>
      <MyComponent />
    </DarkModeProvider>
  );

  // Assert visibility and styling
  const element = screen.getByRole('heading');
  const computed = window.getComputedStyle(element);
  
  expect(computed.color).not.toBe('#1a202c'); // Should not be light mode color
});
```

## Accessibility Considerations

### Contrast Ratios
- Text on background: 4.5:1 minimum (WCAG AA)
- Large text (18pt+): 3:1 minimum
- UI components: 3:1 minimum

### Color Independence
Don't use color alone to convey information:

```css
/* ❌ Bad - Color only */
.status-success {
  color: #2ecc71;
}

/* ✅ Good - Color + icon */
.status-success::before {
  content: '✓ ';
  color: #2ecc71;
}
```

### Focus Indicators
```css
:focus-visible {
  outline: 2px solid var(--dm-link);
  outline-offset: 2px;
}
```

## Common Issues

### Issue: Colors not changing
**Solution:** Verify you're using CSS variables, not hardcoded colors
```css
/* ❌ Wrong */
.card { background-color: #ffffff; }

/* ✅ Correct */
.card { background-color: var(--dm-card-bg); }
```

### Issue: Transitions too slow/fast
**Solution:** Adjust the transition duration
```css
:root {
  --dm-transition: 200ms; /* Faster transitions */
}
```

### Issue: Component looks bad in dark mode
**Solution:** Use appropriate color variables
```css
/* ❌ Wrong */
.text { color: var(--dm-button-bg); }

/* ✅ Correct */
.text { color: var(--dm-text-primary); }
```

### Issue: Images are invisible in dark mode
**Solution:** Use CSS filter or different image source
```css
/* For light icons on dark background */
img.icon {
  filter: invert(1);
}
```

## Performance Tips

1. **Avoid re-renders**: Use `useDarkMode` hook selectively
2. **Batch CSS changes**: Use CSS variables instead of individual properties
3. **Use CSS transitions**: Faster than JavaScript animations
4. **Lazy load theme-specific images**: Load only when needed
5. **Minimize media queries**: Group dark mode styles efficiently

## Version Compatibility

- React: 16.8+ (hooks required)
- TypeScript: 4.0+
- CSS: Modern browsers (see Browser Support section)
- Node: 12+

## Additional Resources

- [DARK_MODE_IMPLEMENTATION.md](./DARK_MODE_IMPLEMENTATION.md) - Full implementation details
- [MDN: prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [WCAG Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Color Accessibility](https://www.color-blindness.com/)

## Quick Reference: CSS Variables

```css
/* Light backgrounds */
--dm-bg-primary         /* Main background */
--dm-bg-secondary       /* Secondary background */
--dm-bg-tertiary        /* Tertiary background */

/* Dark backgrounds */
(Same variables, dark values in dark mode)

/* Text */
--dm-text-primary       /* Primary text */
--dm-text-secondary     /* Secondary text */
--dm-text-tertiary      /* Tertiary text */

/* Components */
--dm-button-bg          /* Button background */
--dm-card-bg            /* Card background */
--dm-input-bg           /* Input background */
--dm-menu-bg            /* Menu background */

/* States */
--dm-success-light      /* Success state */
--dm-warning-light      /* Warning state */
--dm-error-light        /* Error state */
--dm-info-light         /* Info state */

/* Effects */
--dm-shadow-sm          /* Small shadow */
--dm-shadow-md          /* Medium shadow */
--dm-shadow-lg          /* Large shadow */
--dm-border             /* Border color */

/* Other */
--dm-link               /* Link color */
--dm-code-bg            /* Code background */
--dm-disabled-bg        /* Disabled state */
```
