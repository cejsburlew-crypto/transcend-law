/**
 * WCAG 2.1 AA Accessibility Audit Tool
 * Comprehensive accessibility compliance checking for all components
 * Covers: ARIA labels, keyboard navigation, color contrast, focus management, forms, alt text, video captions
 */

export interface AccessibilityIssue {
  id: string;
  component: string;
  severity: 'error' | 'warning' | 'info';
  category: 'aria' | 'keyboard' | 'contrast' | 'focus' | 'form' | 'media' | 'semantic';
  title: string;
  description: string;
  wcagLevel: string;
  fix: string;
  element?: HTMLElement;
  lineNumber?: number;
  affectedElements?: string[];
}

export interface ComponentAuditResult {
  componentName: string;
  filePath: string;
  issues: AccessibilityIssue[];
  score: number; // 0-100
  passed: number;
  failed: number;
  warnings: number;
  timestamp: Date;
}

export interface AuditSummary {
  totalComponents: number;
  totalIssues: number;
  issuesByCategory: Record<string, number>;
  issuesBySeverity: Record<string, number>;
  averageScore: number;
  componentResults: ComponentAuditResult[];
  generatedAt: Date;
}

const WCAG_CRITERIA = {
  // ARIA Labels & Roles (WCAG 1.3.1, 1.4.3, 4.1.2)
  'aria-labels': {
    level: 'AA',
    description: 'All interactive elements must have accessible labels',
    checks: [
      'buttons have aria-label or text content',
      'form inputs have associated labels',
      'images have alt text or aria-label',
      'icon-only buttons have aria-label',
      'interactive elements have role attributes',
    ],
  },
  // Keyboard Navigation (WCAG 2.1.1)
  'keyboard-navigation': {
    level: 'A',
    description: 'All functionality must be accessible via keyboard',
    checks: [
      'no keyboard traps',
      'tab order is logical',
      'focus visible for all interactive elements',
      'keyboard shortcuts don\'t conflict with browser shortcuts',
      'all buttons respond to Enter/Space',
      'all links respond to Enter',
      'modals can be closed with Escape',
      'form inputs can be navigated with Tab/Shift+Tab',
    ],
  },
  // Color Contrast (WCAG 1.4.3)
  'color-contrast': {
    level: 'AA',
    description: 'Text must have sufficient color contrast',
    checks: [
      'normal text has 4.5:1 contrast ratio (AA)',
      'large text has 3:1 contrast ratio (AA)',
      'UI components have 3:1 contrast ratio',
      'graphical elements have 3:1 contrast',
      'focus indicators have 3:1 contrast',
    ],
  },
  // Focus Management (WCAG 2.4.3, 2.4.7)
  'focus-management': {
    level: 'AA',
    description: 'Focus must be visible and managed properly',
    checks: [
      'focus indicators are visible (min 3px)',
      'focus indicator contrast is 3:1',
      'focus trapped in modals',
      'focus restored after closing overlay',
      'focus order follows visual order',
      'focus visible on all interactive elements',
    ],
  },
  // Form Labels & Error Messages (WCAG 1.3.1, 3.3.1, 3.3.2)
  'form-labels': {
    level: 'A',
    description: 'Forms must have proper labels and error handling',
    checks: [
      'all form inputs have <label> elements',
      'labels properly associated with inputs',
      'error messages linked to inputs',
      'required fields marked as required',
      'error messages are descriptive',
      'form instructions are clear',
      'input validation feedback is accessible',
    ],
  },
  // Alt Text & Media (WCAG 1.1.1, 1.2.1)
  'media-alt-text': {
    level: 'A',
    description: 'Images and media need descriptive alt text',
    checks: [
      'all <img> tags have alt attribute',
      'alt text is descriptive (not "image" or "photo")',
      'decorative images have empty alt or role="presentation"',
      'videos have captions',
      'audio has transcripts',
      'SVGs have title/desc or aria-label',
      'background images conveying info have fallback',
    ],
  },
  // Semantic HTML (WCAG 1.3.1, 2.4.1)
  'semantic-html': {
    level: 'A',
    description: 'Use proper HTML elements for their semantic meaning',
    checks: [
      'proper heading hierarchy (h1-h6)',
      'buttons use <button> or role="button"',
      'links use <a> elements',
      'lists use <ul>/<ol>/<li>',
      'tables have proper structure (<thead>, <tbody>, <th>)',
      'navigation uses <nav>',
      'headers use <header>',
      'footers use <footer>',
      'main content uses <main>',
    ],
  },
};

