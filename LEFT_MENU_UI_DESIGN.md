# 🎨 Left Menu UI Design: Icon + Collapsible

**Refined visual design for better readability**  
**Status:** Ready for implementation  
**Date:** August 15, 2026

---

## Visual Design Goals

✅ **Scannable** - Icons make sections instantly recognizable  
✅ **Compact** - Collapsible sections save space  
✅ **Hierarchical** - Core vs Specialty visually distinct  
✅ **Interactive** - Expand/collapse smooth animations  
✅ **Accessible** - Clear labels, keyboard navigation  

---

## Layout Wireframe

```
┌─────────────────────────────────────┐
│  📋 Legal Tools                     │  ← Header with logo
├─────────────────────────────────────┤
│                                     │
│ 🔧 CORE TOOLS                   v   │  ← Collapsible (toggled open/closed)
│ ├─ 📚 Legal Research          [5]   │  ← Count badge, clickable
│ ├─ ⚖️  Matter Management        [3]  │
│ ├─ 💰 Billing & Operations      [2]  │
│ ├─ 👥 Client Management         [3]  │
│ ├─ 🔍 E-Discovery & Litigation   [2]  │
│ ├─ 📋 Admin & Support           [2]  │
│ └─ 🤝 Service Provider Mkts      [5]  │
│                                     │
│ ═════════════════════════════════   │  ← Visual divider
│                                     │
│ 🏢 CORPORATE LAW WORKFLOWS   >      │  ← Collapsible (toggled open/closed)
│                                     │
│ (When expanded, shows:)             │
│ ├─ 🏛️  Business Formation      [4]  │
│ ├─ 📊 M&A Due Diligence        [4]  │
│ ├─ 📋 Corporate Compliance      [4]  │
│ ├─ 📄 Contract Management       [4]  │
│ └─ 🤝 Corporate Mkts            [3]  │
│                                     │
│ ═════════════════════════════════   │
│                                     │
│ ⚡ PRACTICE AREA SWITCHER           │  ← Dropdown to change specialty
│    Current: Corporate Law >          │
│                                     │
│ ═════════════════════════════════   │
│                                     │
│ 📊 Quick Stats                      │
│    Cases: 12                        │
│    Hours Logged: 42.5               │
│                                     │
└─────────────────────────────────────┘
```

---

## Component Structure

### TypeScript Interface

```typescript
interface ToolItem {
  id: string;
  icon: string;        // emoji or icon key
  label: string;
  badge?: number;      // tool count
  href?: string;       // where clicking goes
  subcategories?: ToolCategory[];
}

interface ToolCategory {
  id: string;
  icon: string;
  name: string;        // e.g., "Legal Research"
  tools: ToolItem[];
  isExpanded?: boolean;
}

interface LeftMenuProps {
  personaId: number;
  practiceAreaId?: number;
  onSelectTool?: (tool: ToolItem) => void;
  onSelectPracticeArea?: (areaId: number) => void;
}
```

### Full React Component

