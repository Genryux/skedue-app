import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { shadowLg } from './tokens/shadows';
import { springModalSlide, useDragToClose } from './tokens/animations';

const SCREEN_HEIGHT = Dimensions.get('window').height;

type ConfirmModalProps = {
  visible: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  isDark: boolean;
  confirmLabel?: string;
  confirmDestructive?: boolean;
  requiredInputText?: string;
};

export default function ConfirmModal({
  visible,
  title,
  description,
  onCancel,
  onConfirm,
  isDark,
  confirmLabel = 'Confirm',
  confirmDestructive,
  requiredInputText,
}: ConfirmModalProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const [inputValue, setInputValue] = useState('');
  const [showInputError, setShowInputError] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setInputValue('');
      setShowInputError(false);
      slideAnim.setValue(0);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 1, ...springModalSlide }),
      ]).start();
    }
  }, [visible]);

  const close = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onCancel();
    });
  }, [opacityAnim, slideAnim, onCancel]);

  const snapOpen = useCallback(() => {
    Animated.spring(slideAnim, { toValue: 1, ...springModalSlide }).start();
  }, [slideAnim]);

  const closeViaDrag = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onCancel();
    });
  }, [opacityAnim, slideAnim, onCancel]);

  const { panResponder, scrollYRef } = useDragToClose(slideAnim, snapOpen, closeViaDrag);

  const isMatching = requiredInputText ? inputValue === requiredInputText : true;

  const handleConfirm = () => {
    if (requiredInputText && inputValue !== requiredInputText) {
      setShowInputError(true);
      return;
    }
    setInputValue('');
    setShowInputError(false);
    onConfirm();
  };

  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 200 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: opacityAnim }]}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} experimentalBlurMethod="dimezisBlurView" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5, 8, 7, 0.2)' }]} />
      </Animated.View>
      <Pressable style={StyleSheet.absoluteFill} onPress={close} />

      <Animated.View
        pointerEvents="box-none"
        style={[
          styles.panelWrapper,
          {
            bottom: keyboardHeight > 0 ? keyboardHeight + 16 : 0,
            transform: [{
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [SCREEN_HEIGHT, 0],
              }),
            }],
          },
        ]}
      >
        <View style={[styles.panel, isDark && styles.panelDark]} {...panResponder.panHandlers}>
          <View style={[styles.handle, isDark && styles.handleDark]} />
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ paddingBottom: 8 }}
            onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={16}
          >
            <View style={styles.iconRow}>
              <View style={[styles.iconCircle, confirmDestructive && styles.iconCircleDanger]}>
                <Feather
                  name={confirmDestructive ? 'alert-triangle' : 'info'}
                  size={20}
                  color={confirmDestructive ? '#d1453b' : '#3d6657'}
                />
              </View>
            </View>

            <Text style={[styles.title, isDark && styles.titleDark]}>{title}</Text>
            <Text style={[styles.description, isDark && styles.descriptionDark]}>{description}</Text>

            {requiredInputText && (
              <View style={styles.inputSection}>
                <Text style={[styles.inputLabel, isDark && styles.inputLabelDark]}>
                  Type <Text style={styles.inputLabelCode}>{requiredInputText}</Text> to confirm:
                </Text>
                <TextInput
                  style={[styles.input, isDark && styles.inputDark, showInputError && styles.inputError]}
                  value={inputValue}
                  onChangeText={(text) => {
                    setInputValue(text);
                    if (showInputError) setShowInputError(false);
                  }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                {showInputError && (
                  <Text style={styles.inputErrorText}>Text does not match</Text>
                )}
              </View>
            )}

            <View style={styles.buttonRow}>
              <Pressable style={[styles.button, styles.cancelButton, isDark && styles.cancelButtonDark]} onPress={close}>
                <Text style={[styles.cancelButtonText, isDark && styles.cancelButtonTextDark]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.button,
                  confirmDestructive ? styles.destructiveButton : styles.confirmButton,
                  !isMatching && styles.buttonDisabled,
                ]}
                onPress={handleConfirm}
                disabled={!isMatching}
              >
                <Text
                  style={[
                    styles.confirmButtonText,
                    confirmDestructive ? styles.destructiveButtonText : styles.confirmButtonTextNormal,
                    !isMatching && styles.confirmButtonTextDisabled,
                  ]}
                >
                  {confirmLabel}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panelWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: '#f8f7f2',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 20,
    maxHeight: SCREEN_HEIGHT * 0.7,
    ...shadowLg,
  },
  handle: {
    width: 68,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#e3e0d8',
    alignSelf: 'center',
    marginBottom: 16,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 16,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleDanger: {
    backgroundColor: '#fde8e7',
  },
  title: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 20,
    color: '#101413',
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  titleDark: {
    color: '#d7e4dd',
  },
  description: {
    fontFamily: 'Manrope_400Regular',
    fontSize: 14,
    color: '#5c6762',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  descriptionDark: {
    color: '#8f9b95',
  },
  inputSection: {
    width: '100%',
    marginBottom: 20,
  },
  inputLabel: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 13,
    color: '#5c6762',
    marginBottom: 8,
  },
  inputLabelDark: {
    color: '#8f9b95',
  },
  inputLabelCode: {
    fontFamily: 'Manrope_700Bold',
  },
  input: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Manrope_500Medium',
    fontSize: 15,
    color: '#1e2b26',
    borderWidth: 1,
    borderColor: '#f2f1ee',
    ...shadowLg,
  },
  inputDark: {
    backgroundColor: '#0f201b',
    borderColor: '#2a3d36',
    color: '#d7e4dd',
  },
  inputError: {
    borderColor: '#d1453b',
  },
  inputErrorText: {
    fontFamily: 'Manrope_500Medium',
    fontSize: 12,
    color: '#d1453b',
    marginTop: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    borderRadius: 18,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#ffffff',
    ...shadowLg,
  },
  cancelButtonDark: {
    backgroundColor: '#0f201b',
  },
  cancelButtonText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
    color: '#5c6762',
  },
  cancelButtonTextDark: {
    color: '#8f9b95',
  },
  confirmButton: {
    backgroundColor: '#0f2a24',
  },
  destructiveButton: {
    backgroundColor: '#d1453b',
  },
  confirmButtonText: {
    fontFamily: 'Manrope_700Bold',
    fontSize: 16,
  },
  confirmButtonTextNormal: {
    color: '#ffffff',
  },
  destructiveButtonText: {
    color: '#ffffff',
  },
  confirmButtonTextDisabled: {
    color: '#9aa09a',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  panelDark: { backgroundColor: '#0a1613' },
  handleDark: { backgroundColor: '#2a3d36' },
});
