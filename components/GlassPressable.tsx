import React from "react";
import { Pressable, StyleSheet, View, type PressableProps } from "react-native";
import GlassSurface from "./GlassSurface";

/** Preserves the original control's layout, handlers, and accessibility props. */
export default function GlassPressable({ children, style, ...props }: PressableProps) {
  return <Pressable {...props} style={(state) => [
    typeof style === "function" ? style(state) : style,
    styles.surface,
    props.disabled && styles.disabled,
  ]}>
    {(state) => <>
      <GlassSurface radius={999} interactive={!props.disabled} />
      <View pointerEvents="box-none" style={styles.content}>
        {typeof children === "function" ? children(state) : children}
      </View>
    </>}
  </Pressable>;
}

const styles = StyleSheet.create({
  surface: { backgroundColor: "transparent", borderWidth: 0, overflow: "hidden" },
  disabled: { opacity: 0.5 },
  content: { zIndex: 1, alignItems: "center", justifyContent: "center" },
});
