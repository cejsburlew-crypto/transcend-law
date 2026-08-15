# Keyboard Shortcuts - Implementation Examples

## Quick Start

### 1. Setup App.tsx

```typescript
import React from 'react';
import { KeyboardShortcutsProvider } from './components/KeyboardShortcutsProvider';
import { Dashboard } from './pages/Dashboard';

function App() {
  return (
    <KeyboardShortcutsProvider
      onSearch={() => {
        // Open search modal/component
        console.log('Search triggered');
      }}
      onHelp={() => {
        // Optional: log help open
        console.log('Help modal opened');
      }}
    >
      <Dashboard />
    </KeyboardShortcutsProvider>
  );
}

export default App;
```

### 2. Register Shortcuts in Dashboard

```typescript
import React from 'react';
import { useRegisterShortcuts } from '../components/KeyboardShortcutsProvider';
import { KeyboardShortcut } from '../hooks/useKeyboardShortcuts';

export const Dashboard: React.FC = () => {
  const [selectedCase, setSelectedCase] = React.useState<string | null>(null);

  // Define page shortcuts
  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'n',
      description: 'Create new case',
      category: 'Cases',
      callback: () => {
        console.log('Creating new case');
        // Navigate to create case page
      },
    },
    {
      key: 'e',
      description: 'Edit selected case',
      category: 'Cases',
      callback: () => {
        if (selectedCase) {
          console.log('Editing case:', selectedCase);
          // Navigate to edit page
        }
      },
      enabled: selectedCase !== null, // Only enabled when case is selected
    },
    {
      key: 'd',
      description: 'Delete selected case',
      category: 'Cases',
      callback: () => {
        if (selectedCase) {
          console.log('Deleting case:', selectedCase);
          // Show confirmation and delete
        }
      },
      enabled: selectedCase !== null,
    },
    {
      key: 'r',
      description: 'Refresh cases',
      category: 'Cases',
      callback: () => {
        console.log('Refreshing cases');
        // Fetch fresh data
      },
    },
  ];

  // Register shortcuts (auto-cleanup on unmount)
  useRegisterShortcuts(shortcuts);

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      <p>Press ? to see keyboard shortcuts</p>
      {/* Your component content */}
    </div>
  );
};
```

### 3. With Search Component

```typescript
import React, { useState } from 'react';
import { useKeyboardShortcutsContext } from '../components/KeyboardShortcutsProvider';

export const SearchComponent: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { registerShortcuts } = useKeyboardShortcutsContext();

  React.useEffect(() => {
    const cleanup = registerShortcuts([
      {
        key: ['Cmd', 'K'],
        description: 'Open search',
        category: 'Global',
        callback: () => setIsOpen(!isOpen),
        enabled: true,
      },
    ]);

    return cleanup;
  }, [isOpen, registerShortcuts]);

  return (
    <>
      {isOpen && (
        <div className="search-modal">
          <input
            type="text"
            placeholder="Search..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsOpen(false);
              }
            }}
          />
        </div>
      )}
    </>
  );
};
```

### 4. Advanced: List Navigation with Vim Keys