class AccessibilityAudit {
  private issues: AccessibilityIssue[] = [];
  private componentResults: ComponentAuditResult[] = [];
  private currentComponent: string = '';
  private issueIdCounter: number = 0;

  /**
   * Main audit entry point - scans all components
   */
  async auditAllComponents(componentElements: Map<string, HTMLElement>): Promise<AuditSummary> {
    const results: ComponentAuditResult[] = [];

    for (const [componentName, element] of componentElements.entries()) {
      const result = await this.auditComponent(componentName, element);
      results.push(result);
    }

    return this.generateSummary(results);
  }

  /**
   * Audit a single component
   */
  async auditComponent(componentName: string, element: HTMLElement): Promise<ComponentAuditResult> {
    this.currentComponent = componentName;
    this.issues = [];

    // Run all audit checks
    this.checkAriaLabels(element);
    this.checkKeyboardNavigation(element);
    this.checkColorContrast(element);
    this.checkFocusManagement(element);
    this.checkFormLabels(element);
    this.checkMediaAltText(element);
    this.checkSemanticHtml(element);

    const passed = this.issues.filter((i) => i.severity !== 'error').length;
    const failed = this.issues.filter((i) => i.severity === 'error').length;
    const warnings = this.issues.filter((i) => i.severity === 'warning').length;
    const score = Math.max(0, 100 - (failed * 10 + warnings * 2));

    return {
      componentName,
      filePath: `src/components/${componentName}.tsx`,
      issues: this.issues,
      score,
      passed,
      failed,
      warnings,
      timestamp: new Date(),
    };
  }

  /**
   * Check ARIA labels and roles (WCAG 1.3.1, 1.4.3, 4.1.2)
   */
  private checkAriaLabels(element: HTMLElement): void {
    const interactiveElements = element.querySelectorAll(
      'button, [role="button"], input, [role="checkbox"], [role="radio"], [role="switch"], a, [role="link"], select, textarea'
    );

    interactiveElements.forEach((el: Element) => {
      const htmlEl = el as HTMLElement;
      const tagName = el.tagName.toLowerCase();
      const role = el.getAttribute('role');

      // Check for accessible label
      const hasAriaLabel = el.hasAttribute('aria-label');
      const hasAriaLabelledby = el.hasAttribute('aria-labelledby');
      const hasTextContent = htmlEl.textContent?.trim().length! > 0;
      const hasLabel = document.querySelector(`label[for="${el.id}"]`);
      const hasTitle = el.hasAttribute('title');

      const hasAccessibleName = hasAriaLabel || hasAriaLabelledby || hasTextContent || hasLabel || hasTitle;

      if (!hasAccessibleName && (tagName === 'button' || role === 'button' || tagName === 'a')) {
        this.addIssue({
          severity: 'error',
          category: 'aria',
          title: 'Missing accessible label for button/link',
          description: `${tagName === 'button' ? 'Button' : 'Link'} at ${this.getElementPath(htmlEl)} has no accessible name. Screen readers won't know its purpose.`,
          wcagLevel: 'WCAG 4.1.2 (A)',
          fix: 'Add aria-label, aria-labelledby, or visible text content. Example:\n<button aria-label="Close menu">×</button>\nor\n<button>Save Changes</button>',
          element: htmlEl,
        });
      }

      // Check for icon-only buttons
      if ((tagName === 'button' || role === 'button') && !hasTextContent && !hasAriaLabel) {
        this.addIssue({
          severity: 'error',
          category: 'aria',
          title: 'Icon-only button missing aria-label',
          description: `Icon button at ${this.getElementPath(htmlEl)} has no text or aria-label. Users won't understand its purpose.`,
          wcagLevel: 'WCAG 4.1.2 (A)',
          fix: 'Add aria-label to explain button purpose:\n<button aria-label="Settings" className="icon-btn">⚙️</button>',
          element: htmlEl,
        });
      }

      // Check role attribute for non-semantic elements
      if (!['button', 'a', 'input', 'select', 'textarea'].includes(tagName) && !el.hasAttribute('role')) {
        const isInteractive = htmlEl.onclick || el.hasAttribute('onclick');
        if (isInteractive) {
          this.addIssue({
            severity: 'warning',
            category: 'aria',
            title: 'Non-semantic interactive element missing role',
            description: `Element at ${this.getElementPath(htmlEl)} is interactive but doesn't use semantic HTML or role attribute.`,
            wcagLevel: 'WCAG 1.3.1 (A)',
            fix: 'Use semantic HTML or add role attribute:\nInstead of: <div onClick={...}>Click me</div>\nUse: <button onClick={...}>Click me</button>\nOr: <div role="button" onClick={...} onKeyPress={...}>Click me</div>',
            element: htmlEl,
          });
        }
      }
    });

    // Check for image alt text
    const images = element.querySelectorAll('img');
    images.forEach((img) => {
      const alt = img.getAttribute('alt');
      const isDecorative = img.getAttribute('role') === 'presentation' || img.getAttribute('aria-hidden') === 'true';

      if (!alt && !isDecorative) {
        this.addIssue({
          severity: 'error',
          category: 'media',
          title: 'Image missing alt text',
          description: `Image at ${this.getElementPath(img as HTMLElement)} has no alt attribute. Screen readers can't describe it.`,
          wcagLevel: 'WCAG 1.1.1 (A)',
          fix: 'Add descriptive alt text:\n<img src="chart.png" alt="Sales revenue by quarter chart" />\nFor decorative images:\n<img src="divider.png" alt="" />',
          element: img as HTMLElement,
        });
      } else if (alt === 'image' || alt === 'photo' || alt === 'picture') {
        this.addIssue({
          severity: 'warning',
          category: 'media',
          title: 'Alt text is too generic',
          description: `Image at ${this.getElementPath(img as HTMLElement)} has generic alt text: "${alt}". Users can't understand its content.`,
          wcagLevel: 'WCAG 1.1.1 (A)',
          fix: 'Provide descriptive alt text that explains the image purpose:\nGood: "Chart showing 2024 quarterly sales"',
          element: img as HTMLElement,
        });
      }
    });
  }

