import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from './Text';
import { space, useColors } from './theme';

/** Height reserved at the bottom of tab screens for the floating tab bar. */
export const TAB_BAR_SPACE = 92;

/** Scrolling tab screen with a large title and room for the floating tab bar. */
export function TabScreen({
  title,
  right,
  children,
  footer,
  contentStyle,
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: c.bgGrouped }}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[
          { paddingTop: insets.top + space.md, paddingHorizontal: space.lg, paddingBottom: TAB_BAR_SPACE + (footer ? 84 : 0) + insets.bottom },
          contentStyle,
        ]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg, minHeight: 44 }}>
          <T variant="largeTitle" accessibilityRole="header">
            {title}
          </T>
          {right}
        </View>
        {children}
      </ScrollView>
      {/* Keeps scrolled content from running under the status bar. */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: insets.top, backgroundColor: c.bgGrouped, opacity: 0.96 }} />
      {footer ? (
        <View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: TAB_BAR_SPACE - space.sm + Math.max(0, insets.bottom - 20),
            paddingHorizontal: space.lg,
          }}>
          {footer}
        </View>
      ) : null}
    </View>
  );
}
