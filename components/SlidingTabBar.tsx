import React, { useLayoutEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View, type LayoutRectangle, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import { LocalizedText as Text } from "./LocalizationContext";

type Props<T extends string> = {
  items: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  style: StyleProp<ViewStyle>;
  tabStyle: StyleProp<ViewStyle>;
  indicatorStyle: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  activeTextStyle: StyleProp<TextStyle>;
  labelNumberOfLines?: number;
};

export default function SlidingTabBar<T extends string>({ items, value, onChange, style, tabStyle, indicatorStyle, textStyle, activeTextStyle, labelNumberOfLines = 1 }: Props<T>) {
  const [layouts, setLayouts] = useState<Record<string, LayoutRectangle>>({});
  const reducedMotion = useReducedMotion();
  const initialized = useRef(false);
  const indicator = useSharedValue({ x: 0, y: 0, width: 0, height: 0 });
  const layout = layouts[value];
  const container = StyleSheet.flatten(style);
  const borderLeft = container?.borderLeftWidth ?? container?.borderWidth ?? 0;
  const borderTop = container?.borderTopWidth ?? container?.borderWidth ?? 0;

  useLayoutEffect(() => {
    if (!layout) return;
    const target = { ...layout, x: layout.x - borderLeft, y: layout.y - borderTop };
    cancelAnimation(indicator);
    indicator.set(!initialized.current || reducedMotion ? target : withTiming(target, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    }));
    initialized.current = true;
    return () => cancelAnimation(indicator);
  }, [layout, borderLeft, borderTop, reducedMotion, indicator]);

  const highlightStyle = useAnimatedStyle(() => ({
    width: indicator.value.width,
    height: indicator.value.height,
    transform: [{ translateX: indicator.value.x }, { translateY: indicator.value.y }],
  }));

  return (
    <View style={style}>
      <Animated.View pointerEvents="none" accessible={false} style={[styles.indicator, indicatorStyle, highlightStyle]} />
      {items.map((item) => (
        <Pressable
          key={item.value}
          style={[tabStyle, styles.tab]}
          onPress={() => onChange(item.value)}
          onLayout={({ nativeEvent: { layout: next } }) => {
            setLayouts((current) => {
              const saved = current[item.value];
              if (saved && saved.x === next.x && saved.y === next.y && saved.width === next.width && saved.height === next.height) return current;
              return { ...current, [item.value]: next };
            });
          }}
          accessibilityRole="tab"
          accessibilityState={{ selected: item.value === value }}
        >
          <Text numberOfLines={labelNumberOfLines} style={[textStyle, item.value === value && activeTextStyle]}>{item.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: { position: "absolute", left: 0, top: 0 },
  tab: { zIndex: 1 },
});
