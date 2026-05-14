import type { ViewStyle } from 'react-native';

type ShadowToken = Pick<ViewStyle, 'shadowColor' | 'shadowOpacity' | 'shadowRadius' | 'shadowOffset' | 'elevation'>;

export const shadowLg: ShadowToken = {
  shadowColor: '#0000001A',
  shadowOpacity: 0.08,
  shadowRadius: 36,
  shadowOffset: { width: 0, height: 18 },
  elevation: 8,
};

export const shadowLgDark: ShadowToken = {
  shadowColor: '#000000',
  shadowOpacity: 0.18,
  shadowRadius: 28,
  shadowOffset: { width: 0, height: 14 },
  elevation: 10,
};
