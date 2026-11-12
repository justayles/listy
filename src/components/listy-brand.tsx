import { Image, Text, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { listyFont } from '@/lib/fonts';

export function ListyBrand({
  color,
  logoSize = 40,
  fontSize = 18,
  style,
}: {
  color?: ColorValue;
  logoSize?: number;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6 }, style]}>
      <Image source={require('../../assets/images/icon.png')} style={{ width: logoSize, height: logoSize }} />
      <Text
        style={{
          fontFamily: listyFont.semibold,
          fontSize,
          lineHeight: fontSize + 6,
          color,
          includeFontPadding: false,
          paddingBottom: 2,
        }}>
        Listy
      </Text>
    </View>
  );
}
