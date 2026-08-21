// Anti-copy protection utilities
// Prevents copying, pasting, and selecting of sensitive provider data

// Elements that should be protected from copying (personal/contact info)
export const PROTECTED_DATA_CLASSES = [
  'protected-email',
  'protected-phone',
  'protected-contact-info',
];

// Initialize anti-copy protection on the document
export const initializeAntiCopyProtection = (): void => {
  // Disable context menu (right-click) on protected elements
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    if (isProtectedElement(target)) {
      e.preventDefault();
    }
  });

  // Disable copy on protected elements
  document.addEventListener('copy', (e) => {
    const selection = window.getSelection();
    if (selection && containsProtectedElement(selection)) {
      e.preventDefault();
      logCopyAttempt('copy', selection.toString());
    }
  });

  // Disable cut on protected elements
  document.addEventListener('cut', (e) => {
    const selection = window.getSelection();
    if (selection && containsProtectedElement(selection)) {
      e.preventDefault();
      logCopyAttempt('cut', selection.toString());
    }
  });

  // Disable text selection on protected elements
  document.addEventListener('selectstart', (e) => {
    const target = e.target as HTMLElement;
    if (isProtectedElement(target)) {
      e.preventDefault();
    }
  });

  // Disable drag-and-drop of protected elements
  document.addEventListener('dragstart', (e) => {
    const target = e.target as HTMLElement;
    if (isProtectedElement(target)) {
      e.preventDefault();
    }
  });

  // Disable paste into protected elements
  document.addEventListener('paste', (e) => {
    const target = e.target as HTMLElement;
    if (isProtectedElement(target)) {
      e.preventDefault();
      logCopyAttempt('paste', 'paste attempted');
    }
  });
};

// Check if an element is protected
const isProtectedElement = (element: HTMLElement): boolean => {
  return PROTECTED_DATA_CLASSES.some((className) =>
    element.classList.contains(className)
  ) || element.closest(`.${PROTECTED_DATA_CLASSES.join(', .')}`);
};

// Check if selection contains protected elements
const containsProtectedElement = (selection: Selection): boolean => {
  for (let i = 0; i < selection.rangeCount; i++) {
    const range = selection.getRangeAt(i);
    const fragment = range.extractContents();
    const container = document.createElement('div');
    container.appendChild(fragment);

    if (
      PROTECTED_DATA_CLASSES.some((className) =>
        container.querySelector(`.${className}`)
      )
    ) {
      // Put the contents back
      range.insertNode(container);
      return true;
    }
  }
  return false;
};

// Log copy/paste attempts on protected data
const logCopyAttempt = (action: string, data: string): void => {
  try {
    const logs = localStorage.getItem('copy_protection_logs') || '[]';
    const logArray = JSON.parse(logs);
    logArray.push({
      action,
      dataLength: data.length,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
    // Keep only last 500 logs
    if (logArray.length > 500) {
      logArray.shift();
    }
    localStorage.setItem('copy_protection_logs', JSON.stringify(logArray));
  } catch (error) {
    console.error('Failed to log copy attempt:', error);
  }
};

// Render protected text (email, phone, etc.)
export const renderProtectedData = (
  data: string,
  type: 'email' | 'phone'
): JSX.Element => {
  const className = type === 'email' ? 'protected-email' : 'protected-phone';
  const displayText = maskSensitiveData(data, type);

  return (
    <span
      className={`${className} protected-contact-info`}
      style={{
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
      }}
      onMouseDown={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDrag={(e) => e.preventDefault()}
    >
      {displayText}
    </span>
  );
};

// Mask sensitive data for display (show partial email/phone)
const maskSensitiveData = (data: string, type: 'email' | 'phone'): string => {
  if (type === 'email') {
    const [local, domain] = data.split('@');
    if (local && domain) {
      const masked = local.substring(0, 2) + '*'.repeat(Math.max(1, local.length - 2)) + '@' + domain;
      return masked;
    }
  } else if (type === 'phone') {
    const digits = data.replace(/\D/g, '');
    if (digits.length >= 4) {
      return '***-***-' + digits.substring(digits.length - 4);
    }
  }
  return data;
};

// CSS to be applied to protected elements
export const protectionCSS = `
  .protected-email,
  .protected-phone,
  .protected-contact-info {
    user-select: none !important;
    -webkit-user-select: none !important;
    -moz-user-select: none !important;
    -ms-user-select: none !important;
    cursor: default;
  }

  .protected-email::selection,
  .protected-phone::selection,
  .protected-contact-info::selection {
    background-color: transparent !important;
  }

  .protected-email::-moz-selection,
  .protected-phone::-moz-selection,
  .protected-contact-info::-moz-selection {
    background-color: transparent !important;
  }
`;
