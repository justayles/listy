import {
  Fredoka_400Regular,
  Fredoka_600SemiBold,
  Fredoka_700Bold,
  useFonts,
} from '@expo-google-fonts/fredoka';
import { Yellowtail_400Regular } from '@expo-google-fonts/yellowtail';

export const listyFont = {
  regular: 'Fredoka_400Regular',
  semibold: 'Fredoka_600SemiBold',
  bold: 'Fredoka_700Bold',
  wordmark: 'Yellowtail_400Regular',
};

export function useListyFonts(): boolean {
  const [loaded, error] = useFonts({
    Fredoka_400Regular,
    Fredoka_600SemiBold,
    Fredoka_700Bold,
    Yellowtail_400Regular,
  });
  return loaded || !!error;
}
