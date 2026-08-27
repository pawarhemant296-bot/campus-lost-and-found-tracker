import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { buildMuiTheme } from '../theme/muiTheme.js';

const STORAGE_KEY = 'lf_theme';
const ThemeContext = createContext(null);

function initialMode() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  // Dark is the product default. The OS preference is deliberately ignored:
  // most systems report "light", which would hide the intended look. Once the
  // user flips the switch their choice is remembered forever.
  return 'dark';
}

/**
 * Single source of truth for the colour scheme. Drives both the CSS variables
 * (via the data-theme attribute on <html>) and the MUI palette.
 */
export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(initialMode);

  useEffect(() => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
    localStorage.setItem(STORAGE_KEY, mode);
  }, [mode]);

  const toggle = useCallback(() => setMode((current) => (current === 'dark' ? 'light' : 'dark')), []);

  const muiTheme = useMemo(() => buildMuiTheme(mode), [mode]);
  const value = useMemo(() => ({ mode, isDark: mode === 'dark', toggle, setMode }), [mode, toggle]);

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
}

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemeMode must be used inside ThemeModeProvider');
  return context;
};
