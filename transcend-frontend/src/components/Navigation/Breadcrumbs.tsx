// Breadcrumbs Navigation
// Sticky persistent navigation showing current page and back button

import React from 'react';
import LanguageSwitcher from './LanguageSwitcher';
import { DarkModeToggle } from '../UI/DarkModeToggle';
import './Breadcrumbs.css';

export interface BreadcrumbItem {
  label: string;
  icon?: string;
  onClick?: () => void;
  disabled?: boolean;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
}

export const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => {
  return (
    <nav className="breadcrumbs-nav">
      <div className="breadcrumbs-container">
        <ol className="breadcrumbs-list">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const isFirst = index === 0;

            return (
              <li key={index} className="breadcrumb-item">
                {isFirst && (
                  <span className="breadcrumb-home">
                    <button
                      className="breadcrumb-link home-btn"
                      onClick={item.onClick}
                      disabled={item.disabled}
                      aria-label="Home"
                    >
                      🏠
                    </button>
                  </span>
                )}

                {!isFirst && <span className="breadcrumb-separator">/</span>}

                {isLast ? (
                  <span className="breadcrumb-current">
                    {item.icon && <span className="breadcrumb-icon">{item.icon}</span>}
                    <span className="breadcrumb-text">{item.label}</span>
                  </span>
                ) : (
                  <button
                    className="breadcrumb-link"
                    onClick={item.onClick}
                    disabled={item.disabled}
                  >
                    {item.icon && <span className="breadcrumb-icon">{item.icon}</span>}
                    <span className="breadcrumb-text">{item.label}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ol>

        <div className="breadcrumb-actions">
          <DarkModeToggle variant="button" showLabel={false} />
          <LanguageSwitcher />
          {items.length > 1 && (
            <button
              className="back-btn"
              onClick={items[items.length - 2]?.onClick}
              disabled={items[items.length - 2]?.disabled}
              aria-label="Go back"
              title="Go back"
            >
              ← Back
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Breadcrumbs;
