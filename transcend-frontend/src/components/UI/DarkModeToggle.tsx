/**
 * Dark Mode Toggle Component
 * Provides UI controls for theme selection (light, dark, system)
 * Can be integrated into settings, navbar, or sidebar
 */

import React from 'react';
import { useDarkMode } from '../../hooks/useDarkMode';
import styles from './DarkModeToggle.module.css';

interface DarkModeToggleProps {
  /**
   * Style variant: 'button' (default), 'switch', 'selector'
   */
  variant?: 'button' | 'switch' | 'selector';

  /**
   * Show labels
   */
  showLabel?: boolean;

  /**
   * Callback when theme changes
   */
  onChange?: (theme: 'light' | 'dark' | 'system') => void;

  /**
   * CSS class name
   */
  className?: string;
}

export const DarkModeToggle: React.FC<DarkModeToggleProps> = ({
  variant = 'button',
  showLabel = true,
  onChange,
  className,
}) => {
  const { theme, isDark, setTheme, toggle } = useDarkMode();

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme);
    onChange?.(newTheme);
  };

  const handleToggle = () => {
    toggle();
    onChange?.(isDark ? 'light' : 'dark');
  };

  if (variant === 'switch') {
    return (
      <div className={`${styles.switch} ${className || ''}`}>
        {showLabel && <label className={styles.label}>Dark Mode</label>}
        <button
          className={`${styles.switchButton} ${isDark ? styles.active : ''}`}
          onClick={handleToggle}
          aria-label="Toggle dark mode"
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span className={styles.switchTrack}>
            <span className={styles.switchThumb}>
              {isDark ? '🌙' : '☀️'}
            </span>
          </span>
        </button>
      </div>
    );
  }

  if (variant === 'selector') {
    return (
      <div className={`${styles.selector} ${className || ''}`}>
        {showLabel && <label className={styles.label}>Theme</label>}
        <div className={styles.buttonGroup}>
          <button
            className={`${styles.selectorButton} ${theme === 'light' ? styles.active : ''}`}
            onClick={() => handleThemeChange('light')}
            title="Light mode"
            aria-pressed={theme === 'light'}
          >
            ☀️ Light
          </button>
          <button
            className={`${styles.selectorButton} ${theme === 'dark' ? styles.active : ''}`}
            onClick={() => handleThemeChange('dark')}
            title="Dark mode"
            aria-pressed={theme === 'dark'}
          >
            🌙 Dark
          </button>
          <button
            className={`${styles.selectorButton} ${theme === 'system' ? styles.active : ''}`}
            onClick={() => handleThemeChange('system')}
            title="System preference"
            aria-pressed={theme === 'system'}
          >
            💻 System
          </button>
        </div>
      </div>
    );
  }

  // Default: button variant
  return (
    <button
      className={`${styles.button} ${className || ''}`}
      onClick={handleToggle}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? '☀️' : '🌙'}
      {showLabel && <span className={styles.label}>{isDark ? 'Light' : 'Dark'}</span>}
    </button>
  );
};

/**
 * Dark Mode Settings Panel Component
 * Comprehensive theme settings for user preferences
 */
export const DarkModeSettings: React.FC = () => {
  const { theme, isDark, preferredDarkMode, setTheme } = useDarkMode();

  return (
    <div className={styles.settingsPanel}>
      <h3>Appearance Settings</h3>

      <div className={styles.settingSection}>
        <label className={styles.settingLabel}>Theme Preference</label>
        <div className={styles.settingOptions}>
          <label className={styles.settingOption}>
            <input
              type="radio"
              name="theme"
              value="light"
              checked={theme === 'light'}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            />
            <span>Light Mode (Always)</span>
          </label>
          <label className={styles.settingOption}>
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={theme === 'dark'}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            />
            <span>Dark Mode (Always)</span>
          </label>
          <label className={styles.settingOption}>
            <input
              type="radio"
              name="theme"
              value="system"
              checked={theme === 'system'}
              onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
            />
            <span>System Preference</span>
          </label>
        </div>
      </div>

      <div className={styles.settingSection}>
        <label className={styles.settingLabel}>Current Status</label>
        <div className={styles.statusInfo}>
          <p>
            <strong>Selected Theme:</strong> {theme}
          </p>
          <p>
            <strong>Active Theme:</strong> {isDark ? 'Dark' : 'Light'}
          </p>
          <p>
            <strong>System Preference:</strong> {preferredDarkMode ? 'Dark' : 'Light'}
          </p>
        </div>
      </div>

      <div className={styles.settingSection}>
        <p className={styles.helpText}>
          When set to "System Preference", the theme automatically switches based on your operating
          system's dark mode setting. Light and dark selections override this preference.
        </p>
      </div>
    </div>
  );
};

export default DarkModeToggle;
