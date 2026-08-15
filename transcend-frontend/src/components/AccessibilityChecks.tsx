/**
 * Accessibility Audit Results & Recommendations Component
 * WCAG 2.1 AA Compliance Dashboard
 * Displays audit results, issues, severity levels, and actionable fixes for components
 */

import React, { useState, useEffect } from 'react';
import {
  AccessibilityIssue,
  ComponentAuditResult,
  AuditSummary,
  accessibilityAudit,
} from '../accessibility/audit';

interface AccessibilityChecksProps {
  components?: Map<string, HTMLElement>;
  onIssueSelected?: (issue: AccessibilityIssue) => void;
  autoRunAudit?: boolean;
  showSummaryOnly?: boolean;
}

interface FilterState {
  severity: 'all' | 'error' | 'warning' | 'info';
  category: 'all' | 'aria' | 'keyboard' | 'contrast' | 'focus' | 'form' | 'media' | 'semantic';
  component: string;
}

const SEVERITY_LEVELS = {
  error: { icon: '🔴', label: 'Error', color: '#e74c3c', description: 'Violates WCAG requirement' },
  warning: { icon: '🟡', label: 'Warning', color: '#f39c12', description: 'May reduce accessibility' },
  info: { icon: '🔵', label: 'Info', color: '#3498db', description: 'Best practice recommendation' },
};

const CATEGORIES = {
  aria: { icon: '📝', label: 'ARIA Labels', description: 'Screen reader support' },
  keyboard: { icon: '⌨️', label: 'Keyboard Nav', description: 'Keyboard accessibility' },
  contrast: { icon: '🎨', label: 'Contrast', description: 'Color contrast ratios' },
  focus: { icon: '👁️', label: 'Focus', description: 'Focus management' },
  form: { icon: '📋', label: 'Forms', description: 'Form labels & errors' },
  media: { icon: '🎬', label: 'Media', description: 'Alt text & captions' },
  semantic: { icon: '🏗️', label: 'Semantic', description: 'HTML structure' },
};

