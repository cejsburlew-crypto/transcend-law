// Dark Mode Context - System preference + manual toggle support
// Supports system preference detection, manual override, persistent storage, smooth transitions

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type DarkModeTheme = 'light' | 'dark' | 'system';

interface DarkModeContextType {
  theme: DarkModeTheme;
  isDark: boolean;
  setTheme: (theme: DarkModeTheme) => void;
  toggle: () => void;
  preferredDarkMode: boolean; // user's system preference
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

export const DarkModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<DarkModeTheme>(() => {
    if (typeof window === 'undefined') return 'system';
    const saved = localStorage.getItem('theme') as DarkModeTheme | null;
    return saved || 'system';
  });

  const [preferredDarkMode, setPreferredDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const [isDark, setIsDark] = useState(false);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setPreferredDarkMode(e.matches);
      if (theme === 'system') {
        setIsDark(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Update isDark based on theme
  useEffect(() => {
    let newIsDark = false;

    if (theme === 'system') {
      newIsDark = preferredDarkMode;
    } else if (theme === 'dark') {
      newIsDark = true;
    } else {
      newIsDark = false;
    }

    setIsDark(newIsDark);

    // Apply to document
    if (newIsDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [theme, preferredDarkMode]);

  const setTheme = useCallback((newTheme: DarkModeTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  }, []);

  const toggle = useCallback(() => {
    setTheme(isDark ? 'light' : 'dark');
  }, [isDark, setTheme]);

  return (
    <DarkModeContext.Provider
      value={{
        theme,
        isDark,
        setTheme,
        toggle,
        preferredDarkMode,
      }}
    >
      {children}
    </DarkModeContext.Provider>
  );
};

export const useDarkMode = (): DarkModeContextType => {
  const context = useContext(DarkModeContext);
  if (!context) {
    throw new Error('useDarkMode must be used within DarkModeProvider');
  }
  return context;
};
