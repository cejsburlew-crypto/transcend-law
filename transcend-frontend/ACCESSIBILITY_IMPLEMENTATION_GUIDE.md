# Accessibility Implementation Guide

## Quick Start

### Step 1: Install & Import Tools

```tsx
// In your component
import {
  useAccessibility,
  useFocusTrap,
  useFormField,
  useAnnouncement,
  useAccessibleDropdown,
  useAccessibleTabs,
  useAccessibleModal,
  useKeyboardNavigation,
} from '../hooks/useAccessibility';

import {
  generateId,
  getContrastRatio,
  trapFocus,
  announceToScreenReader,
} from '../accessibility/utils';

import { AccessibilityChecks } from '../components/AccessibilityChecks';
import { accessibilityAudit, ComponentAuditResult } from '../accessibility/audit';
```

### Step 2: Use in Components

```tsx
// Example: Accessible Button
const MyButton = ({ onClick, label, icon }) => {
  return (
    <button
      onClick={onClick}
      aria-label={icon ? label : undefined}
      className="my-button"
    >
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
    </button>
  );
};

// Example: Accessible Form Field
const MyForm = () => {
  const emailField = useFormField('email');
  const { fieldProps, error, setError, errorId } = emailField;

  return (
    <div>
      <label htmlFor={emailField.fieldId}>
        Email <span aria-label="required">*</span>
      </label>
      <input
        {...fieldProps}
        type="email"
        required
        onChange={(e) => {
          if (!e.target.value.includes('@')) {
            setError('Please enter a valid email');
          } else {
            setError(null);
          }
        }}
      />
      {error && <div id={errorId}>{error}</div>}
    </div>
  );
};

// Example: Accessible Modal
const MyModal = ({ isOpen, onClose }) => {
  const modal = useAccessibleModal(onClose);

  if (!isOpen) return null;

  return (
    <div
      {...modal.dialogProps}
      aria-labelledby="modal-title"
      onClick={modal.handleBackdropClick}
      onKeyDown={modal.handleKeyDown}
      ref={modal.modalRef}
    >
      <h2 id="modal-title">Important Action</h2>
      <p>Are you sure?</p>
      <button onClick={onClose}>Cancel</button>
      <button onClick={onClose}>Confirm</button>
    </div>
  );
};
```

---

## Common Fixes by Category

### 1. ARIA Labels & Semantic HTML

#### Problem: Icon Button with No Label
```jsx
// ❌ Bad
<button className="icon-btn">×</button>

// ✓ Good
<button className="icon-btn" aria-label="Close dialog">×</button>
```

#### Problem: Missing Form Label
```jsx
// ❌ Bad
<input type="email" placeholder="Email" />

// ✓ Good
<label htmlFor="email">Email</label>
<input id="email" type="email" />
```

#### Problem: Image with No Alt Text
```jsx
// ❌ Bad
<img src="chart.png" />

// ✓ Good
<img src="chart.png" alt="Sales chart showing revenue growth" />
```

---

### 2. Keyboard Navigation

#### Problem: Click-Only Button
```jsx
// ❌ Bad
<div onClick={handleClick}>Action</div>

// ✓ Good Option 1: Use semantic button
<button onClick={handleClick}>Action</button>

// ✓ Good Option 2: Add keyboard handler to div
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyPress={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleClick();
    }
  }}
>
  Action
</div>
```

#### Problem: Modal Keyboard Trap
```jsx
// ❌ Bad - focus can escape modal
<div role="dialog">
  <button>Cancel</button>
  <button>Save</button>
</div>

// ✓ Good - focus trapped with Escape support
const ModalWithTrap = ({ onClose }) => {
  const modalRef = useFocusTrap(true);
  
  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <button>Cancel</button>
      <button>Save</button>
    </div>
  );
};
```