```typescript
// src/components/LeftMenu/CollapsibleLeftMenu.tsx

import React, { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/outline';
import './CollapsibleLeftMenu.css';

export const CollapsibleLeftMenu: React.FC<LeftMenuProps> = ({
  personaId,
  practiceAreaId,
  onSelectTool,
  onSelectPracticeArea
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['core-tools']) // Core expanded by default
  );
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set() // Categories collapsed by default
  );

  // Load data
  const { coreTools, specialtyTools, practiceAreas } = useLeftMenuData(
    personaId,
    practiceAreaId
  );

  const toggleSection = (sectionId: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(sectionId)) {
      newSet.delete(sectionId);
    } else {
      newSet.add(sectionId);
    }
    setExpandedSections(newSet);
  };

  const toggleCategory = (categoryId: string) => {
    const newSet = new Set(expandedCategories);
    if (newSet.has(categoryId)) {
      newSet.delete(categoryId);
    } else {
      newSet.add(categoryId);
    }
    setExpandedCategories(newSet);
  };

  return (
    <aside className="left-menu">
      {/* Header */}
      <div className="left-menu-header">
        <div className="logo">
          <span className="logo-icon">⚖️</span>
          <span className="logo-text">Transcend Legal</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="left-menu-content">
        
        {/* CORE SECTION */}
        <Section
          id="core-tools"
          icon="🔧"
          title="Core Tools"
          badge={coreTools.length}
          isExpanded={expandedSections.has('core-tools')}
          onToggle={() => toggleSection('core-tools')}
          className="section-core"
        >
          {coreTools.map((category) => (
            <Category
              key={category.id}
              category={category}
              isExpanded={expandedCategories.has(category.id)}
              onToggle={() => toggleCategory(category.id)}
              onSelectTool={onSelectTool}
            />
          ))}
        </Section>

        {/* Divider */}
        <div className="menu-divider" />

        {/* SPECIALTY SECTION */}
        {specialtyTools && specialtyTools.length > 0 && (
          <Section
            id="specialty-tools"
            icon={getPracticeAreaIcon(practiceAreaId)}
            title={`${getPracticeAreaName(practiceAreaId)} Workflows`}
            badge={specialtyTools.flat().length}
            isExpanded={expandedSections.has('specialty-tools')}
            onToggle={() => toggleSection('specialty-tools')}
            className="section-specialty"
          >
            {specialtyTools.map((category) => (
              <Category
                key={category.id}
                category={category}
                isExpanded={expandedCategories.has(category.id)}
                onToggle={() => toggleCategory(category.id)}
                onSelectTool={onSelectTool}
              />
            ))}
          </Section>
        )}

        {/* Divider */}
        <div className="menu-divider" />

        {/* PRACTICE AREA SWITCHER */}
        <PracticeAreaSwitcher
          practiceAreas={practiceAreas}
          selectedAreaId={practiceAreaId}
          onSelect={onSelectPracticeArea}
        />

        {/* Divider */}
        <div className="menu-divider" />

        {/* QUICK STATS */}
        <QuickStats personaId={personaId} />
      </div>

      {/* Footer */}
      <div className="left-menu-footer">
        <button className="settings-btn">⚙️ Settings</button>
      </div>
    </aside>
  );
};

// Section Component
const Section: React.FC<{
  id: string;
  icon: string;
  title: string;
  badge?: number;
  isExpanded: boolean;
  onToggle: () => void;
  className?: string;
  children: React.ReactNode;
}> = ({ id, icon, title, badge, isExpanded, onToggle, className, children }) => (
  <div className={`menu-section ${className || ''}`}>
    <button
      className="section-header"
      onClick={onToggle}
      aria-expanded={isExpanded}
    >
      <span className="section-icon">{icon}</span>
      <span className="section-title">{title}</span>
      {badge && <span className="section-badge">{badge}</span>}
      <span className="section-toggle">
        {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
      </span>
    </button>
    
    {isExpanded && (
      <div className="section-content">
        {children}
      </div>
    )}
  </div>
);

// Category Component (groups of tools)
const Category: React.FC<{
  category: ToolCategory;
  isExpanded: boolean;
  onToggle: () => void;
  onSelectTool?: (tool: ToolItem) => void;
}> = ({ category, isExpanded, onToggle, onSelectTool }) => (
  <div className="tool-category">
    <button
      className="category-header"
      onClick={onToggle}
      aria-expanded={isExpanded}
    >
      <span className="category-icon">{category.icon}</span>
      <span className="category-name">{category.name}</span>
      <span className="category-count">[{category.tools.length}]</span>
      <span className="category-toggle">
        {isExpanded ? '▼' : '▶'}
      </span>
    </button>

    {isExpanded && (
      <div className="category-tools">
        {category.tools.map((tool) => (
          <ToolItem
            key={tool.id}
            tool={tool}
            onClick={() => onSelectTool?.(tool)}
          />
        ))}
      </div>
    )}
  </div>
);

// Tool Item Component
const ToolItem: React.FC<{
  tool: ToolItem;
  onClick: () => void;
}> = ({ tool, onClick }) => (
  <button
    className="tool-item"
    onClick={onClick}
  >
    <span className="tool-icon">{tool.icon}</span>
    <span className="tool-label">{tool.label}</span>
  </button>
);

// Practice Area Switcher
const PracticeAreaSwitcher: React.FC<{
  practiceAreas: Array<{ id: number; name: string; icon: string }>;
  selectedAreaId?: number;
  onSelect?: (areaId: number) => void;
}> = ({ practiceAreas, selectedAreaId, onSelect }) => (
  <div className="practice-area-switcher">
    <label>⚡ Practice Area</label>
    <select
      value={selectedAreaId || ''}
      onChange={(e) => onSelect?.(Number(e.target.value))}
      className="practice-area-select"
    >
      <option value="">Select practice area...</option>
      {practiceAreas.map((area) => (
        <option key={area.id} value={area.id}>
          {area.icon} {area.name}
        </option>
      ))}
    </select>
  </div>
);

// Quick Stats
const QuickStats: React.FC<{ personaId: number }> = ({ personaId }) => {
  const stats = useQuickStats(personaId);
  
  return (
    <div className="quick-stats">
      <h4>📊 Today</h4>
      <div className="stat-row">
        <span>Cases:</span>
        <strong>{stats.cases}</strong>
      </div>
      <div className="stat-row">
        <span>Hours:</span>
        <strong>{stats.hours}</strong>
      </div>
      <div className="stat-row">
        <span>Inbox:</span>
        <strong>{stats.inbox}</strong>
      </div>
    </div>
  );
};
```

