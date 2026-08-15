import React, { useEffect, useRef } from 'react';
import { useKeyboardShortcuts, KeyboardShortcut } from '../hooks/useKeyboardShortcuts';
import './ShortcutsHelp.css';

interface ShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts?: KeyboardShortcut[];
  title?: string;
}

/**
 * ShortcutsHelp Component
 * Modal dialog that displays available keyboard shortcuts
 * Grouped by category for easy navigation
 */
export const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({
  isOpen,
  onClose,
  shortcuts = [],
  title = 'Keyboard Shortcuts',
}) => {
  const { formatKeyCombo, getGroupedShortcuts } = useKeyboardShortcuts({
    shortcuts,
  });
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  // Close when clicking outside the modal
  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  // Focus management
  useEffect(() => {
    if (isOpen && modalRef.current) {
      const focusableElements = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      firstElement?.focus();
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const groupedShortcuts = getGroupedShortcuts();
  const categories = Object.keys(groupedShortcuts).sort();

  return (
    <div className="shortcuts-help-overlay" onClick={handleBackdropClick} role="presentation">
      <div className="shortcuts-help-modal" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="shortcuts-help-title">
        {/* Header */}
        <div className="shortcuts-help-header">
          <h2 id="shortcuts-help-title" className="shortcuts-help-title">
            {title}
          </h2>
          <button
            className="shortcuts-help-close"
            onClick={onClose}
            aria-label="Close shortcuts help"
            title="Close (Esc)"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="shortcuts-help-content">
          {categories.length > 0 ? (
            categories.map(category => (
              <div key={category} className="shortcuts-help-category">
                <h3 className="shortcuts-help-category-title">{category}</h3>
                <div className="shortcuts-help-list">
                  {groupedShortcuts[category].map((shortcut, index) => (
                    <div key={index} className="shortcuts-help-item">
                      <div className="shortcuts-help-keys">
                        <kbd className="shortcuts-help-key">
                          {formatKeyCombo(shortcut.key)}
                        </kbd>
                      </div>
                      <div className="shortcuts-help-description">
                        {shortcut.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="shortcuts-help-empty">
              <p>No shortcuts available</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shortcuts-help-footer">
          <p className="shortcuts-help-footer-text">
            Press <kbd className="shortcuts-help-key shortcuts-help-key--small">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  );
};

export default ShortcutsHelp;
