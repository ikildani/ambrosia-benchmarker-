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

// Apply theme to document - uses classes, data attributes, and CSS custom properties
function applyThemeToDocument(resolved: 'light' | 'dark') {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const body = document.body;

  if (resolved === 'dark') {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';
    // Set CSS custom properties for theme
    root.style.setProperty('--page-bg', 'linear-gradient(to bottom right, #0f172a, #0f172a, #1e293b)');
    root.style.setProperty('--header-bg', 'rgba(15, 23, 42, 0.95)');
    root.style.setProperty('--header-border', 'rgba(51, 65, 85, 0.8)');
    root.style.setProperty('--card-bg', '#1e293b');
    root.style.setProperty('--card-border', '#334155');
    root.style.setProperty('--text-primary', '#f1f5f9');
    root.style.setProperty('--text-secondary', '#94a3b8');
    body.classList.add('dark-mode');
    body.classList.remove('light-mode');
  } else {
    root.classList.remove('dark');
    root.classList.add('light');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
    // Set CSS custom properties for theme
    root.style.setProperty('--page-bg', 'linear-gradient(to bottom right, #f8fafc, #ffffff, rgba(240, 253, 250, 0.2))');
    root.style.setProperty('--header-bg', 'rgba(255, 255, 255, 0.95)');
    root.style.setProperty('--header-border', 'rgba(226, 232, 240, 0.8)');
    root.style.setProperty('--card-bg', '#ffffff');
    root.style.setProperty('--card-border', '#e2e8f0');
    root.style.setProperty('--text-primary', '#0f172a');
    root.style.setProperty('--text-secondary', '#64748b');
    body.classList.add('light-mode');
    body.classList.remove('dark-mode');
  }

  // Force a repaint on mobile Safari
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
