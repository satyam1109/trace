import React, { createContext, useContext, useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { glassOverlayStyle } from './glassFeedback';
import { useTheme } from './theme';

export const GlassMotionContext = createContext(true);
/** Frosted press feedback stays behind opaque text; native uses a layered highlight. */
export function GlassPressable({
  children,
  onPress,
  label,
  style,
  contentStyle,
  radius = 28,
  light,
  testID,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  radius?: number;
  light?: boolean;
  testID?: string;
}) {
  const { dark } = useTheme();
  const lightSurface = light ?? !dark;
  const reducedMotion = useContext(GlassMotionContext);
  const scale = useRef(new Animated.Value(1)).current;
  const highlight = useRef(new Animated.Value(0)).current;
  const focused = useRef(false);
  const pressed = useRef(false);
  useEffect(() => {
    if (reducedMotion) {
      scale.stopAnimation();
      scale.setValue(1);
    }
  }, [reducedMotion, scale]);
  useEffect(
    () => () => {
      scale.stopAnimation();
      highlight.stopAnimation();
    },
    [scale, highlight],
  );
  function feedback(isPressed: boolean) {
    pressed.current = isPressed;
    Animated.timing(highlight, {
      toValue: isPressed ? 1 : focused.current ? 0.45 : 0,
      duration: reducedMotion ? 0 : isPressed ? 80 : 170,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    if (!reducedMotion)
      Animated.spring(scale, {
        toValue: isPressed ? 0.985 : 1,
        speed: 32,
        bounciness: 0,
        useNativeDriver: Platform.OS !== 'web',
      }).start();
  }
  return (
    <Animated.View style={[style, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={testID}
        onPress={event => {
          event.stopPropagation();
          onPress();
        }}
        onPressIn={() => feedback(true)}
        onPressOut={() => feedback(false)}
        onFocus={() => {
          focused.current = true;
          if (!pressed.current) highlight.setValue(0.45);
        }}
        onBlur={() => {
          focused.current = false;
          if (!pressed.current) highlight.setValue(0);
        }}
        style={[styles.surface, { borderRadius: radius }, contentStyle]}
      >
        <Animated.View
          pointerEvents="none"
          testID={testID ? `${testID}-glass` : undefined}
          style={[
            StyleSheet.absoluteFill,
            styles.highlight,
            glassOverlayStyle,
            {
              borderRadius: radius,
              opacity: highlight,
              borderColor: lightSurface ? '#A7AFBA66' : '#DCEAFF66',
              backgroundColor: lightSurface ? '#FFFFFF66' : '#DCEAFF13',
            },
          ]}
        >
          <View
            style={[
              styles.sheen,
              { backgroundColor: lightSurface ? '#FFFFFF55' : '#FFFFFF0A' },
            ]}
          />
        </Animated.View>
        {children}
      </Pressable>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  surface: { flexGrow: 1, justifyContent: 'center' },
  highlight: { borderWidth: 1.2, overflow: 'hidden' },
  sheen: { height: '42%', width: '100%' },
});