#### Problem: Dropdown Not Keyboard Accessible
```jsx
// ❌ Bad
<select onChange={handleChange}>
  <option>Option 1</option>
  <option>Option 2</option>
</select>

// ✓ Already good! <select> is keyboard accessible by default
// But if you're building a custom dropdown:

const CustomDropdown = () => {
  const dropdown = useAccessibleDropdown();
  
  return (
    <div {...dropdown.dropdownProps} ref={dropdown.containerRef}>
      <button {...dropdown.triggerProps} ref={dropdown.trigger}>
        Select option
      </button>
      {dropdown.isOpen && (
        <div role="listbox">
          {options.map((opt, idx) => (
            <div
              key={opt}
              role="option"
              onClick={() => dropdown.handleSelect(idx)}
              onKeyDown={(e) => dropdown.handleKeyDown(e)}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

### 3. Color Contrast

#### Problem: Insufficient Contrast
```jsx
// ❌ Bad - 2.5:1 contrast (need 4.5:1 for AA)
<span style={{ color: '#999', background: 'white' }}>
  Light text on white
</span>

// ✓ Good - 4.5:1 contrast
<span style={{ color: '#666', background: 'white' }}>
  Better contrast text
</span>

// Check contrast programmatically
import { getContrastRatio, meetsContrastStandard } from '../accessibility/utils';

const ratio = getContrastRatio('#999', 'white'); // 2.5
const passes = meetsContrastStandard('#666', 'white'); // true
```

#### CSS for Better Contrast
```css
/* Text colors with sufficient contrast */
.text-dark {
  color: #212121; /* 18:1 on white ✓ */
}

.text-medium {
  color: #666666; /* 6.8:1 on white ✓ */
}

.text-warning {
  color: #d84315; /* 4.5:1 on white ✓ */
}

/* Ensure focus indicators have contrast */
:focus-visible {
  outline: 3px solid #4a90e2;
  outline-offset: 2px;
}

/* Buttons with sufficient contrast */
.btn-primary {
  background: #4a90e2; /* 4.5:1 white text on this ✓ */
  color: white;
}

.btn-secondary {
  background: white;
  color: #4a90e2;
  border: 2px solid #4a90e2; /* 5.9:1 contrast ✓ */
}
```

---

### 4. Focus Management

#### Problem: No Focus Indicator
```jsx
// ❌ Bad
.button {
  outline: none; /* Never remove focus outline! */
}

// ✓ Good
.button:focus-visible {
  outline: 3px solid #4a90e2;
  outline-offset: 2px;
}

.button:focus {
  box-shadow: inset 0 0 0 3px rgba(74, 144, 226, 0.25);
}
```

#### Problem: Focus Lost After Action
```jsx
// ❌ Bad - focus lost when modal closes
const handleClose = () => {
  setModalOpen(false);
};

// ✓ Good - focus restored
const ModalWrapper = ({ isOpen, onClose }) => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useFocusTrap(isOpen);

  useEffect(() => {
    if (!isOpen && triggerRef.current) {
      // Wait for modal to unmount then restore focus
      setTimeout(() => triggerRef.current?.focus(), 0);
    }
  }, [isOpen]);

  return (
    <>
      <button ref={triggerRef} onClick={() => setModalOpen(true)}>
        Open
      </button>
      {isOpen && (
        <div ref={modalRef} role="dialog">
          {/* Modal content */}
        </div>
      )}
    </>
  );
};
```

---

### 5. Form Labels & Error Messages

#### Problem: No Error Message
```jsx
// ❌ Bad
<input type="email" value={email} onChange={setEmail} />
{isInvalid && <input style={{ borderColor: 'red' }} />}

// ✓ Good
const EmailField = () => {
  const field = useFormField('email');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <label htmlFor={field.fieldId}>
        Email <span aria-label="required">*</span>
      </label>
      <input
        {...field.fieldProps}
        id={field.fieldId}
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onBlur={() => {
          if (!email.includes('@')) {
            field.setError('Please enter a valid email');
          } else {
            field.setError(null);
          }
        }}
      />
      {error && (
        <div id={field.errorId} role="alert" className="error-text">
          {error}
        </div>
      )}
    </div>
  );
};
```

#### Problem: Required Fields Not Marked
```jsx
// ❌ Bad - HTML required but no visual indicator
<label>Email</label>
<input type="email" required />

// ✓ Good - Clear visual and semantic markers
<label>
  Email <span aria-label="required">*</span>
