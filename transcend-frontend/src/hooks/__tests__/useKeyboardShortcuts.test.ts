import { renderHook, act } from '@testing-library/react';
import {
  useKeyboardShortcuts,
  matchesKeyCombo,
  KeyboardShortcut,
  DEFAULT_GLOBAL_SHORTCUTS,
} from '../useKeyboardShortcuts';

describe('useKeyboardShortcuts Hook', () => {
  describe('matchesKeyCombo', () => {
    it('should match single key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      expect(matchesKeyCombo(event, 'Enter')).toBe(true);
    });

    it('should match Escape key', () => {
      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      expect(matchesKeyCombo(event, 'Escape')).toBe(true);
    });

    it('should match ? key (Shift+/)', () => {
      const event = new KeyboardEvent('keydown', {
        key: '?',
        shiftKey: true,
        code: 'Slash',
      });
      expect(matchesKeyCombo(event, '?')).toBe(true);
    });

    it('should match Ctrl+K', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
      });
      expect(matchesKeyCombo(event, 'Ctrl+K')).toBe(true);
    });

    it('should match Cmd+K (Meta+K)', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
      });
      expect(matchesKeyCombo(event, 'Cmd+K')).toBe(true);
    });

    it('should match Shift+Delete', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'Delete',
        shiftKey: true,
      });
      expect(matchesKeyCombo(event, 'Shift+Delete')).toBe(true);
    });

    it('should match Ctrl+Shift+F', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'f',
        ctrlKey: true,
        shiftKey: true,
      });
      expect(matchesKeyCombo(event, 'Ctrl+Shift+F')).toBe(true);
    });

    it('should match arrow keys', () => {
      const upEvent = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      const downEvent = new KeyboardEvent('keydown', { key: 'ArrowDown' });

      expect(matchesKeyCombo(upEvent, 'ArrowUp')).toBe(true);
      expect(matchesKeyCombo(downEvent, 'ArrowDown')).toBe(true);
    });

    it('should not match wrong key', () => {
      const event = new KeyboardEvent('keydown', { key: 'a' });
      expect(matchesKeyCombo(event, 'b')).toBe(false);
    });

    it('should not match without required modifier', () => {
      const event = new KeyboardEvent('keydown', { key: 'k' });
      expect(matchesKeyCombo(event, 'Ctrl+K')).toBe(false);
    });

    it('should accept array format', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
      });
      expect(matchesKeyCombo(event, ['Ctrl', 'K'])).toBe(true);
    });
  });

  describe('useKeyboardShortcuts Hook', () => {
    it('should initialize with shortcuts', () => {
      const shortcuts: KeyboardShortcut[] = [
        {
          key: 'n',
          description: 'New',
          callback: jest.fn(),
        },
      ];

      const { result } = renderHook(() =>
        useKeyboardShortcuts({ shortcuts })
      );

      expect(result.current.getActiveShortcuts()).toHaveLength(1);
    });

    it('should add a shortcut', () => {
      const { result } = renderHook(() => useKeyboardShortcuts({ shortcuts: [] }));

      act(() => {
        result.current.addShortcut({
          key: 'n',
          description: 'New',
          callback: jest.fn(),
        });
      });

      expect(result.current.getActiveShortcuts()).toHaveLength(1);
    });

    it('should remove a shortcut', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [
            {
              key: 'n',
              description: 'New',
              callback: jest.fn(),
            },
          ],
        })
      );

      act(() => {
        result.current.removeShortcut('n');
      });

      expect(result.current.getActiveShortcuts()).toHaveLength(0);
    });

    it('should toggle shortcut enabled state', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [
            {
              key: 'n',
              description: 'New',
              callback: jest.fn(),
              enabled: true,
            },
          ],
        })
      );

      expect(result.current.getActiveShortcuts()).toHaveLength(1);

      act(() => {
        result.current.toggleShortcut('n', false);
      });

      expect(result.current.getActiveShortcuts()).toHaveLength(0);

      act(() => {
        result.current.toggleShortcut('n', true);
      });

      expect(result.current.getActiveShortcuts()).toHaveLength(1);
    });

    it('should group shortcuts by category', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [
            {
              key: 'n',
              description: 'New',
              category: 'Items',
              callback: jest.fn(),
            },
            {
              key: 'e',
              description: 'Edit',
              category: 'Items',
              callback: jest.fn(),
            },
            {
              key: 's',
              description: 'Search',
              category: 'Global',
              callback: jest.fn(),
            },
          ],
        })
      );

      const grouped = result.current.getGroupedShortcuts();

      expect(Object.keys(grouped)).toContain('Items');
      expect(Object.keys(grouped)).toContain('Global');
      expect(grouped['Items']).toHaveLength(2);
      expect(grouped['Global']).toHaveLength(1);
    });

    it('should format key combinations', () => {
      const { result } = renderHook(() => useKeyboardShortcuts({ shortcuts: [] }));

      expect(result.current.formatKeyCombo('Enter')).toBe('ENTER');
      expect(result.current.formatKeyCombo('Escape')).toBe('ESCAPE');
      expect(result.current.formatKeyCombo(['Shift', 'Delete'])).toBe('SHIFT+DELETE');
    });

    it('should update a shortcut', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [
            {
              key: 'n',
              description: 'Old description',
              callback: callback1,
            },
          ],
        })
      );

      act(() => {
        result.current.updateShortcut('n', {
          description: 'New description',
          callback: callback2,
        });
      });

      const shortcuts = result.current.getActiveShortcuts();
      expect(shortcuts[0].description).toBe('New description');
    });

    it('should get shortcuts by category', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [
            {
              key: 'n',
              description: 'New',
              category: 'Items',
              callback: jest.fn(),
            },
            {
              key: 's',
              description: 'Search',
              category: 'Global',
              callback: jest.fn(),
            },
          ],
        })
      );

      const itemsShortcuts = result.current.getShortcutsByCategory('Items');
      expect(itemsShortcuts).toHaveLength(1);
      expect(itemsShortcuts[0].key).toBe('n');
    });

    it('should detect platform', () => {
      const { result } = renderHook(() => useKeyboardShortcuts({ shortcuts: [] }));
      const platform = result.current.platform;
      expect(['mac', 'windows', 'linux']).toContain(platform);
    });

    it('should get modifier key for platform', () => {
      const { result } = renderHook(() => useKeyboardShortcuts({ shortcuts: [] }));
      const modifier = result.current.getModifierKey();
      expect(['Cmd', 'Ctrl']).toContain(modifier);
    });

    it('should handle disabled shortcuts', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [
            {
              key: 'n',
              description: 'New',
              callback: jest.fn(),
              enabled: false,
            },
          ],
        })
      );

      expect(result.current.getActiveShortcuts()).toHaveLength(0);
    });

    it('should allow disabling all shortcuts', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [
            {
              key: 'n',
              description: 'New',
              callback: jest.fn(),
            },
          ],
          enabled: false,
        })
      );

      // Note: With enabled: false, shortcuts shouldn't trigger,
      // but they're still "active" in terms of the list
      expect(result.current.getActiveShortcuts()).toHaveLength(1);
    });
  });

  describe('DEFAULT_GLOBAL_SHORTCUTS', () => {
    it('should have help shortcut', () => {
      const helpShortcut = DEFAULT_GLOBAL_SHORTCUTS.find(s => s.key === '?');
      expect(helpShortcut).toBeDefined();
      expect(helpShortcut?.description).toContain('help');
    });

    it('should have search shortcut', () => {
      const searchShortcut = DEFAULT_GLOBAL_SHORTCUTS.find(
        s => Array.isArray(s.key) && s.key.includes('K')
      );
      expect(searchShortcut).toBeDefined();
      expect(searchShortcut?.description).toContain('search');
    });

    it('should have escape shortcut', () => {
      const escapeShortcut = DEFAULT_GLOBAL_SHORTCUTS.find(s => s.key === 'Escape');
      expect(escapeShortcut).toBeDefined();
      expect(escapeShortcut?.description).toContain('close');
    });
  });

  describe('Keyboard Event Handling', () => {
    it('should handle keyboard events', () => {
      const callback = jest.fn();
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [
            {
              key: 'n',
              description: 'New',
              callback,
            },
          ],
        })
      );

      // Simulate keyboard event
      const event = new KeyboardEvent('keydown', { key: 'n' });
      window.dispatchEvent(event);

      // Note: In real tests, you'd use userEvent or fireEvent
      // This is just demonstrating the concept
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty shortcuts array', () => {
      const { result } = renderHook(() => useKeyboardShortcuts({ shortcuts: [] }));
      expect(result.current.getActiveShortcuts()).toHaveLength(0);
    });

    it('should handle duplicate shortcuts', () => {
      const { result } = renderHook(() =>
        useKeyboardShortcuts({
          shortcuts: [
            {
              key: 'n',
              description: 'New',
              callback: jest.fn(),
            },
            {
              key: 'n',
              description: 'Another new',
              callback: jest.fn(),
            },
          ],
        })
      );

      expect(result.current.getActiveShortcuts()).toHaveLength(2);
    });

    it('should handle special characters in key', () => {
      const event = new KeyboardEvent('keydown', {
        key: '/',
        shiftKey: true, // ?
      });

      expect(matchesKeyCombo(event, '?')).toBe(true);
    });

    it('should handle case insensitivity', () => {
      const eventLower = new KeyboardEvent('keydown', { key: 'k' });
      const eventUpper = new KeyboardEvent('keydown', { key: 'K' });

      expect(matchesKeyCombo(eventLower, 'K')).toBe(true);
      expect(matchesKeyCombo(eventUpper, 'k')).toBe(true);
    });
  });
});
