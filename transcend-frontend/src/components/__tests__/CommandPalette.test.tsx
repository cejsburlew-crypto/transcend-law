/**
 * Command Palette Test Suite
 *
 * Tests for the CommandPalette component and useCommandPalette hook
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette, type Command } from '../CommandPalette';
import { useCommandPalette } from '../../hooks/useCommandPalette';

describe('CommandPalette Component', () => {
  const mockCommands: Command[] = [
    {
      id: 'test-1',
      title: 'Test Command 1',
      description: 'First test command',
      category: 'navigation',
      icon: '🧪',
      action: jest.fn(),
      keywords: ['test', 'first'],
    },
    {
      id: 'test-2',
      title: 'Test Command 2',
      description: 'Second test command',
      category: 'action',
      action: jest.fn(),
      keywords: ['test', 'second'],
    },
    {
      id: 'test-3',
      title: 'Another Command',
      category: 'settings',
      action: jest.fn(),
      keywords: ['another', 'different'],
    },
  ];

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render without crashing', () => {
      render(<CommandPalette commands={mockCommands} />);
      expect(screen.getByLabelText('Open command palette')).toBeInTheDocument();
    });

    it('should display trigger button when closed', () => {
      render(<CommandPalette commands={mockCommands} />);
      expect(screen.getByText('Search...')).toBeInTheDocument();
      expect(screen.getByText('Cmd K')).toBeInTheDocument();
    });

    it('should show palette when opened', async () => {
      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search commands/)).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should open with Cmd+K on Mac', async () => {
      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', metaKey: true });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search commands/)).toBeInTheDocument();
      });
    });

    it('should open with Ctrl+K on Windows/Linux', async () => {
      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search commands/)).toBeInTheDocument();
      });
    });

    it('should close with Escape key', async () => {
      render(<CommandPalette commands={mockCommands} />);

      // Open
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search commands/)).toBeInTheDocument();
      });

      // Close
      fireEvent.keyDown(window, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/Search commands/)).not.toBeInTheDocument();
      });
    });

    it('should toggle with Cmd+K when already open', async () => {
      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search commands/)).toBeInTheDocument();
      });

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/Search commands/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should filter commands by search query', async () => {
      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      const input = await screen.findByPlaceholderText(/Search commands/);

      await userEvent.type(input, 'first');

      await waitFor(() => {
        expect(screen.getByText('Test Command 1')).toBeInTheDocument();
        expect(screen.queryByText('Test Command 2')).not.toBeInTheDocument();
      });
    });

    it('should perform fuzzy search', async () => {
      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      const input = await screen.findByPlaceholderText(/Search commands/);

      await userEvent.type(input, 'tst');

      await waitFor(() => {
        expect(screen.getByText('Test Command 1')).toBeInTheDocument();
        expect(screen.getByText('Test Command 2')).toBeInTheDocument();
      });
    });

    it('should show empty state when no results', async () => {
      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      const input = await screen.findByPlaceholderText(/Search commands/);

      await userEvent.type(input, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No commands found')).toBeInTheDocument();
      });
    });

    it('should clear search with clear button', async () => {
      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      const input = await screen.findByPlaceholderText(/Search commands/);

      await userEvent.type(input, 'test');
      const clearBtn = screen.getByLabelText('Clear search');
      fireEvent.click(clearBtn);

      await waitFor(() => {
        expect(screen.getByDisplayValue('')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate commands with arrow keys', async () => {
      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await screen.findByPlaceholderText(/Search commands/);

      // Check first item is selected
      let items = screen.getAllByRole('button', { hidden: false });
      expect(items[0]).toHaveClass('selected');

      // Navigate down
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      items = screen.getAllByRole('button', { hidden: false });
      expect(items[1]).toHaveClass('selected');

      // Navigate up
      fireEvent.keyDown(window, { key: 'ArrowUp' });
      items = screen.getAllByRole('button', { hidden: false });
      expect(items[0]).toHaveClass('selected');
    });

    it('should wrap navigation at bounds', async () => {
      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await screen.findByPlaceholderText(/Search commands/);

      // Navigate to last
      const items = screen.getAllByRole('button', { hidden: false });
      for (let i = 0; i < items.length - 1; i++) {
        fireEvent.keyDown(window, { key: 'ArrowDown' });
      }

      // Wrap to first
      fireEvent.keyDown(window, { key: 'ArrowDown' });

      const updatedItems = screen.getAllByRole('button', { hidden: false });
      expect(updatedItems[0]).toHaveClass('selected');
    });

    it('should execute command with Enter key', async () => {
      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await screen.findByPlaceholderText(/Search commands/);

      fireEvent.keyDown(window, { key: 'Enter' });

      await waitFor(() => {
        expect(mockCommands[0].action).toHaveBeenCalled();
      });
    });

    it('should execute command by clicking', async () => {
      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      const cmd = await screen.findByText('Test Command 1');

      fireEvent.click(cmd);

      await waitFor(() => {
        expect(mockCommands[0].action).toHaveBeenCalled();
      });
    });
  });

  describe('Recent Commands', () => {
    it('should track recently used commands', async () => {
      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await screen.findByPlaceholderText(/Search commands/);

      // Execute a command
      fireEvent.keyDown(window, { key: 'Enter' });

      await waitFor(() => {
        expect(mockCommands[0].action).toHaveBeenCalled();
      });

      // Recent storage should be updated
      const stored = JSON.parse(localStorage.getItem('transcend-command-palette-recent') || '[]');
      expect(stored).toContain('test-1');
    });

    it('should show recent commands when search is empty', async () => {
      // Pre-populate recent commands
      localStorage.setItem('transcend-command-palette-recent', JSON.stringify(['test-1']));

      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await screen.findByPlaceholderText(/Search commands/);

      // Should show "Recent" section
      await waitFor(() => {
        expect(screen.getByText('Recent')).toBeInTheDocument();
      });
    });

    it('should limit recent commands', async () => {
      render(<CommandPalette commands={mockCommands} maxRecentItems={2} />);

      // Execute multiple commands
      for (let i = 0; i < 3; i++) {
        fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
        await screen.findByPlaceholderText(/Search commands/);
        fireEvent.keyDown(window, { key: 'Enter' });
        await waitFor(() => expect(mockCommands[i].action).toHaveBeenCalled());
      }

      const stored = JSON.parse(localStorage.getItem('transcend-command-palette-recent') || '[]');
      expect(stored.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Analytics', () => {
    it('should call analytics callback on open', async () => {
      const onAnalytics = jest.fn();
      render(<CommandPalette commands={mockCommands} onAnalytics={onAnalytics} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

      await waitFor(() => {
        expect(onAnalytics).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'open' })
        );
      });
    });

    it('should call analytics callback on search', async () => {
      const onAnalytics = jest.fn();
      render(<CommandPalette commands={mockCommands} onAnalytics={onAnalytics} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      const input = await screen.findByPlaceholderText(/Search commands/);

      await userEvent.type(input, 'test');

      await waitFor(() => {
        expect(onAnalytics).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'search', query: 'test' })
        );
      });
    });

    it('should call analytics callback on execute', async () => {
      const onAnalytics = jest.fn();
      render(<CommandPalette commands={mockCommands} onAnalytics={onAnalytics} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await screen.findByPlaceholderText(/Search commands/);

      fireEvent.keyDown(window, { key: 'Enter' });

      await waitFor(() => {
        expect(onAnalytics).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'execute', commandId: 'test-1' })
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<CommandPalette commands={mockCommands} />);

      expect(screen.getByLabelText('Open command palette')).toBeInTheDocument();
    });

    it('should focus input when opened', async () => {
      render(<CommandPalette commands={mockCommands} />);

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });

      await waitFor(() => {
        const input = screen.getByPlaceholderText(/Search commands/);
        expect(input).toHaveFocus();
      });
    });

    it('should close when clicking outside', async () => {
      render(
        <div>
          <CommandPalette commands={mockCommands} />
          <div data-testid="outside">Outside</div>
        </div>
      );

      fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
      await screen.findByPlaceholderText(/Search commands/);

      fireEvent.mouseDown(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/Search commands/)).not.toBeInTheDocument();
      });
    });
  });
});

describe('useCommandPalette Hook', () => {
  const mockCommands: Command[] = [
    {
      id: 'test-1',
      title: 'Test',
      category: 'navigation',
      action: jest.fn(),
    },
    {
      id: 'test-2',
      title: 'Another',
      category: 'action',
      action: jest.fn(),
    },
  ];

  it('should initialize with correct state', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ commands: mockCommands })
    );

    expect(result.current.state.isOpen).toBe(false);
    expect(result.current.state.query).toBe('');
    expect(result.current.state.selectedIndex).toBe(0);
  });

  it('should toggle palette', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ commands: mockCommands })
    );

    act(() => {
      result.current.togglePalette();
    });

    expect(result.current.state.isOpen).toBe(true);
  });

  it('should handle query change', () => {
    const { result } = renderHook(() =>
      useCommandPalette({ commands: mockCommands })
    );

    act(() => {
      result.current.handleQueryChange('test');
    });

    expect(result.current.state.query).toBe('test');
  });

  it('should execute command', async () => {
    const { result } = renderHook(() =>
      useCommandPalette({ commands: mockCommands })
    );

    await act(async () => {
      await result.current.handleExecuteCommand(mockCommands[0]);
    });

    expect(mockCommands[0].action).toHaveBeenCalled();
  });
});

// Import for renderHook
import { renderHook, act } from '@testing-library/react';
