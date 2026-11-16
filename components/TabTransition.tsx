import React, { useLayoutEffect, useRef } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type Props = {
  children: React.ReactNode;
  activeKey: string | null;
  index: number;
  style?: StyleProp<ViewStyle>;
};

export default function TabTransition({ children, activeKey, index, style }: Props) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(1);
  const direction = useSharedValue(1);
  const previous = useRef({ activeKey, index });

  useLayoutEffect(() => {
    const last = previous.current;
    previous.current = { activeKey, index };
    cancelAnimation(progress);
    if (reducedMotion || activeKey === null || last.activeKey === activeKey) {
      progress.set(1);
      return;
    }
    direction.set(index < last.index ? -1 : 1);
    progress.set(0);
    progress.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }));
    return () => cancelAnimation(progress);
  }, [activeKey, index, reducedMotion, direction, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.45 + progress.value * 0.55,
    transform: [{ translateX: (1 - progress.value) * direction.value * 18 }],
  }));

  // Keep children mounted so tab changes don't reset forms or scroll views.
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}
