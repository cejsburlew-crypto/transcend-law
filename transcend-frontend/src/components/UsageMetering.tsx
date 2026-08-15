// Usage Metering Dashboard
// Real-time usage tracking, cost estimation, alerts, and billing overview
// Mobile-first design with 44x44px touch targets

import React, { useState, useEffect, useCallback } from 'react';
import './UsageMetering.css';

// ============================================
// TYPES
// ============================================

interface UsageMetric {
  type: string;
  used: number;
  included: number;
  unit: string;
  percentage: number;
  trend?: 'up' | 'down' | 'stable';
}

interface CostAlert {
  id: string;
  type: 'usage_threshold' | 'cost_threshold' | 'overage_warning' | 'anomaly';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

interface ProjectedCost {
  currentMonth: number;
  projectedTotal: number;
  overage: number;
  baseCharge: number;
  discount: number;
  daysRemaining: number;
  confidenceLevel: 'low' | 'medium' | 'high';
}

interface MeteringProps {
  customerId?: string;
  onUpgrade?: () => void;
  onManageBilling?: () => void;
  readonly?: boolean;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_USAGE_METRICS: UsageMetric[] = [
  {
    type: 'Cases',
    used: 45,
    included: 50,
    unit: 'cases',
    percentage: 90,
    trend: 'up',
  },
  {
    type: 'Transactions',
    used: 1240,
    included: 1500,
    unit: 'transactions',
    percentage: 83,
    trend: 'down',
  },
  {
    type: 'API Calls',
    used: 8750,
    included: 10000,
    unit: 'API calls',
    percentage: 88,
    trend: 'stable',
  },
  {
    type: 'Documents',
    used: 320,
    included: 500,
    unit: 'documents',
    percentage: 64,
    trend: 'down',
  },
];

const MOCK_ALERTS: CostAlert[] = [
  {
    id: 'alert-1',
    type: 'usage_threshold',
    severity: 'warning',
    message: 'Cases usage at 90% of included limit',
    action: {
      label: 'View Options',
      href: '#upgrade',
    },
  },
  {
    id: 'alert-2',
    type: 'overage_warning',
    severity: 'info',
    message: 'API calls approaching limit. Projected overage: $25/month',
    action: {
      label: 'Learn More',
      href: '#overages',
    },
  },
];

const MOCK_PROJECTED_COST: ProjectedCost = {
  currentMonth: 1850,
  projectedTotal: 2145,
  overage: 145,
  baseCharge: 1800,
  discount: 95,
  daysRemaining: 17,
  confidenceLevel: 'high',
};

// ============================================
// COMPONENTS
// ============================================

const UsageBar: React.FC<{
  label: string;
  used: number;
  total: number;
  unit: string;
  percentage: number;
  trend?: 'up' | 'down' | 'stable';
  isOverage?: boolean;
}> = ({ label, used, total, unit, percentage, trend, isOverage }) => {
  const getTrendIcon = () => {
    if (!trend) return null;
    const icons: Record<string, string> = {
      up: '↗',
      down: '↘',
      stable: '→',
    };
    return icons[trend];
  };

  const getBarColorClass = () => {
    if (isOverage) return 'usage-bar-error';
    if (percentage > 90) return 'usage-bar-critical';
    if (percentage > 75) return 'usage-bar-warning';
    return 'usage-bar-normal';
  };

  return (
    <div className="usage-metric">
      <div className="usage-metric-header">
        <span className="usage-metric-label">{label}</span>
        <span className="usage-metric-trend" title={trend || ''}>
          {getTrendIcon()}
        </span>
      </div>
      <div className="usage-bar-container">
        <div className={`usage-bar ${getBarColorClass()}`} style={{ width: `${Math.min(percentage, 100)}%` }}>
          {percentage > 15 && <span className="usage-bar-text">{percentage}%</span>}
        </div>
        {percentage > 100 && (
          <div
            className="usage-bar-overage"
            style={{ width: `${Math.min(percentage - 100, 50)}%` }}
            title="Overage"
          />
        )}
      </div>
      <div className="usage-metric-details">
        <span className="usage-count">
          {used.toLocaleString()} / {total.toLocaleString()} {unit}
        </span>
        {isOverage && <span className="usage-overage-badge">Overage</span>}
      </div>
    </div>
  );
};

const AlertCard: React.FC<{
  alert: CostAlert;
  onDismiss?: (id: string) => void;
}> = ({ alert, onDismiss }) => {
  const getSeverityIcon = () => {
    const icons: Record<string, string> = {
      info: 'ℹ',
      warning: '⚠',
      critical: '🚨',
    };
    return icons[alert.severity];
  };

  return (
    <div className={`alert-card alert-${alert.severity}`}>
      <div className="alert-header">
        <span className="alert-icon">{getSeverityIcon()}</span>
        <p className="alert-message">{alert.message}</p>
        {onDismiss && (
          <button
            className="alert-dismiss-btn"
            onClick={() => onDismiss(alert.id)}
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        )}
      </div>
      {alert.action && (
        <div className="alert-action">
          {alert.action.href ? (
            <a href={alert.action.href} className="alert-action-link">
              {alert.action.label} →
            </a>
          ) : (
            <button className="alert-action-btn" onClick={alert.action.onClick}>
              {alert.action.label} →
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const CostProjection: React.FC<{ projection: ProjectedCost }> = ({ projection }) => {
  const dailyRate = (projection.projectedTotal - projection.currentMonth) / projection.daysRemaining || 0;

  return (
    <div className="cost-projection-card">
      <div className="projection-header">
        <h3>Monthly Cost Projection</h3>
        <div className={`confidence-badge confidence-${projection.confidenceLevel}`}>
          {projection.confidenceLevel.charAt(0).toUpperCase() + projection.confidenceLevel.slice(1)} confidence
        </div>
      </div>

      <div className="projection-grid">
        <div className="projection-item">
          <span className="projection-label">Current Month (to date)</span>
          <span className="projection-value">${projection.currentMonth.toFixed(2)}</span>
        </div>

        <div className="projection-item">
          <span className="projection-label">Projected Total</span>
          <span className="projection-value projection-total">${projection.projectedTotal.toFixed(2)}</span>
        </div>

        <div className="projection-item">
          <span className="projection-label">Base Charge</span>
          <span className="projection-value">${projection.baseCharge.toFixed(2)}</span>
        </div>

        <div className="projection-item">
          <span className="projection-label">Estimated Overage</span>
          <span className="projection-value projection-overage">
            ${projection.overage.toFixed(2)}
          </span>
        </div>

        {projection.discount > 0 && (
          <div className="projection-item">
            <span className="projection-label">Volume Discount</span>
            <span className="projection-value projection-discount">
              -${projection.discount.toFixed(2)}
            </span>
          </div>
        )}

        <div className="projection-item">
          <span className="projection-label">Daily Average</span>
          <span className="projection-value">${dailyRate.toFixed(2)}/day</span>
        </div>
      </div>

      <div className="projection-footer">
        <span className="projection-days">{projection.daysRemaining} days remaining in billing month</span>
      </div>
    </div>
  );
};

const UsageHistory: React.FC<{
  customerId?: string;
}> = ({ customerId }) => {
  const [history, setHistory] = useState<
    Array<{
      date: string;
      type: string;
      quantity: number;
      cost: number;
    }>
  >([
    {
      date: '2024-01-15',
      type: 'Case created',
      quantity: 1,
      cost: 35,
    },
    {
      date: '2024-01-14',
      type: 'Document upload',
      quantity: 5,
      cost: 5,
    },
    {
      date: '2024-01-12',
      type: 'Transaction',
      quantity: 15,
      cost: 22.5,
    },
  ]);

  return (
    <div className="usage-history">
      <h3 className="history-title">Recent Activity</h3>
      <div className="history-table-container">
        <table className="history-table" role="table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Activity</th>
              <th scope="col">Quantity</th>
              <th scope="col">Cost</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item, idx) => (
              <tr key={idx}>
                <td data-label="Date">{new Date(item.date).toLocaleDateString()}</td>
                <td data-label="Activity">{item.type}</td>
                <td data-label="Quantity" className="align-right">
                  {item.quantity}
                </td>
                <td data-label="Cost" className="align-right">
                  ${item.cost.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const UsageMetering: React.FC<MeteringProps> = ({
  customerId,
  onUpgrade,
  onManageBilling,
  readonly = false,
}) => {
  const [usageMetrics, setUsageMetrics] = useState<UsageMetric[]>(MOCK_USAGE_METRICS);
  const [alerts, setAlerts] = useState<CostAlert[]>(MOCK_ALERTS);
  const [projectedCost, setProjectedCost] = useState<ProjectedCost>(MOCK_PROJECTED_COST);
  const [expandedSection, setExpandedSection] = useState<string | null>('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Load usage data
  useEffect(() => {
    const loadUsageData = async () => {
      setIsLoading(true);
      try {
        // In production, fetch from API
        // const response = await fetch(`/api/usage/${customerId}`);
        // const data = await response.json();
        // setUsageMetrics(data.metrics);
        // setProjectedCost(data.projection);
      } catch (error) {
        console.error('Failed to load usage data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUsageData();
  }, [customerId]);

  const handleDismissAlert = useCallback((alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId));
  }, []);

  const handleExportData = (format: 'csv' | 'json' | 'pdf') => {
    // In production, call API to export
    console.log(`Exporting usage data as ${format}`);
    setShowExportMenu(false);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  // Calculate summary statistics
  const totalUsagePercentage =
    usageMetrics.reduce((acc, m) => acc + m.percentage, 0) / usageMetrics.length;
  const overageMetrics = usageMetrics.filter((m) => m.percentage > 100);

  return (
    <div className="usage-metering-container">
      <div className="metering-header">
        <div className="header-content">
          <h1 className="metering-title">Usage Dashboard</h1>
          <p className="metering-subtitle">Track your consumption and projected costs</p>
        </div>
        <div className="header-actions">
          <button
            className="action-btn refresh-btn"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="Refresh usage data"
            title="Refresh"
          >
            {isLoading ? '⟳' : '↻'}
          </button>
          <div className="export-dropdown">
            <button
              className="action-btn export-btn"
              onClick={() => setShowExportMenu(!showExportMenu)}
              aria-label="Export data"
            >
              ↓
            </button>
            {showExportMenu && (
              <div className="export-menu">
                <button onClick={() => handleExportData('json')}>
                  Export as JSON
                </button>
                <button onClick={() => handleExportData('csv')}>
                  Export as CSV
                </button>
                <button onClick={() => handleExportData('pdf')}>
                  Export as PDF
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          <div className="alerts-header">
            <h2>Active Alerts</h2>
            <span className="alert-count">{alerts.length}</span>
          </div>
          <div className="alerts-container">
            {alerts.map((alert) => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onDismiss={handleDismissAlert}
              />
            ))}
          </div>
        </div>
      )}

      {/* Overview Section */}
      <div className="overview-section">
        <button
          className="section-header-btn"
          onClick={() =>
            setExpandedSection(expandedSection === 'overview' ? null : 'overview')
          }
        >
          <h2>Usage Overview</h2>
          <span className="expand-icon">
            {expandedSection === 'overview' ? '▼' : '▶'}
          </span>
        </button>

        {expandedSection === 'overview' && (
          <div className="section-content">
            <div className="summary-stats">
              <div className="stat-card">
                <span className="stat-label">Overall Usage</span>
                <span className="stat-value">{totalUsagePercentage.toFixed(0)}%</span>
                <div className="stat-bar">
                  <div
                    className="stat-bar-fill"
                    style={{ width: `${Math.min(totalUsagePercentage, 100)}%` }}
                  />
                </div>
              </div>

              {overageMetrics.length > 0 && (
                <div className="stat-card alert-stat">
                  <span className="stat-label">Overages</span>
                  <span className="stat-value">{overageMetrics.length}</span>
                  <span className="stat-sublabel">
                    {overageMetrics.map((m) => m.type).join(', ')}
                  </span>
                </div>
              )}

              <div className="stat-card">
                <span className="stat-label">Current Month Cost</span>
                <span className="stat-value">${projectedCost.currentMonth.toFixed(2)}</span>
                <span className="stat-sublabel">
                  Projected: ${projectedCost.projectedTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="usage-metrics-list">
              {usageMetrics.map((metric) => (
                <UsageBar
                  key={metric.type}
                  label={metric.type}
                  used={metric.used}
                  total={metric.included}
                  unit={metric.unit}
                  percentage={metric.percentage}
                  trend={metric.trend}
                  isOverage={metric.percentage > 100}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cost Projection Section */}
      <div className="projection-section">
        <button
          className="section-header-btn"
          onClick={() =>
            setExpandedSection(expandedSection === 'projection' ? null : 'projection')
          }
        >
          <h2>Cost Projection</h2>
          <span className="expand-icon">
            {expandedSection === 'projection' ? '▼' : '▶'}
          </span>
        </button>

        {expandedSection === 'projection' && (
          <div className="section-content">
            <CostProjection projection={projectedCost} />

            {projectedCost.projectedTotal > projectedCost.baseCharge && !readonly && (
              <div className="action-bar">
                <p className="action-message">
                  Projected overage charges detected. Consider upgrading your plan.
                </p>
                <button className="action-primary-btn" onClick={onUpgrade}>
                  View Upgrade Options
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Usage History Section */}
      <div className="history-section">
        <button
          className="section-header-btn"
          onClick={() =>
            setExpandedSection(expandedSection === 'history' ? null : 'history')
          }
        >
          <h2>Recent Activity</h2>
          <span className="expand-icon">
            {expandedSection === 'history' ? '▼' : '▶'}
          </span>
        </button>

        {expandedSection === 'history' && (
          <div className="section-content">
            <UsageHistory customerId={customerId} />
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="help-section">
        <h3>Need Help?</h3>
        <div className="help-links">
          <a href="#faq" className="help-link">
            Understanding Usage
          </a>
          <a href="#pricing" className="help-link">
            Pricing Details
          </a>
          <a href="#contact" className="help-link">
            Contact Support
          </a>
        </div>
      </div>

      {!readonly && (
        <div className="footer-actions">
          <button
            className="action-secondary-btn"
            onClick={onManageBilling}
          >
            Manage Billing
          </button>
          <button
            className="action-primary-btn"
            onClick={onUpgrade}
          >
            Upgrade Plan
          </button>
        </div>
      )}
    </div>
  );
};

export default UsageMetering;
