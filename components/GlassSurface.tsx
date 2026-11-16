import React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

export const nativeGlassAvailable = Platform.OS === "ios"
  && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();

/** A decorative surface; the owning control keeps its touch and accessibility behavior. */
export default function GlassSurface({ radius, active = false, interactive = false, style }: {
  radius: number;
  active?: boolean;
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const shape = [StyleSheet.absoluteFill, { borderRadius: radius }, style];
  if (nativeGlassAvailable) {
    return <GlassView
      pointerEvents="none"
      accessible={false}
      style={shape}
      glassEffectStyle="regular"
      colorScheme="dark"
      isInteractive={interactive}
      tintColor={active ? "rgba(187,220,18,0.3)" : undefined}
    />;
  }
  return <View pointerEvents="none" accessible={false} style={[shape, styles.fallback]}>
    <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
    <LinearGradient
      colors={active
        ? ["rgba(187,220,18,0.34)", "rgba(187,220,18,0.12)"]
        : ["rgba(255,255,255,0.16)", "rgba(255,255,255,0.04)"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  </View>;
}

const styles = StyleSheet.create({
  fallback: { overflow: "hidden", backgroundColor: "rgba(32,35,29,0.62)", borderWidth: 1, borderColor: "rgba(255,255,255,0.24)" },
});
