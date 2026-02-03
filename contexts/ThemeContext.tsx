'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Get the initial theme from localStorage (runs only on client)
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'system';

  try {
    const savedTheme = localStorage.getItem('theme') as Theme | null;
    if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
      return savedTheme;
    }
  } catch {
    // localStorage might not be available
  }
  return 'system';
}

// Get system preference
function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Resolve theme to light or dark
function resolveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return getSystemTheme();
  }
  return theme;
}

// Apply theme to document - uses both class and data attribute for reliability
function applyThemeToDocument(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const body = document.body;

  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
    // Also set on body for extra reliability
    body.classList.add('dark-mode');
    body.classList.remove('light-mode');
    body.setAttribute('data-theme', 'dark');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
    // Also set on body for extra reliability
    body.classList.add('light-mode');
    body.classList.remove('dark-mode');
    body.setAttribute('data-theme', 'light');
  }

  // Force a repaint on mobile Safari by triggering a transform
  // This is a known workaround for Safari CSS recalculation issues
  body.style.transform = 'translateZ(0)';
  requestAnimationFrame(() => {
    body.style.transform = '';
  });
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Initialize with a function to get the correct initial value
  const [theme, setThemeState] = useState<Theme>(() => getInitialTheme());
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(getInitialTheme()));
  const [mounted, setMounted] = useState(false);

  // Apply theme immediately on mount and when theme changes
  useEffect(() => {
    setMounted(true);
    const resolved = resolveTheme(theme);
    setResolvedTheme(resolved);
    applyThemeToDocument(resolved);
  }, [theme]);

  // Listen for system theme changes when in system mode
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = () => {
      const resolved = resolveTheme('system');
      setResolvedTheme(resolved);
      applyThemeToDocument(resolved);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);

    // Save to localStorage
    try {
      localStorage.setItem('theme', newTheme);
    } catch {
      // localStorage might not be available
    }

    // Apply immediately
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    applyThemeToDocument(resolved);
  }, []);

  // Force theme application after hydration with multiple retries
  // This ensures mobile Safari correctly applies the theme
  useEffect(() => {
    if (!mounted) return;

    const resolved = resolveTheme(theme);

    // Apply immediately
    applyThemeToDocument(resolved);

    // Use requestAnimationFrame for next paint cycle
    requestAnimationFrame(() => {
      applyThemeToDocument(resolved);
    });

    // Additional delayed application for mobile Safari quirks
    const timer1 = setTimeout(() => {
      applyThemeToDocument(resolved);
    }, 50);

    const timer2 = setTimeout(() => {
      applyThemeToDocument(resolved);
    }, 150);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [mounted, theme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
