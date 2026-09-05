import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeType = 'light' | 'dark' | 'system';

interface ThemeContextData {
  theme: ThemeType;
  isDark: boolean;
  setTheme: (theme: ThemeType) => void;
  colors: {
    background: string;
    card: string;
    text: string;
    textDim: string;
    border: string;
    primary: string;
    navBar: string;
    navBorder: string;
    shadow: string;
  };
}

const lightColors = {
  background: '#F5F7FB',
  card: '#FFFFFF',
  text: '#0F172A',
  textDim: '#64748B',
  border: '#E2E8F0',
  primary: '#4338B8',
  navBar: 'rgba(255, 255, 255, 0.85)',
  navBorder: 'rgba(0, 0, 0, 0.1)',
  shadow: '#000000',
};

const darkColors = {
  background: '#0F172A',
  card: '#1E293B',
  text: '#FFFFFF',
  textDim: '#94A3B8',
  border: '#334155',
  primary: '#4338B8',
  navBar: 'rgba(45, 45, 55, 0.68)',
  navBorder: 'rgba(255, 255, 255, 0.18)',
  shadow: '#FFFFFF',
};

const ThemeContext = createContext<ThemeContextData>({} as ThemeContextData);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemTheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeType>('system');

  useEffect(() => {
    AsyncStorage.getItem('themePref').then(v => {
      if (v) setThemeState(v as ThemeType);
    });
  }, []);

  const setTheme = (t: ThemeType) => {
    setThemeState(t);
    AsyncStorage.setItem('themePref', t);
  };

  const isDark = theme === 'system' ? systemTheme === 'dark' : theme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
