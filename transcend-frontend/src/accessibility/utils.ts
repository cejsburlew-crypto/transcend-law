/**
 * Accessibility Utilities & Helpers
 * Reusable functions for implementing WCAG 2.1 AA compliance
 */

/**
 * Generate unique IDs for accessibility attributes
 */
export const generateId = (prefix: string = 'a11y'): string => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Validate color contrast ratio
 * Returns contrast ratio between two colors
 */
export const getContrastRatio = (color1: string, color2: string): number => {
  const rgb1 = parseRgb(color1);
  const rgb2 = parseRgb(color2);

  const lum1 = getRelativeLuminance(rgb1);
  const lum2 = getRelativeLuminance(rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * Check if contrast meets WCAG AA standard
 */
export const meetsContrastStandard = (
  foreground: string,
  background: string,
  isLargeText: boolean = false
): boolean => {
  const contrast = getContrastRatio(foreground, background);
  const required = isLargeText ? 3 : 4.5;
  return contrast >= required;
};

/**
 * Parse CSS color string to RGB object
 */
const parseRgb = (color: string): { r: number; g: number; b: number } => {
  // Handle rgb()/rgba()
  if (color.startsWith('rgb')) {
    const match = color.match(/\d+/g);
    if (match && match.length >= 3) {
      return {
        r: parseInt(match[0], 10),
        g: parseInt(match[1], 10),
        b: parseInt(match[2], 10),
      };
    }
  }

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.replace('#', '');
    return {
      r: parseInt(hex.substr(0, 2), 16),
      g: parseInt(hex.substr(2, 2), 16),
      b: parseInt(hex.substr(4, 2), 16),
    };
  }

  // Default to black
  return { r: 0, g: 0, b: 0 };
};

/**
 * Calculate relative luminance (WCAG formula)
 */
const getRelativeLuminance = (rgb: { r: number; g: number; b: number }): number => {
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
    const v = val / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * Check if element is visible and focusable
 */
export const isFocusable = (element: HTMLElement): boolean => {
  // Check if hidden
  if (element.offsetParent === null) return false;

  // Check if disabled
  if ((element as any).disabled) return false;

  // Check if aria-hidden
  if (element.getAttribute('aria-hidden') === 'true') return false;

  // Check tabindex
  const tabindex = element.getAttribute('tabindex');
  if (tabindex !== null && parseInt(tabindex, 10) < 0) return false;

  return true;
};

/**
 * Get all focusable elements within a container
 */
export const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  return Array.from(container.querySelectorAll(selector)).filter(
    (el) => isFocusable(el as HTMLElement)
  ) as HTMLElement[];
};

/**
 * Trap focus within a container (useful for modals)
 */
export const trapFocus = (
  container: HTMLElement,
  onEscape?: () => void
): (() => void) => {
  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) {
    console.warn('No focusable elements found in container for focus trap');
    return () => {};
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleKeyDown = (e: KeyboardEvent) => {
    // Handle Escape key
    if (e.key === 'Escape' && onEscape) {
      e.preventDefault();
      onEscape();
      return;
    }

    // Trap Tab key
    if (e.key !== 'Tab') return;

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  };

  // Focus first element
  firstElement.focus();

  // Add event listener
  container.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
  };
};

/**
 * Announce message to screen readers
 * Uses aria-live region for polite announcements
 */
export const announceToScreenReader = (
  message: string,
  priority: 'polite' | 'assertive' = 'polite'
): void => {
  const id = `sr-announcement-${Date.now()}`;

  // Create or get aria-live region
  let liveRegion = document.getElementById(id);
  if (!liveRegion) {
    liveRegion = document.createElement('div');
    liveRegion.id = id;
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', priority);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.position = 'absolute';
    liveRegion.style.left = '-10000px';
    liveRegion.style.width = '1px';
    liveRegion.style.height = '1px';
    liveRegion.style.overflow = 'hidden';
    document.body.appendChild(liveRegion);
  }

  liveRegion.textContent = message;

  // Clean up after a delay
  setTimeout(() => {
    liveRegion?.remove();
  }, 1000);
};

/**
 * Create accessible error message
 */