---

## CSS Styling

```css
/* src/components/LeftMenu/CollapsibleLeftMenu.css */

:root {
  --menu-width: 280px;
  --primary-color: #667eea;
  --primary-light: #f0f4ff;
  --border-color: #e2e8f0;
  --text-primary: #1a202c;
  --text-secondary: #718096;
  --text-tertiary: #cbd5e0;
  --bg-surface: #ffffff;
  --bg-hover: #f7fafc;
  --transition: all 0.2s ease-in-out;
}

.left-menu {
  width: var(--menu-width);
  height: 100vh;
  background: var(--bg-surface);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ═══════════════════════════════════════════════════════════════ */
/* HEADER */
/* ═══════════════════════════════════════════════════════════════ */

.left-menu-header {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.logo-icon {
  font-size: 20px;
}

.logo-text {
  font-size: 14px;
}

/* ═══════════════════════════════════════════════════════════════ */
/* CONTENT AREA */
/* ═══════════════════════════════════════════════════════════════ */

.left-menu-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.left-menu-content::-webkit-scrollbar {
  width: 6px;
}

.left-menu-content::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.left-menu-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

/* ═══════════════════════════════════════════════════════════════ */
/* SECTIONS */
/* ═══════════════════════════════════════════════════════════════ */

.menu-section {
  margin: 0;
}

.section-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--text-secondary);
  transition: var(--transition);
}

.section-header:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.section-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.section-title {
  flex: 1;
  text-align: left;
}

.section-badge {
  background: var(--primary-light);
  color: var(--primary-color);
  border-radius: 12px;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 600;
  flex-shrink: 0;
}

.section-toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.section-toggle svg {
  width: 14px;
  height: 14px;
}

/* Special styling for core section */
.section-core .section-header {
  color: var(--primary-color);
  border-bottom: 1px solid var(--primary-light);
}

.section-core .section-header:hover {
  background: var(--primary-light);
}

/* Special styling for specialty section */
.section-specialty .section-header {
  color: var(--text-primary);
  font-weight: 600;
}

.section-content {
  animation: slideDown 0.2s ease-in-out;
  max-height: 100%;
}

@keyframes slideDown {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 1000px;
  }
}

/* ═══════════════════════════════════════════════════════════════ */
/* CATEGORIES */
/* ═══════════════════════════════════════════════════════════════ */

.tool-category {
  margin: 0;
}

.category-header {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-primary);
  transition: var(--transition);
}

.category-header:hover {
  background: var(--bg-hover);
  color: var(--primary-color);
}

.category-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.category-name {
  flex: 1;
  text-align: left;
  font-weight: 500;
}

.category-count {
  font-size: 11px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.category-toggle {
  font-size: 10px;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

/* ═══════════════════════════════════════════════════════════════ */
/* TOOL ITEMS */
/* ═══════════════════════════════════════════════════════════════ */

.category-tools {
  margin: 4px 0;
}

.tool-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 32px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-primary);
  transition: var(--transition);
  text-align: left;
}

.tool-item:hover {
  background: var(--bg-hover);
  color: var(--primary-color);
  padding-left: 30px;
  border-left: 2px solid var(--primary-color);
}

.tool-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.tool-label {
  flex: 1;
  word-break: break-word;
}

/* ═══════════════════════════════════════════════════════════════ */
/* DIVIDERS */
/* ═══════════════════════════════════════════════════════════════ */

.menu-divider {
  height: 1px;
  background: var(--border-color);
  margin: 8px 0;
}

/* ═══════════════════════════════════════════════════════════════ */
/* PRACTICE AREA SWITCHER */
/* ═══════════════════════════════════════════════════════════════ */

.practice-area-switcher {
  padding: 12px 16px;
  margin: 4px 0;
}

.practice-area-switcher label {
  display: block;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin-bottom: 6px;
}

.practice-area-select {
  width: 100%;
  padding: 8px 8px;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary);
  background: var(--bg-hover);
  cursor: pointer;
  transition: var(--transition);
}

.practice-area-select:hover {
  border-color: var(--primary-color);
  background: var(--primary-light);
}

.practice-area-select:focus {
  outline: none;
  border-color: var(--primary-color);
  box-shadow: 0 0 0 2px var(--primary-light);
}

/* ═══════════════════════════════════════════════════════════════ */
/* QUICK STATS */
/* ═══════════════════════════════════════════════════════════════ */

.quick-stats {
  padding: 12px 16px;
  margin: 4px 0;
  background: var(--bg-hover);
  border-radius: 4px;
}

.quick-stats h4 {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  margin: 0 0 8px 0;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 4px;
}

.stat-row span {
  color: var(--text-secondary);
}

.stat-row strong {
  color: var(--primary-color);
  font-weight: 600;
}

/* ═══════════════════════════════════════════════════════════════ */
/* FOOTER */
/* ═══════════════════════════════════════════════════════════════ */

.left-menu-footer {
  padding: 12px 16px;
  border-top: 1px solid var(--border-color);
}

.settings-btn {
  width: 100%;
  padding: 8px 12px;
  background: var(--bg-hover);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
  transition: var(--transition);
}

.settings-btn:hover {
  background: var(--primary-light);
  border-color: var(--primary-color);
  color: var(--primary-color);
}

/* ═══════════════════════════════════════════════════════════════ */
/* DARK MODE SUPPORT */
/* ═══════════════════════════════════════════════════════════════ */

@media (prefers-color-scheme: dark) {
  :root {
    --primary-light: #1e3a8a;
    --border-color: #2d3748;
    --text-primary: #e2e8f0;
    --text-secondary: #a0aec0;
    --text-tertiary: #718096;
    --bg-surface: #1a202c;
    --bg-hover: #2d3748;
  }
}

/* ═══════════════════════════════════════════════════════════════ */
/* RESPONSIVE */
/* ═══════════════════════════════════════════════════════════════ */

@media (max-width: 768px) {
  .left-menu {
    width: 240px;
  }

  .logo-text {
    display: none;
  }

  .logo {
    justify-content: center;
  }

  .section-title,
  .category-name,
  .tool-label {
    font-size: 11px;
  }
}
```