```typescript
import React, { useState } from 'react';
import { useRegisterShortcuts } from '../components/KeyboardShortcutsProvider';
import { KeyboardShortcut } from '../hooks/useKeyboardShortcuts';

interface Item {
  id: string;
  name: string;
}

export const ListComponent: React.FC<{ items: Item[] }> = ({ items }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [enableVim, setEnableVim] = useState(false);

  const shortcuts: KeyboardShortcut[] = [
    // Standard navigation
    {
      key: 'ArrowDown',
      description: 'Next item',
      category: 'Navigation',
      callback: () => {
        setSelectedIndex(i => Math.min(i + 1, items.length - 1));
      },
    },
    {
      key: 'ArrowUp',
      description: 'Previous item',
      category: 'Navigation',
      callback: () => {
        setSelectedIndex(i => Math.max(i - 1, 0));
      },
    },
    {
      key: 'Enter',
      description: 'Select item',
      category: 'Navigation',
      callback: () => {
        console.log('Selected:', items[selectedIndex]);
      },
    },

    // Vim navigation (optional)
    {
      key: 'j',
      description: 'Move down (Vim)',
      category: 'Navigation',
      callback: () => {
        setSelectedIndex(i => Math.min(i + 1, items.length - 1));
      },
      enabled: enableVim,
    },
    {
      key: 'k',
      description: 'Move up (Vim)',
      category: 'Navigation',
      callback: () => {
        setSelectedIndex(i => Math.max(i - 1, 0));
      },
      enabled: enableVim,
    },
    {
      key: 'h',
      description: 'Move left (Vim)',
      category: 'Navigation',
      callback: () => {
        console.log('Move left');
      },
      enabled: enableVim,
    },
    {
      key: 'l',
      description: 'Move right (Vim)',
      category: 'Navigation',
      callback: () => {
        console.log('Move right');
      },
      enabled: enableVim,
    },

    // Toggle Vim mode
    {
      key: 'v',
      description: 'Toggle Vim mode',
      category: 'Navigation',
      callback: () => {
        setEnableVim(!enableVim);
      },
    },
  ];

  useRegisterShortcuts(shortcuts);

  return (
    <div className="list">
      <div className="list-header">
        <h2>Items</h2>
        <span className={`vim-mode ${enableVim ? 'active' : ''}`}>
          Vim Mode: {enableVim ? 'ON' : 'OFF'}
        </span>
      </div>
      <div className="list-items">
        {items.map((item, index) => (
          <div
            key={item.id}
            className={`list-item ${index === selectedIndex ? 'selected' : ''}`}
          >
            {item.name}
          </div>
        ))}
      </div>
    </div>
  );
};
```

### 5. Form with Keyboard Submit

```typescript
import React, { useState } from 'react';
import { useRegisterShortcuts } from '../components/KeyboardShortcutsProvider';

export const FormComponent: React.FC = () => {
  const [formData, setFormData] = useState({ name: '', email: '' });

  const shortcuts = [
    {
      key: ['Cmd', 'Enter'],
      description: 'Submit form',
      category: 'Form',
      callback: () => {
        console.log('Submitting form:', formData);
        // handleSubmit()
      },
      preventDefault: true,
    },
    {
      key: ['Cmd', 'S'],
      description: 'Save draft',
      category: 'Form',
      callback: () => {
        console.log('Saving draft');
        // saveDraft()
      },
    },
  ];

  useRegisterShortcuts(shortcuts);

  return (
    <form>
      <input
        type="text"
        placeholder="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
      />
      <button type="submit">
        Submit (Cmd+Enter)
      </button>
    </form>
  );
};
```

### 6. Conditional Shortcuts

```typescript
import React, { useState } from 'react';
import { useRegisterShortcuts } from '../components/KeyboardShortcutsProvider';
import { KeyboardShortcut } from '../hooks/useKeyboardShortcuts';

export const ConditionalComponent: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  const shortcuts: KeyboardShortcut[] = [
    {
      key: 'e',
      description: 'Edit',
      category: 'Actions',
      callback: () => setIsEditing(true),
      enabled: !isEditing,
    },
    {
      key: 'Escape',
      description: 'Cancel editing',
      category: 'Actions',
      callback: () => setIsEditing(false),
      enabled: isEditing,
    },
    {
      key: ['Shift', 'Delete'],
      description: 'Delete (with confirmation)',
      category: 'Actions',
      callback: () => {
        if (canDelete && window.confirm('Are you sure?')) {
          // delete()
        }
      },
      enabled: canDelete,
    },
  ];

  useRegisterShortcuts(shortcuts);

  return (
    <div>
      {isEditing ? (
        <input type="text" defaultValue="Editing..." />
      ) : (
        <p>Not editing</p>
      )}
      <label>
        <input
          type="checkbox"
          checked={canDelete}
          onChange={(e) => setCanDelete(e.target.checked)}
        />
        Enable delete shortcut
      </label>
    </div>
  );
};
```

## Complete Example: Attorney Case Management