export const createErrorMessage = (
  fieldId: string,
  errorText: string
): { id: string; element: HTMLDivElement } => {
  const errorId = `${fieldId}-error`;
  const errorDiv = document.createElement('div');
  errorDiv.id = errorId;
  errorDiv.setAttribute('role', 'alert');
  errorDiv.className = 'error-message';
  errorDiv.textContent = errorText;
  return { id: errorId, element: errorDiv };
};

/**
 * Link error message to form field
 */
export const linkErrorToField = (
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  errorId: string
): void => {
  const currentDescribedBy = field.getAttribute('aria-describedby') || '';
  const descriptionIds = currentDescribedBy.split(' ').filter((id) => id && id !== errorId);
  descriptionIds.push(errorId);
  field.setAttribute('aria-describedby', descriptionIds.join(' '));
  field.setAttribute('aria-invalid', 'true');
};

/**
 * Remove error from field
 */
export const clearFieldError = (
  field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  errorId: string
): void => {
  const currentDescribedBy = field.getAttribute('aria-describedby') || '';
  const descriptionIds = currentDescribedBy
    .split(' ')
    .filter((id) => id && id !== errorId);
  if (descriptionIds.length > 0) {
    field.setAttribute('aria-describedby', descriptionIds.join(' '));
  } else {
    field.removeAttribute('aria-describedby');
  }
  field.setAttribute('aria-invalid', 'false');
};

/**
 * Create accessible dialog/modal
 */
export const createAccessibleDialog = (options: {
  title: string;
  content: string;
  buttons: Array<{ label: string; onClick: () => void; primary?: boolean }>;
}): HTMLDivElement => {
  const dialog = document.createElement('div');
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'dialog-title');

  const title = document.createElement('h2');
  title.id = 'dialog-title';
  title.textContent = options.title;

  const content = document.createElement('div');
  content.innerHTML = options.content;

  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'dialog-buttons';

  options.buttons.forEach((btn) => {
    const button = document.createElement('button');
    button.textContent = btn.label;
    button.onclick = btn.onClick;
    if (btn.primary) {
      button.className = 'btn-primary';
    }
    buttonContainer.appendChild(button);
  });

  dialog.appendChild(title);
  dialog.appendChild(content);
  dialog.appendChild(buttonContainer);

  return dialog;
};

/**
 * Check if text is readable (meets minimum size and contrast)
 */
export const isTextReadable = (element: HTMLElement): boolean => {
  const style = window.getComputedStyle(element);
  const fontSize = parseFloat(style.fontSize);
  const fontWeight = style.fontWeight;
  const color = style.color;
  const background = style.backgroundColor;

  // Check font size
  const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight === 'bold');

  // Check contrast
  const contrast = getContrastRatio(color, background);
  const minContrast = isLargeText ? 3 : 4.5;

  return contrast >= minContrast;
};

/**
 * Get accessible name for element
 * (simulates ARIA accessible name computation)
 */
export const getAccessibleName = (element: HTMLElement): string => {
  // Check for aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // Check for aria-labelledby
  const ariaLabelledBy = element.getAttribute('aria-labelledby');
  if (ariaLabelledBy) {
    const labelElement = document.getElementById(ariaLabelledBy);
    if (labelElement) return labelElement.textContent || '';
  }

  // Check for associated label
  if (element.id) {
    const label = document.querySelector(`label[for="${element.id}"]`);
    if (label) return label.textContent || '';
  }

  // Check for text content
  if (element.textContent?.trim()) return element.textContent.trim();

  // Check for title
  const title = element.getAttribute('title');
  if (title) return title;

  // Check for alt (for images)
  const alt = element.getAttribute('alt');
  if (alt) return alt;

  return '';
};

/**
 * Test keyboard navigation
 * Returns list of issues found
 */
