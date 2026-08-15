import React, { useEffect, useRef } from 'react';
import { useCommandPalette, type Command, type AnalyticsEvent } from '../hooks/useCommandPalette';
import './CommandPalette.css';

interface CommandPaletteProps {
  commands: Command[];
  onAnalytics?: (event: AnalyticsEvent) => void;
  maxRecentItems?: number;
  placeholder?: string;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  commands,
  onAnalytics,
  maxRecentItems = 5,
  placeholder = 'Search commands, navigate pages, or run actions...',
}) => {
  const {
    state,
    inputRef,
    handleQueryChange,
    handleExecuteCommand,
    closePalette,
  } = useCommandPalette({
    commands,
    maxRecentItems,
    onAnalytics,
  });

  const paletteRef = useRef<HTMLDivElement>(null);

  // Handle clicks outside the palette
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (paletteRef.current && !paletteRef.current.contains(e.target as Node)) {
        closePalette();
      }
    };

    if (state.isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [state.isOpen, closePalette]);

  const displayCommands =
    state.query.trim() === '' ? state.recentCommands : state.filteredCommands;

  const getCategoryColor = (category: string): string => {
    switch (category) {
      case 'navigation':
        return '#3b82f6'; // blue
      case 'action':
        return '#10b981'; // green
      case 'settings':
        return '#8b5cf6'; // purple
      case 'quick-action':
        return '#f59e0b'; // amber
      case 'custom':
        return '#ec4899'; // pink
      default:
        return '#6b7280'; // gray
    }
  };

  const getCategoryLabel = (category: string): string => {
    switch (category) {
      case 'navigation':
        return '📍';
      case 'action':
        return '⚡';
      case 'settings':
        return '⚙️';
      case 'quick-action':
        return '⚡';
      case 'custom':
        return '✨';
      default:
        return '•';
    }
  };

  return (
    <>
      {/* Overlay */}
      {state.isOpen && <div className="command-palette-overlay" />}

      {/* Command Palette Modal */}
      {state.isOpen && (
        <div className="command-palette-container" ref={paletteRef}>
          <div className="command-palette-modal">
            {/* Search Input */}
            <div className="command-palette-search">
              <svg
                className="command-palette-search-icon"
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>

              <input
                ref={inputRef}
                type="text"
                className="command-palette-input"
                placeholder={placeholder}
                value={state.query}
                onChange={(e) => handleQueryChange(e.target.value)}
                aria-label="Search commands"
              />

              {state.query && (
                <button
                  className="command-palette-clear"
                  onClick={() => handleQueryChange('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}

              <div className="command-palette-keyboard-shortcut">Esc</div>
            </div>

            {/* Commands List */}
            <div className="command-palette-list">
              {displayCommands.length > 0 ? (
                <>
                  {state.query.trim() === '' && state.recentCommands.length > 0 && (
                    <div className="command-palette-section">
                      <div className="command-palette-section-title">Recent</div>
                      {state.recentCommands.map((command, index) => (
                        <div
                          key={command.id}
                          className={`command-palette-item ${
                            index === state.selectedIndex ? 'selected' : ''
                          }`}
                          onClick={() => handleExecuteCommand(command)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="command-palette-item-icon">
                            {command.icon || getCategoryLabel(command.category)}
                          </div>

                          <div className="command-palette-item-content">
                            <div className="command-palette-item-title">
                              {command.title}
                            </div>
                            {command.description && (
                              <div className="command-palette-item-description">
                                {command.description}
                              </div>
                            )}
                          </div>

                          <div className="command-palette-item-category">
                            <span
                              className="command-palette-category-badge"
                              style={{
                                backgroundColor: getCategoryColor(command.category),
                              }}
                            >
                              {command.category}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {state.query.trim() !== '' && (
                    <div className="command-palette-section">
                      <div className="command-palette-section-title">
                        Results ({displayCommands.length})
                      </div>
                      {state.filteredCommands.slice(0, 10).map((command, index) => (
                        <div
                          key={command.id}
                          className={`command-palette-item ${
                            index === state.selectedIndex ? 'selected' : ''
                          }`}
                          onClick={() => handleExecuteCommand(command)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="command-palette-item-icon">
                            {command.icon || getCategoryLabel(command.category)}
                          </div>

                          <div className="command-palette-item-content">
                            <div className="command-palette-item-title">
                              {command.title}
                            </div>
                            {command.description && (
                              <div className="command-palette-item-description">
                                {command.description}
                              </div>
                            )}
                          </div>

                          <div className="command-palette-item-category">
                            <span
                              className="command-palette-category-badge"
                              style={{
                                backgroundColor: getCategoryColor(command.category),
                              }}
                            >
                              {command.category}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {state.query.trim() !== '' && state.filteredCommands.length > 10 && (
                    <div className="command-palette-footer">
                      Showing 10 of {state.filteredCommands.length} results
                    </div>
                  )}
                </>
              ) : (
                <div className="command-palette-empty">
                  <div className="command-palette-empty-icon">🔍</div>
                  <div className="command-palette-empty-title">No commands found</div>
                  <div className="command-palette-empty-description">
                    Try searching for something else
                  </div>
                </div>
              )}
            </div>

            {/* Footer - Help Text */}
            {displayCommands.length > 0 && (
              <div className="command-palette-help">
                <div className="command-palette-help-item">
                  <kbd>↑↓</kbd>
                  <span>Navigate</span>
                </div>
                <div className="command-palette-help-item">
                  <kbd>Enter</kbd>
                  <span>Execute</span>
                </div>
                <div className="command-palette-help-item">
                  <kbd>Esc</kbd>
                  <span>Close</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Command Palette Trigger Button */}
      {!state.isOpen && (
        <button
          className="command-palette-trigger"
          onClick={() => {
            // Toggle is handled by keyboard shortcut, but provide visual feedback
            if (onAnalytics) {
              onAnalytics({
                type: 'open',
                timestamp: Date.now(),
              });
            }
          }}
          title="Press Cmd+K (Mac) or Ctrl+K (Windows/Linux) to open command palette"
          aria-label="Open command palette"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <span className="command-palette-trigger-text">Search...</span>
          <span className="command-palette-trigger-shortcut">Cmd K</span>
        </button>
      )}
    </>
  );
};

export default CommandPalette;
