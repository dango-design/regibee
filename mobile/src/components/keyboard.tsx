import { forwardRef, useEffect, useState, type Ref } from "react";
import { View, type ScrollViewInstance, type ViewProps } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  type KeyboardAwareScrollViewProps,
  type KeyboardAwareScrollViewRef,
} from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { spacing, useTheme } from "@/lib/theme";

/**
 * Use this, not ScrollView, for a screen with a text field. When the keyboard
 * opens, it scrolls the field being typed in to just above it.
 *
 * React Native's KeyboardAvoidingView doesn't do this on Android: the app
 * draws edge to edge, so Android no longer shrinks the screen for the
 * keyboard. It needs `KeyboardProvider` in the root layout.
 *
 * Its ref is a ScrollView's, so code that scrolls a ScrollView works with it.
 */
export const KeyboardScrollView = forwardRef<ScrollViewInstance, KeyboardAwareScrollViewProps>(
  function KeyboardScrollView({ bottomOffset = spacing.xl, keyboardShouldPersistTaps = "handled", ...props }, ref) {
    return (
      <KeyboardAwareScrollView
        ref={ref as Ref<KeyboardAwareScrollViewRef>}
        bottomOffset={bottomOffset}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        {...props}
      />
    );
  },
);

/**
 * For a screen with a footer, such as a Save button, under its
 * KeyboardScrollView. The footer rides on top of the keyboard, and the field
 * being typed in stays above the footer:
 *
 *   const keyboardFooter = useKeyboardFooter();
 *   <KeyboardScrollView bottomOffset={keyboardFooter.bottomOffset}>…</KeyboardScrollView>
 *   <KeyboardFooter {...keyboardFooter.footerProps} style={…}>…</KeyboardFooter>
 *
 * `bottomPadding` is the footer's own bottom padding, which covers the safe
 * area at the bottom of the screen. With the keyboard open, all but
 * spacing.lg of it goes behind the keyboard.
 */
export function useKeyboardFooter(bottomPadding?: number) {
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const sink = Math.max(0, (bottomPadding ?? Math.max(insets.bottom, spacing.lg)) - spacing.lg);
  return { bottomOffset: height - sink + spacing.md, footerProps: { sink, onHeight: setHeight } };
}

export function KeyboardFooter({
  sink,
  onHeight,
  style,
  onLayout,
  ...props
}: ViewProps & { sink: number; onHeight: (height: number) => void }) {
  const theme = useTheme();
  // A footer that goes away leaves no space behind.
  useEffect(() => () => onHeight(0), [onHeight]);
  return (
    <KeyboardStickyView offset={{ opened: sink }}>
      <View
        {...props}
        // Content scrolls under the footer while the keyboard is open.
        style={[{ backgroundColor: theme.background }, style]}
        onLayout={(event) => {
          onHeight(event.nativeEvent.layout.height);
          onLayout?.(event);
        }}
      />
    </KeyboardStickyView>
  );
}
