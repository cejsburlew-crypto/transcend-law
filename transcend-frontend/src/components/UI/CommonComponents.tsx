// Shared UI components referenced through the `@/components/UI` barrel.
//
// AffiliateDashboard imported SecondaryButton, LoadingSpinner and StatCard,
// none of which existed - so that page never typechecked. Implemented here
// alongside the psychology-optimized set rather than duplicated per page.

import React from 'react';

const join = (...parts: Array<string | undefined>) => parts.filter(Boolean).join(' ');

export interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Text alternative to `children`, matching PrimaryButton's API. */
  label?: string;
  loading?: boolean;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
  label,
  loading = false,
  disabled,
  className,
  ...props
}) => (
  <button
    type={props.type ?? 'button'}
    className={join('btn-secondary', loading ? 'is-loading' : undefined, className)}
    disabled={disabled || loading}
    {...props}
  >
    {children ?? label}
  </button>
);

export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  label = 'Loading',
  className,
}) => (
  <div
    className={join('loading-spinner', `loading-spinner--${size}`, className)}
    role="status"
    aria-live="polite"
    aria-label={label}
  >
    <span className="loading-spinner__ring" aria-hidden="true" />
  </div>
);

/** Period-over-period movement, as the call sites express it. */
export interface StatTrend {
  /** Magnitude, e.g. 12 for "12%". */
  value: number;
  isPositive: boolean;
}

export interface StatCardProps {
  label: string;
  value: string | number;
  /** Pre-formatted change string, e.g. "+12%". */
  change?: string;
  trend?: StatTrend;
  /** Draws attention to a figure that needs action, e.g. a pending payout. */
  highlight?: boolean;
  icon?: React.ReactNode;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  change,
  trend,
  highlight = false,
  icon,
  className,
}) => {
  const direction = trend ? (trend.isPositive ? 'up' : 'down') : undefined;
  const changeText = change ?? (trend ? `${trend.isPositive ? '+' : '-'}${Math.abs(trend.value)}%` : undefined);

  return (
    <div className={join('stat-card', highlight ? 'stat-card--highlight' : undefined, className)}>
      {icon && <div className="stat-card__icon">{icon}</div>}
      <div className="stat-card__body">
        <div className="stat-card__label">{label}</div>
        <div className="stat-card__value">{value}</div>
        {changeText && (
          <div className={join('stat-card__change', direction ? `stat-card__change--${direction}` : undefined)}>
            {changeText}
          </div>
        )}
      </div>
    </div>
  );
};