  /**
   * Check keyboard navigation (WCAG 2.1.1)
   */
  private checkKeyboardNavigation(element: HTMLElement): void {
    // Check for keyboard traps
    const tabbableElements = element.querySelectorAll(
      'button, [role="button"], input, select, textarea, a, [tabindex]:not([tabindex="-1"])'
    );

    // Check tab indices
    let maxTabIndex = 0;
    tabbableElements.forEach((el) => {
      const tabindex = parseInt(el.getAttribute('tabindex') || '0', 10);
      if (tabindex > 0) {
        maxTabIndex = Math.max(maxTabIndex, tabindex);
        if (tabindex > 32767) {
          this.addIssue({
            severity: 'error',
            category: 'keyboard',
            title: 'Invalid tabindex value',
            description: `Element at ${this.getElementPath(el as HTMLElement)} has invalid tabindex: ${tabindex}. Tabindex must be between 0-32767.`,
            wcagLevel: 'WCAG 2.1.1 (A)',
            fix: 'Remove tabindex or set to 0 or -1:\n<div tabindex="0">...</div>  // Focusable, natural order\n<div tabindex="-1">...</div>  // Not focusable',
            element: el as HTMLElement,
          });
        }
      }
    });

    if (maxTabIndex > 0) {
      this.addIssue({
        severity: 'warning',
        category: 'keyboard',
        title: 'Positive tabindex values detected',
        description: `Component uses positive tabindex values (${maxTabIndex}), which can disrupt natural focus order.`,
        wcagLevel: 'WCAG 2.1.1 (A)',
        fix: 'Avoid tabindex > 0. Use HTML semantic order (buttons, links, inputs) or tabindex="0" for custom elements.',
        element,
      });
    }

    // Check for click handlers without keyboard support
    const elementsWithClickHandlers = element.querySelectorAll('[onclick], [data-onclick]');
    elementsWithClickHandlers.forEach((el) => {
      const tagName = el.tagName.toLowerCase();
      if (!['button', 'a', 'input'].includes(tagName) && !el.hasAttribute('onkeypress') && !el.hasAttribute('onkeydown')) {
        this.addIssue({
          severity: 'error',
          category: 'keyboard',
          title: 'Click handler without keyboard support',
          description: `Element at ${this.getElementPath(el as HTMLElement)} has onClick but no keyboard handler. Keyboard users can't activate it.`,
          wcagLevel: 'WCAG 2.1.1 (A)',
          fix: 'Use semantic button or add keyboard handlers:\n<button onClick={handleClick}>...</button>\nOr:\n<div onClick={click} onKeyPress={keyPress} role="button" tabindex="0">...</div>',
          element: el as HTMLElement,
        });
      }
    });

    // Check for modal/overlay trap
    const modal = element.querySelector('[role="dialog"]');
    if (modal) {
      const focusableInModal = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusableInModal.length === 0) {
        this.addIssue({
          severity: 'error',
          category: 'keyboard',
          title: 'Modal/dialog with no focusable elements',
          description: 'Modal has no keyboard-navigable elements. Users can\'t interact with it.',
          wcagLevel: 'WCAG 2.1.1 (A)',
          fix: 'Add focusable elements (buttons, inputs) to modal and manage focus.',
          element: modal as HTMLElement,
        });
      }

      // Check if Escape closes modal
      if (!modal.hasAttribute('data-escape-closes') && !modal.querySelector('[data-escape-closes]')) {
        this.addIssue({
          severity: 'warning',
          category: 'keyboard',
          title: 'Modal doesn\'t mention Escape key for closing',
          description: 'Users expect Escape to close modals. No indication if this works.',
          wcagLevel: 'WCAG 2.1.1 (A)',
          fix: 'Implement Escape key handler:\nuseEffect(() => {\n  const handleEscape = (e) => e.key === "Escape" && onClose();\n  document.addEventListener("keydown", handleEscape);\n  return () => document.removeEventListener("keydown", handleEscape);\n}, []);',
          element: modal as HTMLElement,
        });
      }
    }
  }

  /**
   * Check color contrast (WCAG 1.4.3)
   */
  private checkColorContrast(element: HTMLElement): void {
    const textElements = element.querySelectorAll('p, span, div, button, a, label, h1, h2, h3, h4, h5, h6');

    textElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      if (!htmlEl.textContent?.trim()) return;

      const computedStyle = window.getComputedStyle(htmlEl);
      const color = computedStyle.color;
      const backgroundColor = computedStyle.backgroundColor;

      // Only check if both colors are defined
      if (color !== 'rgba(0, 0, 0, 0)' && backgroundColor !== 'rgba(0, 0, 0, 0)') {
        const contrast = this.getContrastRatio(color, backgroundColor);

        // Check if text is large (18pt/24px or 14pt/18.66px bold)
        const fontSize = parseFloat(computedStyle.fontSize);
        const fontWeight = computedStyle.fontWeight;
        const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && (fontWeight === 'bold' || parseInt(fontWeight) >= 700));

        const requiredContrast = isLargeText ? 3 : 4.5;

        if (contrast < requiredContrast && contrast > 0) {
          this.addIssue({
            severity: 'error',
            category: 'contrast',
            title: `Insufficient color contrast (${contrast.toFixed(2)}:1, need ${requiredContrast}:1)`,
            description: `Text at ${this.getElementPath(htmlEl)} has contrast ratio of ${contrast.toFixed(2)}:1. WCAG AA requires ${requiredContrast}:1 for ${isLargeText ? 'large' : 'normal'} text.`,
            wcagLevel: 'WCAG 1.4.3 (AA)',
            fix: `Increase contrast by:\n1. Darkening text color\n2. Lightening background color\n3. Current: color=${color}, background=${backgroundColor}`,
            element: htmlEl,
          });
        }
      }
    });

    // Check focus indicator contrast
    const interactiveElements = element.querySelectorAll('button, a, input, select, textarea, [tabindex="0"]');
    interactiveElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl, ':focus');
      const outline = style.outline || style.outlineColor;

      if (!outline || outline === 'none') {
        this.addIssue({
          severity: 'warning',
          category: 'contrast',
          title: 'Focus indicator has no outline',
          description: `Interactive element at ${this.getElementPath(htmlEl)} has no visible focus outline.`,
          wcagLevel: 'WCAG 2.4.7 (AA)',
          fix: 'Add focus styles:\nbutton:focus {\n  outline: 3px solid #4A90E2;\n  outline-offset: 2px;\n}',
          element: htmlEl,
        });
      }
    });
  }

  /**
   * Check focus management (WCAG 2.4.3, 2.4.7)
   */
  private checkFocusManagement(element: HTMLElement): void {
    const interactiveElements = element.querySelectorAll(
      'button, [role="button"], a, input, select, textarea, [tabindex="0"]'
    );

    let focusedCount = 0;
    interactiveElements.forEach((el) => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);

      // Check if focus visible
      const focusStyle = window.getComputedStyle(htmlEl, ':focus');
      const hasVisibleFocus = focusStyle.outline !== 'none' || focusStyle.boxShadow !== 'none';

      if (!hasVisibleFocus) {
        focusedCount++;
      }

      // Check if element is actually focusable
      const isFocusable = !htmlEl.hasAttribute('disabled') && htmlEl.offsetParent !== null;
      if (isFocusable && !hasVisibleFocus) {
        this.addIssue({
          severity: 'warning',
          category: 'focus',
          title: 'No visible focus indicator',
          description: `Element at ${this.getElementPath(htmlEl)} lacks visible focus indicator for keyboard navigation.`,
          wcagLevel: 'WCAG 2.4.7 (AA)',
          fix: 'Add focus styles:\n:focus {\n  outline: 3px solid currentColor;\n  outline-offset: 2px;\n}',
          element: htmlEl,
        });
      }
    });

    if (focusedCount > 5) {
      this.addIssue({
        severity: 'warning',
        category: 'focus',
        title: 'Many elements lack focus indicators',
        description: `${focusedCount} interactive elements don't have visible focus indicators. This makes keyboard navigation difficult.`,
        wcagLevel: 'WCAG 2.4.7 (AA)',
        fix: 'Add global focus styles in CSS:\n:focus-visible {\n  outline: 3px solid #4A90E2;\n  outline-offset: 2px;\n}',
        element,
      });
    }
  }

  /**
   * Check form labels and error messages (WCAG 1.3.1, 3.3.1, 3.3.2)
   */
  private checkFormLabels(element: HTMLElement): void {
    const inputs = element.querySelectorAll('input, select, textarea');

    inputs.forEach((input) => {
      const htmlInput = input as HTMLElement;
      const inputId = input.getAttribute('id');
      const inputName = input.getAttribute('name');
      const inputType = input.getAttribute('type');

      // Skip hidden and submit/button inputs
      if (inputType === 'hidden' || inputType === 'submit' || inputType === 'button') return;

      // Check for associated label
      let hasLabel = false;
      if (inputId) {
        hasLabel = !!document.querySelector(`label[for="${inputId}"]`);
      }

      const hasAriaLabel = input.hasAttribute('aria-label');
      const hasAriaLabelledby = input.hasAttribute('aria-labelledby');
      const hasPlaceholder = input.hasAttribute('placeholder');

      if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby) {
        this.addIssue({
          severity: 'error',
          category: 'form',
          title: 'Form input missing associated label',
          description: `Input at ${this.getElementPath(htmlInput)} has no <label> element, aria-label, or aria-labelledby.`,
          wcagLevel: 'WCAG 1.3.1 (A)',
          fix: 'Add label:\n<label htmlFor="email">Email Address:</label>\n<input id="email" type="email" />\nOr use aria-label:\n<input aria-label="Email Address" type="email" />',
          element: htmlInput,
        });
      }

      // Check for required indication
      const isRequired = input.hasAttribute('required') || input.getAttribute('aria-required') === 'true';
      if (isRequired) {
        const label = document.querySelector(`label[for="${inputId}"]`);
        if (label && !label.textContent?.includes('*') && !label.querySelector('[aria-label*="required"]')) {
          this.addIssue({
            severity: 'warning',
            category: 'form',
            title: 'Required field not visually marked',
            description: `Required field at ${this.getElementPath(htmlInput)} doesn't have visual indicator (usually *).`,
            wcagLevel: 'WCAG 3.3.2 (A)',
            fix: 'Add visual required indicator:\n<label htmlFor="email">Email Address: <span aria-label="required">*</span></label>',
            element: htmlInput,
          });
        }
      }

      // Check for error message
      const ariaDescribedBy = input.getAttribute('aria-describedby');
      const errorId = `${inputId || inputName}-error`;
      if (!ariaDescribedBy || !ariaDescribedBy.includes(errorId)) {
        // May have error state but no clear error message
        const isInvalid = input.hasAttribute('aria-invalid') && input.getAttribute('aria-invalid') === 'true';
        if (isInvalid) {
          this.addIssue({
            severity: 'warning',
            category: 'form',
            title: 'Invalid input without error message',
            description: `Input at ${this.getElementPath(htmlInput)} is marked invalid but has no aria-describedby linking to error message.`,
            wcagLevel: 'WCAG 3.3.1 (A)',
            fix: 'Link error message to input:\n<input aria-invalid="true" aria-describedby="email-error" />\n<div id="email-error">Email must be valid</div>',
            element: htmlInput,
          });
        }
      }
    });

    // Check for fieldsets with legends for grouped inputs
    const fieldsets = element.querySelectorAll('fieldset');
    fieldsets.forEach((fieldset) => {
      const legend = fieldset.querySelector('legend');
      if (!legend) {
        this.addIssue({
          severity: 'error',
          category: 'form',
          title: 'Fieldset missing legend',
          description: 'Form fieldset lacks <legend> to describe grouped inputs.',
          wcagLevel: 'WCAG 1.3.1 (A)',
          fix: 'Add legend to fieldset:\n<fieldset>\n  <legend>Shipping Address</legend>\n  ...\n</fieldset>',
          element: fieldset as HTMLElement,
        });
      }
    });
  }

  /**
   * Check media alt text (WCAG 1.1.1, 1.2.1)
   */
  private checkMediaAltText(element: HTMLElement): void {
    // Check SVGs
    const svgs = element.querySelectorAll('svg');
    svgs.forEach((svg) => {
      const hasTitle = svg.querySelector('title');
      const hasDesc = svg.querySelector('desc');
      const hasAriaLabel = svg.hasAttribute('aria-label');
      const isDecorative = svg.hasAttribute('aria-hidden') === 'true' || svg.hasAttribute('role') === 'presentation';

      if (!hasTitle && !hasDesc && !hasAriaLabel && !isDecorative) {
        this.addIssue({
          severity: 'warning',
          category: 'media',
          title: 'SVG lacks accessible description',
          description: `SVG at ${this.getElementPath(svg as HTMLElement)} has no title, desc, or aria-label.`,
          wcagLevel: 'WCAG 1.1.1 (A)',
          fix: 'Add SVG description:\n<svg aria-label="Company Logo">\n  <title>Transcend Logo</title>\n  ...\n</svg>',
          element: svg as HTMLElement,
        });
      }
    });

    // Check videos
    const videos = element.querySelectorAll('video');
    videos.forEach((video) => {
      const tracks = video.querySelectorAll('track[kind="captions"]');
      if (tracks.length === 0) {
        this.addIssue({
          severity: 'error',
          category: 'media',
          title: 'Video missing captions',
          description: 'Video lacks captions. Deaf and hard of hearing users can\'t access audio content.',
          wcagLevel: 'WCAG 1.2.1 (A)',
          fix: 'Add caption track:\n<video controls>\n  <source src="video.mp4" type="video/mp4">\n  <track kind="captions" src="captions.vtt" srclang="en" label="English">\n</video>',
          element: video as HTMLElement,
        });
      }

      // Check for audio description
      const hasAudioDesc = video.querySelectorAll('track[kind="descriptions"]').length > 0;
      if (!hasAudioDesc) {
        this.addIssue({
          severity: 'info',
          category: 'media',
          title: 'Video should have audio description',
          description: 'Video lacks audio description track for blind and low vision users.',
          wcagLevel: 'WCAG 1.2.5 (AA)',
          fix: 'Add audio description track:\n<track kind="descriptions" src="descriptions.vtt" srclang="en" label="English (audio description)">',
          element: video as HTMLElement,
        });
      }
    });

    // Check audio
    const audioElements = element.querySelectorAll('audio');
    audioElements.forEach((audio) => {
      // Audio needs transcript (not strictly in WCAG but good practice)
      const hasTranscript = element.querySelector('[data-transcript-for-audio]');
      if (!hasTranscript) {
        this.addIssue({
          severity: 'info',
          category: 'media',
          title: 'Audio should have transcript',
          description: 'Audio element lacks transcript for deaf users and search engines.',
          wcagLevel: 'Best Practice',
          fix: 'Provide transcript near audio:\n<p>Transcript: [Full text of audio content]</p>',
          element: audio as HTMLElement,
        });
      }
    });
  }

  /**
   * Check semantic HTML (WCAG 1.3.1, 2.4.1)
   */
  private checkSemanticHtml(element: HTMLElement): void {
    // Check heading hierarchy
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let lastLevel = 0;
    let h1Count = 0;

    headings.forEach((heading) => {
      const level = parseInt(heading.tagName[1], 10);

      if (level === 1) {
        h1Count++;
      }

      // Check for skipped heading levels
      if (level > lastLevel + 1 && lastLevel > 0) {
        this.addIssue({
          severity: 'warning',
          category: 'semantic',
          title: `Heading hierarchy skipped from h${lastLevel} to h${level}`,
          description: `Heading at ${this.getElementPath(heading as HTMLElement)} skips levels, disrupting document structure.`,
          wcagLevel: 'WCAG 1.3.1 (A)',
          fix: `Use sequential heading levels. Instead of h2 -> h4, use h2 -> h3 -> h4.`,
          element: heading as HTMLElement,
        });
      }

      lastLevel = level;
    });

    if (h1Count === 0) {
      this.addIssue({
        severity: 'warning',
        category: 'semantic',
        title: 'Page has no h1 heading',
        description: 'Component/page lacks h1 element. Each page should have one h1 to identify main topic.',
        wcagLevel: 'WCAG 1.3.1 (A)',
        fix: 'Add h1 to main component:\n<div>\n  <h1>Component Title</h1>\n  ...\n</div>',
        element,
      });
    }

    if (h1Count > 1) {
      this.addIssue({
        severity: 'info',
        category: 'semantic',
        title: `Multiple h1 elements found (${h1Count})`,
        description: 'Component has multiple h1s. Best practice is one h1 per page/component.',
        wcagLevel: 'Best Practice',
        fix: 'Use only one h1, other headings should be h2 or lower.',
        element,
      });
    }

    // Check for skip links
    const skipLink = element.querySelector('a[href="#main-content"]');
    if (!skipLink && element.querySelector('nav')) {
      this.addIssue({
        severity: 'info',
        category: 'semantic',
        title: 'Missing skip navigation link',
        description: 'Component with navigation lacks skip link to main content.',
        wcagLevel: 'Best Practice',
        fix: 'Add skip link at start of page:\n<a href="#main-content" className="skip-link">Skip to main content</a>\n<nav>...</nav>\n<main id="main-content">...</main>',
        element,
      });
    }

    // Check for proper list usage
    const fakeListLike = element.querySelectorAll('div[role="list"], div[role="listitem"]');
    if (fakeListLike.length > 0) {
      this.addIssue({
        severity: 'warning',
        category: 'semantic',
        title: 'List implemented with divs instead of semantic <ul>/<ol>',
        description: `Found ${fakeListLike.length} elements using role="list" or role="listitem" instead of semantic list elements.`,
        wcagLevel: 'WCAG 1.3.1 (A)',
        fix: 'Use semantic list elements:\nInstead of: <div role="list"><div role="listitem">Item 1</div></div>\nUse: <ul><li>Item 1</li></ul>',
        element,
      });
    }

    // Check table structure
    const tables = element.querySelectorAll('table');
    tables.forEach((table) => {
      const thead = table.querySelector('thead');
      const tbody = table.querySelector('tbody');
      const headers = table.querySelectorAll('th');

      if (!thead) {
        this.addIssue({
          severity: 'warning',
          category: 'semantic',
          title: 'Table lacks <thead>',
          description: 'Table should have <thead> to mark header rows for accessibility.',
          wcagLevel: 'WCAG 1.3.1 (A)',
          fix: 'Add proper table structure:\n<table>\n  <thead><tr><th>Header 1</th><th>Header 2</th></tr></thead>\n  <tbody><tr><td>Data 1</td><td>Data 2</td></tr></tbody>\n</table>',
          element: table as HTMLElement,
        });
      }

      if (headers.length === 0) {
        this.addIssue({
          severity: 'error',
          category: 'semantic',
          title: 'Table has no header cells (<th>)',
          description: 'Table lacks <th> elements to identify columns for screen reader users.',
          wcagLevel: 'WCAG 1.3.1 (A)',
          fix: 'Use <th> for headers:\n<table>\n  <tr><th>Name</th><th>Email</th></tr>\n  <tr><td>John</td><td>john@example.com</td></tr>\n</table>',
          element: table as HTMLElement,
        });
      }

      // Check for table caption or aria-label
      const caption = table.querySelector('caption');
      const label = table.getAttribute('aria-label');
      const labelledby = table.getAttribute('aria-labelledby');

      if (!caption && !label && !labelledby) {
        this.addIssue({
          severity: 'warning',
          category: 'semantic',
          title: 'Table lacks caption or label',
          description: 'Table has no caption or aria-label to describe its purpose.',
          wcagLevel: 'WCAG 1.3.1 (A)',
          fix: 'Add table caption:\n<table>\n  <caption>Sales Data by Region</caption>\n  ...\n</table>',
          element: table as HTMLElement,
        });
      }
    });
  }

  /**
   * Helper: Add issue with auto-generated ID
   */
  private addIssue(issue: Omit<AccessibilityIssue, 'id' | 'affectedElements'>): void {
    const id = `${this.currentComponent}-${this.issueIdCounter++}`;
    this.issues.push({
      ...issue,
      id,
      affectedElements: issue.element ? [this.getElementPath(issue.element)] : [],
    });
  }

  /**
   * Helper: Get element path for debugging
   */
  private getElementPath(element: HTMLElement): string {
    const path: string[] = [];
    let current: HTMLElement | null = element;

    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
      } else if (current.className) {
        const classes = (current.className as string)
          .split(' ')
          .filter((c) => c && !c.startsWith('sc-'))
          .slice(0, 2)
          .join('.');
        if (classes) selector += `.${classes}`;
      }

      path.unshift(selector);
      current = current.parentElement;
    }

    return path.slice(-3).join(' > ');
  }

  /**
   * Calculate contrast ratio between two colors
   */
  private getContrastRatio(foreground: string, background: string): number {
    const fgLum = this.getLuminance(this.parseColor(foreground));
    const bgLum = this.getLuminance(this.parseColor(background));

    const lighter = Math.max(fgLum, bgLum);
    const darker = Math.min(fgLum, bgLum);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Parse CSS color to RGB
   */
  private parseColor(colorStr: string): { r: number; g: number; b: number } {
    if (colorStr.startsWith('rgb')) {
      const match = colorStr.match(/\d+/g);
      if (match) {
        return { r: parseInt(match[0]), g: parseInt(match[1]), b: parseInt(match[2]) };
      }
    }
    // Default to black if can't parse
    return { r: 0, g: 0, b: 0 };
  }

  /**
   * Calculate relative luminance
   */
  private getLuminance(rgb: { r: number; g: number; b: number }): number {
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
      val = val / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Generate audit summary
   */
  private generateSummary(results: ComponentAuditResult[]): AuditSummary {
    const issuesByCategory: Record<string, number> = {};
    const issuesBySeverity: Record<string, number> = {};
    let totalIssues = 0;
    let totalScore = 0;

    results.forEach((result) => {
      totalIssues += result.issues.length;
      totalScore += result.score;

      result.issues.forEach((issue) => {
        issuesByCategory[issue.category] = (issuesByCategory[issue.category] || 0) + 1;
        issuesBySeverity[issue.severity] = (issuesBySeverity[issue.severity] || 0) + 1;
      });
    });

    return {
      totalComponents: results.length,
      totalIssues,
      issuesByCategory,
      issuesBySeverity,
      averageScore: results.length > 0 ? totalScore / results.length : 0,
      componentResults: results.sort((a, b) => a.score - b.score),
      generatedAt: new Date(),
    };
  }
}

// Export singleton instance
export const accessibilityAudit = new AccessibilityAudit();
