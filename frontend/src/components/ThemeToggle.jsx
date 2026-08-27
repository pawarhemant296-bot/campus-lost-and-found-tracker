import Tooltip from '@mui/material/Tooltip';
import { useThemeMode } from '../context/ThemeContext.jsx';
import { MoonIcon, SunIcon } from './ui/Icons.jsx';

/** Switches between the dark and light colour schemes; the choice is persisted. */
export default function ThemeToggle() {
  const { isDark, toggle } = useThemeMode();
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <Tooltip title={label}>
      <button type="button" className="icon-btn" onClick={toggle} aria-label={label} data-testid="theme-toggle">
        {isDark ? <SunIcon /> : <MoonIcon />}
      </button>
    </Tooltip>
  );
}
