import { useColorScheme } from 'react-native';

const light = {
  background: '#F3F7F6',
  surface: '#FFFFFF',
  text: '#123A48',
  textMuted: '#5B6E74',
  border: '#D7E3E1',
  primary: '#1F8A78',
  primaryText: '#FFFFFF',
  danger: '#D93025',
  success: '#2EC98A',
  badge: '#DCEFE9',
  badgeText: '#0F4A4A',
};

export type Theme = typeof light;

const dark: Theme = {
  background: '#0C1C22',
  surface: '#152830',
  text: '#E8F4F1',
  textMuted: '#8AA3A8',
  border: '#2A4148',
  primary: '#3DB89F',
  primaryText: '#0C1C22',
  danger: '#F2635A',
  success: '#4CC38A',
  badge: '#1B3A38',
  badgeText: '#9EE6D4',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