```typescript
import React, { useState } from 'react';
import { useRegisterShortcuts } from '../components/KeyboardShortcutsProvider';
import { KeyboardShortcut } from '../hooks/useKeyboardShortcuts';

interface Case {
  id: string;
  name: string;
  status: 'active' | 'pending' | 'closed';
}

export const CaseManagement: React.FC = () => {
  const [cases, setCases] = useState<Case[]>([
    { id: '1', name: 'Case 1', status: 'active' },
    { id: '2', name: 'Case 2', status: 'pending' },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'status'>('name');

  const selectedCase = cases.find(c => c.id === selectedId);

  const shortcuts: KeyboardShortcut[] = [
    // Case management
    {
      key: 'n',
      description: 'New case',
      category: 'Cases',
      callback: () => setShowCreateForm(true),
    },
    {
      key: 'Enter',
      description: 'View case',
      category: 'Cases',
      callback: () => selectedCase && console.log('View:', selectedCase),
      enabled: selectedCase !== undefined,
    },
    {
      key: 'e',
      description: 'Edit case',
      category: 'Cases',
      callback: () => selectedCase && console.log('Edit:', selectedCase),
      enabled: selectedCase !== undefined && selectedCase.status !== 'closed',
    },
    {
      key: ['Shift', 'Delete'],
      description: 'Delete case',
      category: 'Cases',
      callback: () => {
        if (selectedId && window.confirm('Delete this case?')) {
          setCases(cases.filter(c => c.id !== selectedId));
          setSelectedId(null);
        }
      },
      enabled: selectedCase !== undefined && selectedCase.status !== 'closed',
    },

    // Navigation
    {
      key: 'ArrowDown',
      description: 'Next case',
      category: 'Navigation',
      callback: () => {
        const idx = cases.findIndex(c => c.id === selectedId);
        if (idx < cases.length - 1) {
          setSelectedId(cases[idx + 1].id);
        }
      },
    },
    {
      key: 'ArrowUp',
      description: 'Previous case',
      category: 'Navigation',
      callback: () => {
        const idx = cases.findIndex(c => c.id === selectedId);
        if (idx > 0) {
          setSelectedId(cases[idx - 1].id);
        }
      },
    },

    // Filtering
    {
      key: 's',
      description: 'Sort by status',
      category: 'Filtering',
      callback: () => setSortBy('status'),
    },
    {
      key: 'a',
      description: 'Sort alphabetically',
      category: 'Filtering',
      callback: () => setSortBy('name'),
    },

    // Forms
    {
      key: ['Cmd', 'Enter'],
      description: 'Save and close',
      category: 'Forms',
      callback: () => {
        setShowCreateForm(false);
        // saveCaseForm()
      },
      enabled: showCreateForm,
    },
  ];

  useRegisterShortcuts(shortcuts);

  return (
    <div className="case-management">
      <h1>Cases</h1>
      <div className="cases-list">
        {cases.map(caseItem => (
          <div
            key={caseItem.id}
            className={`case-item ${selectedId === caseItem.id ? 'selected' : ''}`}
            onClick={() => setSelectedId(caseItem.id)}
          >
            <strong>{caseItem.name}</strong>
            <span className={`status ${caseItem.status}`}>{caseItem.status}</span>
          </div>
        ))}
      </div>

      {showCreateForm && (
        <div className="create-form">
          <h2>Create New Case</h2>
          <input type="text" placeholder="Case name..." />
          <p>Press Cmd+Enter to save</p>
        </div>
      )}

      <div className="keyboard-help">
        <p>Press ? for keyboard shortcuts</p>
      </div>
    </div>
  );
};
```

## Tips & Best Practices

### 1. Always Provide Fallback UI
```typescript
<button onClick={() => handleAction()}>
  Action (Press 'a')
</button>
```

### 2. Handle Loading/Disabled States
```typescript
{
  key: 's',
  description: 'Save',
  callback: () => { /* ... */ },
  enabled: !isLoading && !isDisabled,
}
```

### 3. Provide User Feedback
```typescript
{
  key: 'Enter',
  description: 'Submit',
  callback: (event) => {
    console.log('Shortcut triggered');
    showToast('Action completed with keyboard shortcut');
  },
}
```

### 4. Test on Different Platforms
- Test on Mac with Cmd key
- Test on Windows with Ctrl key
- Test on Linux with Ctrl key

### 5. Document All Shortcuts
- Always include `description` field
- Set `category` for organization
- Keep descriptions short and clear

## Debugging

To debug keyboard shortcuts:

```typescript
// Log all shortcuts being registered
useEffect(() => {
  const allShortcuts = getActiveShortcuts();
  console.table(allShortcuts.map(s => ({
    Key: formatKeyCombo(s.key),
    Description: s.description,
    Category: s.category,
  })));
}, []);

// Log keyboard events
const handleKeyDown = (e: KeyboardEvent) => {
  console.log('Key pressed:', {
    key: e.key,
    code: e.code,
    ctrl: e.ctrlKey,
    meta: e.metaKey,
    shift: e.shiftKey,
    alt: e.altKey,
  });
};
```
