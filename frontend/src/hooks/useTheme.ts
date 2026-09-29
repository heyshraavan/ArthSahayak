import { useContext } from 'react';
import {
  ThemeContext,
  type ThemeContextValue,
} from '../context/themeContextInstance';

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return safe fallback if used outside provider (e.g. isolated test)
    return {
      theme: 'system',
      resolvedTheme: 'light',
      setTheme: () => {},
      toggleTheme: () => {},
    };
  }
  return context;
}
