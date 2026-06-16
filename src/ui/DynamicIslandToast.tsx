import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DynamicIslandToastProps {
  visible: boolean;
  message: string;
  onHide: () => void;
  duration?: number;
}

export default function DynamicIslandToast({
  visible,
  message,
  onHide,
  duration = 3000,
}: DynamicIslandToastProps) {
  const insets = useSafeAreaInsets();
  const [isRendered, setIsRendered] = useState(false);
  const isError = /^(failed|error|unable)/i.test(message);
  
  const widthAnim = useRef(new Animated.Value(120)).current;
  const heightAnim = useRef(new Animated.Value(38)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      // Sequence of expansion
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: insets.top > 0 ? insets.top : 20,
          useNativeDriver: false,
          friction: 8,
          tension: 40,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start();

      // Expand to full width after a small delay
      setTimeout(() => {
        Animated.parallel([
          Animated.spring(widthAnim, {
            toValue: 340, // Max width
            useNativeDriver: false,
            friction: 8,
            tension: 30,
          }),
          Animated.spring(heightAnim, {
            toValue: 50,
            useNativeDriver: false,
            friction: 8,
            tension: 30,
          }),
          Animated.timing(contentOpacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: false,
          }),
        ]).start();
      }, 150);

      // Hide after duration
      const timer = setTimeout(() => {
        hide();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hide = () => {
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: false,
      }),
      Animated.spring(widthAnim, {
        toValue: 100,
        useNativeDriver: false,
        friction: 8,
      }),
      Animated.spring(heightAnim, {
        toValue: 30,
        useNativeDriver: false,
        friction: 8,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(translateY, {
        toValue: -20,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setIsRendered(false);
      onHide();
    });
  };

  if (!isRendered) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: translateY,
          opacity: opacityAnim,
          width: widthAnim,
          height: heightAnim,
          borderRadius: 25,
        },
      ]}
    >
      <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
        <View style={styles.iconWrapper}>
          <Feather name={isError ? 'x' : 'check'} size={16} color={isError ? '#f87171' : '#4ade80'} />
        </View>
        <Text style={styles.message} numberOfLines={1}>
          {message}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: '#000000',
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  iconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    color: '#ffffff',
    fontFamily: 'Manrope_700Bold',
    fontSize: 14,
  },
});
