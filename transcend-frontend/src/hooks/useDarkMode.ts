// Dark Mode Hook - Convenience wrapper for DarkModeContext
// Provides theme management with system preference detection

import { useDarkMode as useDarkModeContext } from '../context/DarkModeContext';

/**
 * Hook for accessing dark mode state and functions
 * Must be used within DarkModeProvider
 *
 * @returns {Object} Dark mode context with theme, isDark, setTheme, toggle functions
 *
 * @example
 * const { isDark, toggle } = useDarkMode();
 * return <button onClick={toggle}>{isDark ? 'Light' : 'Dark'}</button>
 */
export const useDarkMode = useDarkModeContext;

/**
 * Helper hook to get current theme
 *
 * @returns {string} Current theme: 'light', 'dark', or 'system'
 */
export const useCurrentTheme = () => {
  const { theme } = useDarkModeContext();
  return theme;
};

/**
 * Helper hook to check if dark mode is active
 *
 * @returns {boolean} True if dark mode is currently active
 */
export const useIsDark = () => {
  const { isDark } = useDarkModeContext();
  return isDark;
};

/**
 * Helper hook to set a specific theme
 *
 * @returns {Function} Function to set theme ('light', 'dark', or 'system')
 */
export const useSetTheme = () => {
  const { setTheme } = useDarkModeContext();
  return setTheme;
};

/**
 * Helper hook to toggle between light and dark mode
 *
 * @returns {Function} Function to toggle dark mode
 */
export const useToggleDarkMode = () => {
  const { toggle } = useDarkModeContext();
  return toggle;
};

/**
 * Helper hook to get system preference
 *
 * @returns {boolean} True if system prefers dark mode
 */
export const useSystemPreference = () => {
  const { preferredDarkMode } = useDarkModeContext();
  return preferredDarkMode;
};

export default useDarkMode;