</label>
<input type="email" required aria-required="true" />
```

---

### 6. Media & Images

#### Problem: Image with No Alt Text
```jsx
// ❌ Bad
<img src="user.png" />
<img src="chart.png" alt="chart" />

// ✓ Good
<img src="user.png" alt="Profile photo for John Smith" />
<img 
  src="chart.png" 
  alt="Revenue by quarter: Q1 $1M, Q2 $1.2M, Q3 $1.5M, Q4 $2M"
/>

// Decorative images
<img src="decorative.png" alt="" role="presentation" />
```

#### Problem: Video with No Captions
```jsx
// ❌ Bad
<video controls>
  <source src="tutorial.mp4" type="video/mp4" />
</video>

// ✓ Good
<video 
  controls 
  aria-label="Platform tutorial video"
>
  <source src="tutorial.mp4" type="video/mp4" />
  <track
    kind="captions"
    src="tutorial-captions.vtt"
    srclang="en"
    label="English"
  />
  <track
    kind="descriptions"
    src="tutorial-descriptions.vtt"
    srclang="en"
    label="English (audio description)"
  />
  Your browser doesn't support HTML5 video.
</video>
```

---

### 7. Semantic HTML

#### Problem: Non-Semantic Button
```jsx
// ❌ Bad
<div onClick={handleClick}>Click me</div>

// ✓ Good
<button onClick={handleClick}>Click me</button>
```

#### Problem: Broken Heading Hierarchy
```jsx
// ❌ Bad - skips h2
<h1>Main Title</h1>
<h3>Section</h3>

// ✓ Good - sequential
<h1>Main Title</h1>
<h2>Section</h2>
<h3>Subsection</h3>
```

#### Problem: Non-Semantic List
```jsx
// ❌ Bad
<div role="list">
  <div role="listitem">Item 1</div>
  <div role="listitem">Item 2</div>
</div>

// ✓ Good
<ul>
  <li>Item 1</li>
  <li>Item 2</li>
</ul>
```

---

## Testing Your Implementation

### Manual Keyboard Testing

```bash
# 1. Navigate with Tab key
# - All interactive elements should be reachable
# - Tab order should be logical (left-to-right, top-to-bottom)
# - No focus traps (focus can escape any element)

# 2. Test with arrow keys
# - Dropdowns: Arrow keys navigate options
# - Accordion: Arrow keys navigate items
# - Tabs: Arrow keys switch tabs

# 3. Test with Escape
# - Modals close
# - Dropdowns close
# - Overlays dismiss

# 4. Test Enter/Space
# - Buttons activate
# - Links open
# - Checkboxes toggle
# - Dropdowns open/select
```

### Screen Reader Testing

```bash
# macOS - VoiceOver (Cmd+F5)
# 1. Navigate with VO+Arrow keys
# 2. Verify announcements
# 3. Test form fields
# 4. Check image alt text

# Windows - NVDA (free)
# 1. Download NVDA
# 2. Start NVDA
# 3. Navigate with arrow keys
# 4. Verify all elements are announced

# NVDA Common Commands:
# Insert+Arrow Up/Down - Read page
# Insert+H - List headings
# Insert+F - List form fields
# Insert+G - List graphics
# Insert+L - List links
# Insert+T - List tables
```

### Automated Testing

```bash
# Run accessibility tests
npm test -- --coverage

# Test with axe DevTools
# 1. Open Chrome DevTools
# 2. Go to "Accessibility" tab
# 3. Run scan
# 4. Review findings

# Test contrast with WebAIM
# https://webaim.org/resources/contrastchecker/