export const AccessibilityChecks: React.FC<AccessibilityChecksProps> = ({
  components,
  onIssueSelected,
  autoRunAudit = true,
  showSummaryOnly = false,
}) => {
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<ComponentAuditResult | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    severity: 'all',
    category: 'all',
    component: 'all',
  });
  const [loading, setLoading] = useState(false);
  const [expandedIssue, setExpandedIssue] = useState<string | null>(null);
  const [appliedFixes, setAppliedFixes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (autoRunAudit && components) {
      runAudit();
    }
  }, [autoRunAudit, components]);

  const runAudit = async () => {
    setLoading(true);
    try {
      if (!components) return;
      const auditSummary = await accessibilityAudit.auditAllComponents(components);
      setSummary(auditSummary);
      if (auditSummary.componentResults.length > 0) {
        setSelectedComponent(auditSummary.componentResults[0]);
      }
    } catch (error) {
      console.error('Audit failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredIssues = (): AccessibilityIssue[] => {
    if (!selectedComponent) return [];

    return selectedComponent.issues.filter((issue) => {
      if (filters.severity !== 'all' && issue.severity !== filters.severity) return false;
      if (filters.category !== 'all' && issue.category !== filters.category) return false;
      return true;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="accessibility-checks loading">
        <div className="spinner"></div>
        <p>Running accessibility audit...</p>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="accessibility-checks error">
        <p>No audit data available. Run audit to scan components.</p>
        <button onClick={runAudit} className="btn-primary">
          Run Audit Now
        </button>
      </div>
    );
  }

  const filteredIssues = getFilteredIssues();
  const overallScore = Math.round(summary.averageScore);

  return (
    <div className="accessibility-checks" role="main" aria-label="Accessibility Audit Results">
      {/* Summary Dashboard */}
      <section className="audit-summary" aria-labelledby="summary-heading">
        <h1 id="summary-heading">WCAG 2.1 AA Accessibility Audit</h1>

        <div className="summary-grid">
          <div className="summary-card">
            <div className="score-display">
              <div className={`score-value ${overallScore >= 80 ? 'good' : overallScore >= 60 ? 'fair' : 'poor'}`}>
                {overallScore}
              </div>
              <div className="score-label">Overall Score</div>
            </div>
          </div>

          <div className="summary-card">
            <div className="stat-block">
              <div className="stat-number">{summary.totalComponents}</div>
              <div className="stat-label">Components Audited</div>
            </div>
          </div>

          <div className="summary-card">
            <div className="stat-block">
              <div className="stat-number" style={{ color: SEVERITY_LEVELS.error.color }}>
                {summary.issuesBySeverity.error || 0}
              </div>
              <div className="stat-label">Critical Issues</div>
            </div>
          </div>

          <div className="summary-card">
            <div className="stat-block">
              <div className="stat-number" style={{ color: SEVERITY_LEVELS.warning.color }}>
                {summary.issuesBySeverity.warning || 0}
              </div>
              <div className="stat-label">Warnings</div>
            </div>
          </div>

          <div className="summary-card">
            <div className="stat-block">
              <div className="stat-number">{summary.totalIssues}</div>
              <div className="stat-label">Total Issues</div>
            </div>
          </div>
        </div>

        {/* Issues by Category */}
        <div className="issues-by-category">
          <h2>Issues by Category</h2>
          <div className="category-breakdown">
            {Object.entries(CATEGORIES).map(([key, category]) => {
              const count = summary.issuesByCategory[key] || 0;
              return (
                <div key={key} className="category-item" title={category.description}>
                  <span className="category-icon">{category.icon}</span>
                  <span className="category-name">{category.label}</span>
                  <span className={`category-count ${count > 0 ? 'has-issues' : 'clear'}`}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {!showSummaryOnly && (
        <>
          {/* Component Selector */}
          <section className="component-selector" aria-labelledby="component-heading">
            <h2 id="component-heading">Components</h2>
            <div className="component-list">
              {summary.componentResults.map((result) => (
                <button
                  key={result.componentName}
                  className={`component-item ${selectedComponent?.componentName === result.componentName ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedComponent(result);
                    setExpandedIssue(null);
                  }}
                  aria-pressed={selectedComponent?.componentName === result.componentName}
                >
                  <span className="component-name">{result.componentName}</span>
                  <span className={`component-score ${result.score >= 80 ? 'good' : result.score >= 60 ? 'fair' : 'poor'}`}>
                    {Math.round(result.score)}
                  </span>
                  {result.failed > 0 && (
                    <span
                      className="issue-badge error"
                      title={`${result.failed} critical issue${result.failed !== 1 ? 's' : ''}`}
                    >
                      {result.failed}
                    </span>
                  )}
                  {result.warnings > 0 && (
                    <span
                      className="issue-badge warning"
                      title={`${result.warnings} warning${result.warnings !== 1 ? 's' : ''}`}
                    >
                      {result.warnings}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Filters */}
          <section className="filters" aria-labelledby="filter-heading">
            <h2 id="filter-heading">Filter Issues</h2>
            <div className="filter-group">
              <label htmlFor="severity-filter">Severity:</label>
              <select
                id="severity-filter"
                value={filters.severity}
                onChange={(e) => setFilters({ ...filters, severity: e.target.value as any })}
                aria-label="Filter by severity level"
              >
                <option value="all">All Issues</option>
                <option value="error">Critical Only</option>
                <option value="warning">Warnings Only</option>
                <option value="info">Info Only</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="category-filter">Category:</label>
              <select
                id="category-filter"
                value={filters.category}
                onChange={(e) => setFilters({ ...filters, category: e.target.value as any })}
                aria-label="Filter by issue category"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORIES).map(([key, category]) => (
                  <option key={key} value={key}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-info">
              Showing {filteredIssues.length} of {selectedComponent?.issues.length || 0} issues
            </div>
          </section>

          {/* Issues List */}
          <section className="issues-list" aria-labelledby="issues-heading">
            <h2 id="issues-heading">
              {selectedComponent?.componentName || 'Select a component'} - Issues
            </h2>

            {filteredIssues.length === 0 ? (
              <div className="no-issues">
                <p>✓ No issues found with current filters!</p>
              </div>
            ) : (
              <div className="issues">
                {filteredIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`issue-item ${issue.severity} ${expandedIssue === issue.id ? 'expanded' : ''}`}
                    role="article"
                    aria-expanded={expandedIssue === issue.id}
                  >
                    <div
                      className="issue-header"
                      onClick={() => setExpandedIssue(expandedIssue === issue.id ? null : issue.id)}
                      role="button"
                      tabIndex={0}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setExpandedIssue(expandedIssue === issue.id ? null : issue.id);
                        }
                      }}
                      aria-label={`${SEVERITY_LEVELS[issue.severity].label}: ${issue.title}`}
                    >
                      <span className="issue-severity" title={SEVERITY_LEVELS[issue.severity].description}>
                        {SEVERITY_LEVELS[issue.severity].icon}
                      </span>

                      <div className="issue-title-block">
                        <h3 className="issue-title">{issue.title}</h3>
                        <p className="issue-wcag">
                          <span className="wcag-level">{issue.wcagLevel}</span>
                          {' • '}
                          <span className="category-tag">{CATEGORIES[issue.category].label}</span>
                        </p>
                      </div>

                      <span className="expand-icon">{expandedIssue === issue.id ? '▼' : '▶'}</span>
                    </div>

                    {expandedIssue === issue.id && (
                      <div className="issue-details">
                        <div className="detail-section">
                          <h4>Problem</h4>
                          <p>{issue.description}</p>
                        </div>

                        <div className="detail-section">
                          <h4>Solution</h4>
                          <div className="fix-code">
                            <pre>{issue.fix}</pre>
                            <button
                              className="copy-btn"
                              onClick={() => copyToClipboard(issue.fix)}
                              aria-label="Copy code to clipboard"
                              title="Copy fix to clipboard"
                            >
                              📋 Copy
                            </button>
                          </div>
                        </div>

                        {issue.affectedElements && issue.affectedElements.length > 0 && (
                          <div className="detail-section">
                            <h4>Affected Elements</h4>
                            <ul className="affected-list">
                              {issue.affectedElements.map((el, idx) => (
                                <li key={idx}>
                                  <code>{el}</code>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="issue-actions">
                          <button
                            className={`btn-mark-fixed ${appliedFixes.has(issue.id) ? 'done' : ''}`}
                            onClick={() => {
                              const newFixed = new Set(appliedFixes);
                              if (newFixed.has(issue.id)) {
                                newFixed.delete(issue.id);
                              } else {
                                newFixed.add(issue.id);
                              }
                              setAppliedFixes(newFixed);
                            }}
                            aria-pressed={appliedFixes.has(issue.id)}
                          >
                            {appliedFixes.has(issue.id) ? '✓ Fixed' : 'Mark as Fixed'}
                          </button>

                          {onIssueSelected && (
                            <button
                              className="btn-locate"
                              onClick={() => onIssueSelected(issue)}
                              title="Navigate to element in code"
                            >
                              Locate Element
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Guidelines Reference */}
      <section className="wcag-reference" aria-labelledby="wcag-heading">
        <h2 id="wcag-heading">WCAG 2.1 AA Guidelines</h2>
        <details>
          <summary>WCAG Quick Reference</summary>
          <div className="wcag-details">
            <div className="guideline">
              <h3>1. Perceivable</h3>
              <ul>
                <li>1.1.1 - All images must have alt text</li>
                <li>1.4.3 - Text contrast must be 4.5:1 (or 3:1 for large text)</li>
              </ul>
            </div>

            <div className="guideline">
              <h3>2. Operable</h3>
              <ul>
                <li>2.1.1 - All functionality must be keyboard accessible</li>
                <li>2.4.3 - Focus order must be logical</li>
                <li>2.4.7 - Focus visible for all interactive elements</li>
              </ul>
            </div>

            <div className="guideline">
              <h3>3. Understandable</h3>
              <ul>
                <li>3.1.1 - Language of page specified</li>
                <li>3.3.1 - Error messages must be clear</li>
                <li>3.3.2 - Required fields must be marked</li>
              </ul>
            </div>

            <div className="guideline">
              <h3>4. Robust</h3>
              <ul>
                <li>4.1.1 - Valid HTML without errors</li>
                <li>4.1.2 - All UI components have proper ARIA roles/labels</li>
              </ul>
            </div>
          </div>
        </details>
      </section>

      {/* Reporting */}
      <section className="audit-actions">
        <button
          onClick={runAudit}
          className="btn-primary"
          disabled={loading}
          aria-label="Run accessibility audit again"
        >
          {loading ? 'Running...' : 'Re-run Audit'}
        </button>

        <button
          onClick={() => {
            const report = JSON.stringify(summary, null, 2);
            const blob = new Blob([report], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `accessibility-audit-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
          }}
          className="btn-secondary"
          aria-label="Download accessibility audit report"
        >
          📥 Download Report
        </button>

        <button
          onClick={() => {
            const text = `Accessibility Audit Summary\n\nDate: ${summary.generatedAt.toLocaleString()}\nComponents: ${summary.totalComponents}\nTotal Issues: ${summary.totalIssues}\nAverage Score: ${Math.round(summary.averageScore)}/100\n\nIssues by Severity:\n${Object.entries(summary.issuesBySeverity)
              .map(([k, v]) => `  ${k}: ${v}`)
              .join('\n')}\n\nIssues by Category:\n${Object.entries(summary.issuesByCategory)
              .map(([k, v]) => `  ${k}: ${v}`)
              .join('\n')}`;
            copyToClipboard(text);
          }}
          className="btn-secondary"
          aria-label="Copy summary to clipboard"
        >
          📋 Copy Summary
        </button>
      </section>

      <style>{`
        .accessibility-checks {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          padding: 24px;
          background: #f5f5f5;
          border-radius: 8px;
          margin: 16px 0;
        }

        .accessibility-checks.loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 300px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 4px solid #ddd;
          border-top: 4px solid #4A90E2;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .accessibility-checks h1 {
          margin: 0 0 24px;
          color: #333;
          font-size: 24px;
        }

        .accessibility-checks h2 {
          margin: 24px 0 16px;
          color: #555;
          font-size: 18px;
          border-bottom: 2px solid #e0e0e0;
          padding-bottom: 8px;
        }

        .accessibility-checks h3 {
          margin: 0 0 8px;
          color: #666;
          font-size: 16px;
        }

        .summary-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .summary-card {
          background: white;
          padding: 16px;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .score-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .score-value {
          font-size: 48px;
          font-weight: bold;
          margin-bottom: 8px;
          border-radius: 50%;
          width: 100px;
          height: 100px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .score-value.good { background: #27ae60; }
        .score-value.fair { background: #f39c12; }
        .score-value.poor { background: #e74c3c; }

        .stat-block {
          text-align: center;
        }

        .stat-number {
          font-size: 32px;
          font-weight: bold;
          color: #4A90E2;
          margin-bottom: 8px;
        }

        .stat-label {
          font-size: 14px;
          color: #999;
        }

        .category-breakdown {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
        }

        .category-item {
          background: white;
          padding: 12px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .category-item:hover {
          transform: translateY(-2px);
        }

        .category-icon {
          font-size: 20px;
        }

        .category-name {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
        }

        .category-count {
          background: #e0e0e0;
          color: #666;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
        }

        .category-count.has-issues {
          background: #e74c3c;
          color: white;
        }

        .category-count.clear {
          background: #27ae60;
          color: white;
        }

        .component-list {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 12px;
          margin-bottom: 24px;
        }

        .component-item {
          background: white;
          padding: 12px;
          border: 2px solid #e0e0e0;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
        }

        .component-item:hover {
          border-color: #4A90E2;
          box-shadow: 0 2px 8px rgba(74, 144, 226, 0.2);
        }

        .component-item.active {
          background: #4A90E2;
          color: white;
          border-color: #4A90E2;
        }

        .component-name {
          flex: 1;
          font-size: 14px;
          font-weight: 500;
        }

        .component-score {
          background: rgba(0,0,0,0.1);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
        }

        .component-score.good { background: #27ae60; color: white; }
        .component-score.fair { background: #f39c12; color: white; }
        .component-score.poor { background: #e74c3c; color: white; }

        .issue-badge {
          background: #e74c3c;
          color: white;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          font-weight: bold;
        }

        .issue-badge.warning {
          background: #f39c12;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .filter-group label {
          font-weight: 500;
          min-width: 80px;
        }

        .filter-group select {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
        }

        .filters {
          background: white;
          padding: 16px;
          border-radius: 6px;
          margin-bottom: 24px;
        }

        .filter-info {
          font-size: 12px;
          color: #999;
          margin-top: 12px;
        }

        .issues {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .issue-item {
          background: white;
          border-left: 4px solid #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
          transition: all 0.2s;
        }

        .issue-item.error {
          border-left-color: #e74c3c;
        }

        .issue-item.warning {
          border-left-color: #f39c12;
        }

        .issue-item.info {
          border-left-color: #3498db;
        }

        .issue-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          cursor: pointer;
          user-select: none;
        }

        .issue-header:hover {
          background: #f9f9f9;
        }

        .issue-severity {
          font-size: 20px;
          flex-shrink: 0;
        }

        .issue-title-block {
          flex: 1;
        }

        .issue-title {
          margin: 0 0 4px;
          color: #333;
          font-size: 15px;
          font-weight: 600;
        }

        .issue-wcag {
          margin: 0;
          font-size: 12px;
          color: #999;
        }

        .wcag-level {
          background: #f0f0f0;
          padding: 2px 6px;
          border-radius: 3px;
          font-weight: 500;
        }

        .category-tag {
          background: #e8f4f8;
          padding: 2px 6px;
          border-radius: 3px;
          color: #4A90E2;
          font-weight: 500;
        }

        .expand-icon {
          flex-shrink: 0;
          color: #999;
          transition: transform 0.2s;
        }

        .issue-item.expanded .expand-icon {
          transform: rotate(90deg);
        }

        .issue-details {
          background: #f9f9f9;
          padding: 16px;
          border-top: 1px solid #e0e0e0;
        }

        .detail-section {
          margin-bottom: 16px;
        }

        .detail-section:last-child {
          margin-bottom: 0;
        }

        .detail-section h4 {
          margin: 0 0 8px;
          color: #555;
          font-size: 14px;
          font-weight: 600;
        }

        .detail-section p {
          margin: 0;
          color: #666;
          font-size: 14px;
          line-height: 1.5;
        }

        .fix-code {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 4px;
          overflow: hidden;
          position: relative;
        }

        .fix-code pre {
          margin: 0;
          padding: 12px;
          font-family: 'Monaco', 'Courier New', monospace;
          font-size: 12px;
          line-height: 1.5;
          color: #333;
          background: white;
          overflow-x: auto;
        }

        .copy-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          padding: 6px 12px;
          background: #4A90E2;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: background 0.2s;
        }

        .copy-btn:hover {
          background: #357abd;
        }

        .affected-list {
          margin: 0;
          padding: 0 0 0 20px;
        }

        .affected-list li {
          margin-bottom: 4px;
          color: #666;
        }

        .affected-list code {
          background: #f0f0f0;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 12px;
          color: #e74c3c;
          font-family: 'Monaco', 'Courier New', monospace;
        }

        .issue-actions {
          display: flex;
          gap: 8px;
          margin-top: 12px;
        }

        .btn-mark-fixed,
        .btn-locate {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s;
          background: white;
          color: #333;
        }

        .btn-mark-fixed:hover,
        .btn-locate:hover {
          border-color: #4A90E2;
          background: #f0f7ff;
        }

        .btn-mark-fixed.done {
          background: #27ae60;
          color: white;
          border-color: #27ae60;
        }

        .no-issues {
          background: white;
          padding: 24px;
          border-radius: 6px;
          text-align: center;
          color: #27ae60;
          font-size: 16px;
          font-weight: 500;
        }

        .wcag-reference details {
          background: white;
          padding: 12px;
          border-radius: 6px;
          cursor: pointer;
        }

        .wcag-details {
          margin-top: 12px;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 12px;
        }

        .guideline {
          background: #f9f9f9;
          padding: 12px;
          border-radius: 4px;
        }

        .guideline h3 {
          margin: 0 0 8px;
          color: #4A90E2;
          font-size: 14px;
        }

        .guideline ul {
          margin: 0;
          padding: 0 0 0 16px;
          font-size: 12px;
        }

        .guideline li {
          margin-bottom: 4px;
          color: #666;
        }

        .audit-actions {
          display: flex;
          gap: 12px;
          margin-top: 24px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .btn-primary,
        .btn-secondary {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
          font-size: 14px;
        }

        .btn-primary {
          background: #4A90E2;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #357abd;
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: white;
          color: #4A90E2;
          border: 1px solid #4A90E2;
        }

        .btn-secondary:hover {
          background: #f0f7ff;
        }

        @media (max-width: 768px) {
          .accessibility-checks {
            padding: 16px;
          }

          .summary-grid {
            grid-template-columns: 1fr;
          }

          .component-list {
            grid-template-columns: 1fr;
          }

          .category-breakdown {
            grid-template-columns: repeat(2, 1fr);
          }

          .wcag-details {
            grid-template-columns: 1fr;
          }

          .filter-group {
            flex-direction: column;
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
};

export default AccessibilityChecks;
