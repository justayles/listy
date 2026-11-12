import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { listyFont } from '@/lib/fonts';

export const LISTY_SPLASH = '#FFFFFF';
const LISTY_TITLE = '#000000';

/**
 * Branded overlay that plays once at launch. Expo Go cannot show a custom
 * native splash, so this is the animation you actually see in development.
 */
export function ListySplash({
  ready,
  fontsReady,
  onFinished,
}: {
  ready: boolean;
  fontsReady: boolean;
  onFinished: () => void;
}) {
  const [logo] = useState(() => new Animated.Value(0));
  const [title] = useState(() => new Animated.Value(0));
  const [overlay] = useState(() => new Animated.Value(1));
  const [animDone, setAnimDone] = useState(false);
  const closing = useRef(false);
  const onFinishedRef = useRef(onFinished);

  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);

  useEffect(() => {
    if (!fontsReady) return;
    const ease = Easing.out(Easing.cubic);
    Animated.sequence([
      Animated.timing(logo, { toValue: 1, duration: 480, easing: ease, useNativeDriver: true }),
      Animated.timing(title, { toValue: 1, duration: 360, easing: ease, useNativeDriver: true }),
      Animated.delay(280),
    ]).start(() => setAnimDone(true));
  }, [fontsReady, logo, title]);

  useEffect(() => {
    if (!ready || !animDone || closing.current) return;
    closing.current = true;
    Animated.timing(overlay, {
      toValue: 0,
      duration: 280,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onFinishedRef.current();
    });
  }, [ready, animDone, overlay]);

  const fadeUp = (value: Animated.Value) => ({
    opacity: value,
    transform: [
      { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
      { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
    ],
  });

  return (
    <Animated.View
      pointerEvents="none"
      onLayout={() => {
        SplashScreen.hideAsync();
      }}
      style={[styles.overlay, { opacity: overlay }]}>
      <View style={styles.mark}>
        <Animated.Image
          source={require('../../assets/images/splash-icon.png')}
          style={[styles.logo, fadeUp(logo)]}
        />
      </View>
      <Animated.Text style={[styles.title, fadeUp(title)]}>Listy</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    backgroundColor: LISTY_SPLASH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { width: 200, height: 200, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 176, height: 176 },
  title: {
    marginTop: 4,
    color: LISTY_TITLE,
    fontSize: 48,
    fontFamily: listyFont.bold,
    letterSpacing: 0.4,
  },
});