---

## Icon Legend

```
🔧 Core Tools
📚 Legal Research
⚖️  Matter Management
💰 Billing & Operations
👥 Client Management
🔍 E-Discovery & Litigation
📋 Admin & Support
🤝 Service Provider Marketplaces

🏢 Corporate Law
🏛️  Business Formation
📊 M&A Due Diligence
📋 Corporate Compliance
📄 Contract Management

👨‍👩‍👧 Family Law
👶 Child Support & Custody
💍 Divorce & Separation
📋 Family Law Documents

🌍 Immigration Law
✈️  Visa & Immigration Forms
🟢 Green Card & Naturalization
🚨 Deportation Defense

💵 Tax Law
📊 Tax Research & Code
👤 Individual Tax Planning
🏢 Business Tax Planning
⚠️  Tax Controversy & Dispute
```

---

## Interaction Flow

### User Opens Menu
```
1. Menu loads with Core Tools expanded
2. Specialty section collapsed (collapsible)
3. Categories within sections collapsed
4. Quick stats visible at bottom
5. Practice area dropdown ready
```

### User Expands Category
```
1. Click "Legal Research" (expanded arrow)
2. Smooth slide-down animation
3. Shows 5 tools: Free Research, Case Law, etc.
4. Tools each clickable
5. Click tool → Navigate to that tool
```

### User Switches Practice Area
```
1. Click dropdown: "Practice Area"
2. Select "Family Law"
3. Specialty section header updates
4. Tools refresh to Family Law tools
5. Specialty section auto-expands
```

---

## Accessibility Features

✅ **Keyboard Navigation:** Tab through all interactive elements  
✅ **ARIA Labels:** `aria-expanded` on collapsible buttons  
✅ **Screen Readers:** Semantic HTML, clear labels  
✅ **Color Contrast:** All text meets WCAG AA standards  
✅ **Focus States:** Clear visual feedback on focus  

---

## Animation Details

### Section Collapse/Expand
```
Duration: 200ms
Easing: ease-in-out
Effect: Slide down with fade
```

### Hover Effects
```
Duration: 200ms
Opacity: Smooth fade to hover color
Background: Slight background color shift
```

### Transition to New Practice Area
```
Duration: 300ms
Effect: Fade out old tools, fade in new tools
```

---

## Implementation Checklist

- [ ] Create React component file
- [ ] Implement useState for expand/collapse
- [ ] Add icon mapping
- [ ] Create CSS file with all styles
- [ ] Add dark mode support
- [ ] Implement practice area switcher
- [ ] Add quick stats widget
- [ ] Test keyboard navigation
- [ ] Test with screen reader
- [ ] Performance optimization (memoization)
- [ ] Mobile responsive testing
- [ ] Animation polish

---

## Benefits of This Design

✅ **Clean & Modern** - Uses icons + whitespace  
✅ **Space Efficient** - Collapsible sections reduce clutter  
✅ **Scannable** - Icons provide quick visual identification  
✅ **Interactive** - Smooth animations feel responsive  
✅ **Professional** - Polished UI matching modern legal software  
✅ **Accessible** - Full keyboard + screen reader support  
✅ **Dark Mode Ready** - Supports light and dark themes  

