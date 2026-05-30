import { useMemo, useRef } from 'react';
import { Animated, Dimensions, PanResponder } from 'react-native';

export const springModalSlide = {
  friction: 9,
  tension: 50,
  useNativeDriver: true,
};

export const springModalBounce = {
  damping: 14,
  stiffness: 160,
  useNativeDriver: true,
};

export function useDragToClose(
  slideValue: Animated.Value,
  snapToOpen: () => void,
  onClose: () => void,
  threshold = 0.2,
) {
  const scrollYRef = useRef(0);
  const closeRef = useRef(onClose);
  const snapRef = useRef(snapToOpen);
  closeRef.current = onClose;
  snapRef.current = snapToOpen;

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponderCapture: (_, g) => {
      return g.dy > 5 && scrollYRef.current <= 0;
    },
    onPanResponderMove: (_, g) => {
      if (g.dy > 0) {
        slideValue.setValue(Math.max(0, 1 - g.dy / Dimensions.get('window').height));
      }
    },
    onPanResponderRelease: (_, g) => {
      const screenHeight = Dimensions.get('window').height;
      if (g.dy > screenHeight * threshold || g.vy > 0.5) {
        closeRef.current();
      } else {
        Animated.spring(slideValue, {
          toValue: 1,
          ...springModalSlide,
        }).start();
      }
    },
  }), [slideValue, threshold]);

  return { panResponder, scrollYRef };
}
