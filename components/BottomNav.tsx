import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Pressable, StyleSheet, useWindowDimensions, PanResponder, Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useRouter, usePathname } from "expo-router";
import GlassSurface from "./GlassSurface";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming, withSequence, useDerivedValue } from "react-native-reanimated";
import { Search } from "lucide-react-native";
import { COLORS } from "../constants/theme";
import { useNavAnimation } from "./NavAnimationContext";
import TokensIcon from "../assets/icons/tokens.svg";
import TracerIcon from "../assets/icons/tracer.svg";
import BlacklistIcon from "../assets/icons/blacklist.svg";
import UserAvatar from "./UserAvatar";
const NAV_HEIGHT = 62;
const NAV_PADDING = 8;
const INDICATOR_HEIGHT = 46;
const SEARCH_SIZE = 62;
const GAP = 10;
const ROUTES = ["/tokens", "/tracer", "/blacklist", "/wallet"] as const;
const ITEMS = [
  { label: "Tokens", Icon: TokensIcon },
  { label: "Tracer", Icon: TracerIcon },
  { label: "Blacklist", Icon: BlacklistIcon },
  { label: "Wallet", Icon: null },
] as const;
export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const { compact } = useNavAnimation();
  const totalWidth = Math.min(width - 32, 370);
  const mainWidth = totalWidth - SEARCH_SIZE - GAP;
  const itemWidth = (mainWidth - NAV_PADDING * 2) / 4;
  const activeIndex = pathname.startsWith("/search") ? 4 : pathname.startsWith("/tracer") ? 1 : pathname.startsWith("/blacklist") ? 2 : pathname.startsWith("/wallet") ? 3 : 0;
  const [selectedIndex, setSelectedIndex] = useState(activeIndex);
  const indicatorX = useSharedValue(Math.min(activeIndex, 3) * itemWidth);
  const tapScale = useSharedValue(1);
  const scrollScale = useDerivedValue(() => withTiming(compact.value === 1 ? 0.78 : 1, { duration: 260 }));
  useEffect(() => {
    setSelectedIndex(activeIndex);
    if (activeIndex < 4) indicatorX.value = withTiming(activeIndex * itemWidth, { duration: 230 });
  }, [activeIndex, itemWidth]);
  const wholeNavStyle = useAnimatedStyle(() => ({ transform: [{ scale: scrollScale.value * tapScale.value }] }));
  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: indicatorX.value }], opacity: withTiming(selectedIndex === 4 ? 0 : 1, { duration: 170 }) }));
  const navigate = useCallback((index: number) => {
    void (Platform.OS === "android"
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click)
      : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    ).catch(() => undefined);
    compact.value = 0;
    tapScale.value = withSequence(withTiming(0.97, { duration: 75 }), withSpring(1.02, { damping: 16, stiffness: 240, mass: 0.7 }), withTiming(1, { duration: 120 }));
    setSelectedIndex(index);
    if (index < 4) indicatorX.value = withTiming(index * itemWidth, { duration: 230 });
    const target = index === 4 ? "/search" : ROUTES[index];
    if (target && pathname !== target) router.replace(target as any);
  }, [compact, tapScale, indicatorX, itemWidth, pathname, router]);
  const panResponder = useMemo(() => {
    // Convert screen coordinates into the scaled navigation bar's local space.
    const positionFor = (pageX: number) => {
      const scale = scrollScale.value * tapScale.value;
      const localX = (pageX - width / 2) / scale + totalWidth / 2 - NAV_PADDING;
      return Math.max(0, Math.min((ITEMS.length - 1) * itemWidth, localX - itemWidth / 2));
    };
    const preview = (pageX: number) => {
      const position = positionFor(pageX);
      indicatorX.set(position);
      setSelectedIndex(Math.round(position / itemWidth));
    };
    return PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        gesture.numberActiveTouches === 1 &&
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.3,
      onPanResponderGrant: (event) => preview(event.nativeEvent.pageX),
      onPanResponderMove: (_, gesture) => preview(gesture.moveX),
      onPanResponderRelease: (event) => {
        navigate(Math.round(positionFor(event.nativeEvent.pageX) / itemWidth));
      },
      onPanResponderTerminate: () => {
        setSelectedIndex(activeIndex);
        indicatorX.set(withSpring(Math.min(activeIndex, 3) * itemWidth, { damping: 20 }));
      },
    });
  }, [activeIndex, indicatorX, itemWidth, navigate, scrollScale, tapScale, totalWidth, width]);
  return (
    <Animated.View style={[styles.wrapper, { width: totalWidth }, wholeNavStyle]}>
      <View {...panResponder.panHandlers} style={[styles.mainNav, { width: mainWidth }]}>
        <GlassSurface radius={35} />
        <Animated.View pointerEvents="none" style={[styles.indicator, { width: itemWidth }, indicatorStyle]}>
          <GlassSurface radius={26} active />
        </Animated.View>
        <View style={styles.items}>
          {ITEMS.map(({ label, Icon }, index) => (
            <Pressable key={label} style={[styles.item, { width: itemWidth }]} onPress={() => navigate(index)} accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected: selectedIndex === index }}>
              {Icon ? <Icon width={22} height={22} color={selectedIndex === index ? COLORS.stonkLightG : COLORS.grey} /> : <UserAvatar style={styles.walletAvatar} />}
            </Pressable>
          ))}
        </View>
      </View>
      <Pressable style={styles.searchCircle} onPress={() => navigate(4)} accessibilityRole="button" accessibilityLabel="Search">
        <GlassSurface radius={SEARCH_SIZE / 2} active={selectedIndex === 4} interactive />
        <View pointerEvents="none" style={{ zIndex: 1 }}><Search size={25} color={selectedIndex === 4 ? COLORS.stonkLightG : COLORS.grey} /></View>
      </Pressable>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  wrapper: { position: "absolute", bottom: 25, alignSelf: "center", height: NAV_HEIGHT, flexDirection: "row", alignItems: "center", gap: GAP, zIndex: 20 },
  mainNav: { height: NAV_HEIGHT, borderRadius: 35, overflow: "hidden", backgroundColor: "transparent" },
  indicator: { position: "absolute", left: NAV_PADDING, top: 7, height: INDICATOR_HEIGHT, borderRadius: 26, overflow: "hidden",  },
  indicatorGlass: { flex: 1, borderRadius: 26 },
  items: { flex: 1, flexDirection: "row", alignItems: "center", paddingHorizontal: NAV_PADDING },
  item: { height: INDICATOR_HEIGHT, alignItems: "center", justifyContent: "center" },
  walletAvatar: { width: 29, height: 29, borderRadius: 15 },
  searchCircle: { width: SEARCH_SIZE, height: SEARCH_SIZE, borderRadius: SEARCH_SIZE / 2, overflow: "hidden", alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  searchActive: { backgroundColor: "#C6E900", borderColor: "#C6E900" },
});
