import { type FC } from 'react';
import { useTheme } from '../contexts/theme';

const ThemeToggle: FC = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <span className="theme-toggle-icon" aria-hidden="true">
        {isDark ? '☀' : '☾'}
      </span>
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
};

export default ThemeToggle;
