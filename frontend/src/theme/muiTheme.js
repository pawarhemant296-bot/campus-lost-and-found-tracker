import { createTheme } from '@mui/material/styles';

/**
 * MUI theme that mirrors the CSS variables in styles.css, so Material inputs
 * sit naturally next to the hand-rolled cards and badges in both themes.
 */
const tokens = {
  dark: {
    background: '#14111f',
    backgroundAlt: '#1a1628',
    text: '#f5f3ff',
    muted: '#9d94b8',
    border: '#2b2340',
    brand: '#a78bfa',
    error: '#f87171',
    success: '#34d399',
    warning: '#fbbf24',
    info: '#38bdf8',
  },
  light: {
    background: '#ffffff',
    backgroundAlt: '#f8fafc',
    text: '#0f172a',
    muted: '#64748b',
    border: '#e2e8f0',
    brand: '#7c3aed',
    error: '#dc2626',
    success: '#059669',
    warning: '#b45309',
    info: '#0284c7',
  },
};

export function buildMuiTheme(mode = 'dark') {
  const t = tokens[mode] ?? tokens.dark;

  return createTheme({
    palette: {
      mode,
      primary: { main: t.brand },
      error: { main: t.error },
      success: { main: t.success },
      warning: { main: t.warning },
      info: { main: t.info },
      background: { default: t.background, paper: t.background },
      text: { primary: t.text, secondary: t.muted },
      divider: t.border,
    },
    shape: { borderRadius: 9 },
    typography: {
      fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif",
      fontSize: 15,
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small', fullWidth: true },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: t.backgroundAlt,
            fontSize: '0.97rem',
            '& fieldset': { borderColor: t.border },
            '&:hover fieldset': { borderColor: t.brand },
          },
          input: { paddingTop: 11, paddingBottom: 11 },
        },
      },
      MuiInputLabel: {
        styleOverrides: { root: { fontSize: '0.95rem' } },
      },
      MuiFormHelperText: {
        styleOverrides: { root: { marginLeft: 2, fontSize: '0.8rem', color: t.muted } },
      },
      MuiButton: {
        styleOverrides: { root: { borderRadius: 9, paddingInline: 16 } },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: '0.8rem',
            backgroundColor: t.backgroundAlt,
            border: `1px solid ${t.border}`,
            color: t.text,
          },
        },
      },
    },
  });
}

export default buildMuiTheme;