# Test with Lighthouse
# 1. Open Chrome DevTools
# 2. Click "Lighthouse"
# 3. Run accessibility audit
# 4. Review report
```

---

## Component Implementation Checklist

### Every Component Should Have:

- [ ] **Semantic HTML**
  - [ ] Buttons are `<button>` elements
  - [ ] Links are `<a>` elements
  - [ ] Forms use `<label>`, `<input>`, etc.
  - [ ] Lists use `<ul>`, `<ol>`, `<li>`

- [ ] **ARIA Labels**
  - [ ] All buttons have text or `aria-label`
  - [ ] All form inputs have labels
  - [ ] All images have `alt` text
  - [ ] Complex widgets have roles (`dialog`, `menu`, etc.)

- [ ] **Keyboard Navigation**
  - [ ] All functionality accessible via keyboard
  - [ ] No keyboard traps
  - [ ] Logical tab order
  - [ ] Escape closes modals

- [ ] **Focus Management**
  - [ ] Focus visible on all interactive elements
  - [ ] Focus indicator has 3:1 contrast
  - [ ] Focus order is logical
  - [ ] Focus trapped in modals

- [ ] **Color Contrast**
  - [ ] Normal text: 4.5:1
  - [ ] Large text: 3:1
  - [ ] UI components: 3:1
  - [ ] Focus indicators: 3:1

- [ ] **Error Handling**
  - [ ] Form errors linked to fields
  - [ ] Error messages announced
  - [ ] Error state visible
  - [ ] Error messages clear

---

## Running the Audit

### In Your Component

```tsx
import { AccessibilityChecks } from '../components/AccessibilityChecks';

export const MyPage = () => {
  const componentRefs = new Map<string, HTMLElement>();

  return (
    <div>
      <AccessibilityChecks
        components={componentRefs}
        autoRunAudit={true}
        showSummaryOnly={false}
      />
    </div>
  );
};
```

### Programmatically

```tsx
import { accessibilityAudit } from '../accessibility/audit';

const runAudit = async () => {
  const components = new Map<string, HTMLElement>();
  
  // Add your components
  const element = document.querySelector('.my-component') as HTMLElement;
  if (element) {
    components.set('MyComponent', element);
  }

  // Run audit
  const results = await accessibilityAudit.auditAllComponents(components);
  
  // Handle results
  console.log(`Total issues: ${results.totalIssues}`);
  console.log(`Average score: ${results.averageScore}/100`);
  
  results.componentResults.forEach((result) => {
    console.log(`${result.componentName}: ${result.score}/100`);
    result.issues.forEach((issue) => {
      console.log(`  - [${issue.severity}] ${issue.title}`);
      console.log(`    ${issue.description}`);
      console.log(`    Fix: ${issue.fix}`);
    });
  });
};
```

---

## Resources

### Tools
- [axe DevTools](https://www.deque.com/axe/devtools/) - Chrome extension
- [WAVE](https://wave.webaim.org/) - Web accessibility evaluation tool
- [NVDA](https://www.nvaccess.org/) - Free screen reader for Windows
- [VoiceOver](https://www.apple.com/accessibility/voiceover/) - Built into macOS
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### Learning
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [WebAIM Guides](https://webaim.org/)
- [A11y Project](https://www.a11yproject.com/)
- [Accessible Design Guide](https://www.designforall.org/design-for-all-resources/)

### React-Specific
- [React Accessibility](https://reactjs.org/docs/accessibility.html)
- [A11y React Library](https://www.a11y-101.com/design/react-a11y)
- [Reach UI Components](https://reach.tech/) - Accessible components

---

## Migration Path

### Phase 1 (Week 1): Critical Fixes
- [x] Add ARIA labels to all buttons
- [x] Add alt text to all images
- [x] Add focus indicators
- [x] Fix form labels

### Phase 2 (Week 2): Important Fixes
- [x] Keyboard navigation
- [x] Modal focus trap
- [x] Color contrast
- [x] Error messages

### Phase 3 (Week 3): Enhancements
- [x] Skip links
- [x] Video captions
- [x] ARIA live regions
- [x] Audio descriptions

### Ongoing
- [ ] Test with keyboard monthly
- [ ] Test with screen reader quarterly
- [ ] Run automated audits in CI/CD
- [ ] Review new components for a11y

---

## Questions? Issues?

1. Check the [ACCESSIBILITY_AUDIT_REPORT.md](./ACCESSIBILITY_AUDIT_REPORT.md) for detailed findings
2. Review component examples in this guide
3. Test locally using the AccessibilityChecks component
4. Run automated tests to identify remaining issues

For more help:
- WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
- A11y Project: https://www.a11yproject.com/
- WebAIM: https://webaim.org/