export const testKeyboardNavigation = (
  container: HTMLElement
): Array<{ element: HTMLElement; issue: string }> => {
  const issues: Array<{ element: HTMLElement; issue: string }> = [];

  // Check for keyboard traps
  const clickableElements = container.querySelectorAll('[onclick]');
  clickableElements.forEach((el) => {
    const htmlEl = el as HTMLElement;
    if (!htmlEl.hasAttribute('onkeydown') && !htmlEl.hasAttribute('onkeypress')) {
      issues.push({
        element: htmlEl,
        issue: 'Click handler without keyboard support',
      });
    }
  });

  // Check for focus visibility
  const focusable = getFocusableElements(container);
  focusable.forEach((el) => {
    const style = window.getComputedStyle(el, ':focus');
    if (style.outline === 'none' || style.outline === 'rgb(0, 0, 0) none 0px') {
      issues.push({
        element: el,
        issue: 'No focus indicator visible',
      });
    }
  });

  // Check for positive tabindex
  const withTabindex = container.querySelectorAll('[tabindex]');
  withTabindex.forEach((el) => {
    const tabindex = parseInt(el.getAttribute('tabindex') || '0', 10);
    if (tabindex > 0) {
      issues.push({
        element: el as HTMLElement,
        issue: `Positive tabindex (${tabindex}) disrupts tab order`,
      });
    }
  });

  return issues;
};

/**
 * Generate accessibility checklist for component
 */
export const generateAccessibilityChecklist = (
  component: HTMLElement
): {
  passed: string[];
  failed: string[];
} => {
  const passed: string[] = [];
  const failed: string[] = [];

  // Check for heading hierarchy
  const headings = component.querySelectorAll('h1, h2, h3, h4, h5, h6');
  if (headings.length > 0) {
    let valid = true;
    let lastLevel = 0;
    headings.forEach((h) => {
      const level = parseInt(h.tagName[1], 10);
      if (level > lastLevel + 1) valid = false;
      lastLevel = level;
    });
    if (valid) {
      passed.push('Heading hierarchy is correct');
    } else {
      failed.push('Heading hierarchy has gaps');
    }
  }

  // Check for images with alt
  const images = component.querySelectorAll('img');
  const imagesWithAlt = Array.from(images).filter((img) => img.hasAttribute('alt'));
  if (imagesWithAlt.length === images.length) {
    passed.push('All images have alt text');
  } else if (imagesWithAlt.length > 0) {
    failed.push(`${images.length - imagesWithAlt.length} images missing alt text`);
  }

  // Check for form labels
  const inputs = component.querySelectorAll('input, textarea, select');
  const inputsWithLabel = Array.from(inputs).filter((input) => {
    const id = input.getAttribute('id');
    return (
      input.hasAttribute('aria-label') ||
      input.hasAttribute('aria-labelledby') ||
      (id && document.querySelector(`label[for="${id}"]`))
    );
  });
  if (inputsWithLabel.length === inputs.length) {
    passed.push('All form inputs have labels');
  } else if (inputsWithLabel.length > 0) {
    failed.push(`${inputs.length - inputsWithLabel.length} form inputs missing labels`);
  }

  // Check for buttons with accessible names
  const buttons = component.querySelectorAll('button, [role="button"]');
  const buttonsWithName = Array.from(buttons).filter((btn) => getAccessibleName(btn as HTMLElement));
  if (buttonsWithName.length === buttons.length) {
    passed.push('All buttons have accessible names');
  } else {
    failed.push(`${buttons.length - buttonsWithName.length} buttons missing accessible names`);
  }

  // Check for focus indicators
  const focusable = getFocusableElements(component);
  const withFocusIndicator = focusable.filter((el) => {
    const style = window.getComputedStyle(el, ':focus');
    return style.outline !== 'none';
  });
  if (withFocusIndicator.length === focusable.length) {
    passed.push('All focusable elements have focus indicators');
  } else {
    failed.push(`${focusable.length - withFocusIndicator.length} focusable elements lack focus indicators`);
  }

  return { passed, failed };
};

export default {
  generateId,
  getContrastRatio,
  meetsContrastStandard,
  isFocusable,
  getFocusableElements,
  trapFocus,
  announceToScreenReader,
  createErrorMessage,
  linkErrorToField,
  clearFieldError,
  createAccessibleDialog,
  isTextReadable,
  getAccessibleName,
  testKeyboardNavigation,
  generateAccessibilityChecklist,
};
