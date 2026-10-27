// Shared building blocks. Large tap targets, one accent color, and no
// meaning carried by color alone.

import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { haptic } from '@/lib/haptics';
import { Icon, type IconName } from './Icon';
import { T } from './Text';
import { radius, space, useColors, type Palette } from './theme';

export function Card({
  children,
  style,
  padded = true,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  testID?: string;
}) {
  const c = useColors();
  return (
    <View
      testID={testID}
      style={[
        { backgroundColor: c.card, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
        padded && { padding: space.lg },
        style,
      ]}>
      {children}
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  loading,
  size = 'lg',
  style,
  testID,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useColors();
  const palette: Record<ButtonKind, { bg: string; pressed: string; fg: keyof Palette; border?: string }> = {
    primary: { bg: c.primary, pressed: c.primaryPressed, fg: 'onPrimary' },
    secondary: { bg: c.card, pressed: c.cardPressed, fg: 'text', border: c.borderStrong },
    ghost: { bg: 'transparent', pressed: c.cardPressed, fg: 'primary' },
    danger: { bg: c.dangerSoft, pressed: c.dangerSoft, fg: 'danger' },
  };
  const p = palette[kind];
  const inactive = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive }}
      disabled={inactive}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          minHeight: size === 'lg' ? 54 : 44,
          paddingHorizontal: space.xl,
          borderRadius: radius.md,
          backgroundColor: pressed ? p.pressed : p.bg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: space.sm,
          opacity: inactive ? 0.45 : 1,
        },
        p.border && { borderWidth: 1, borderColor: p.border },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={c[p.fg]} />
      ) : (
        <>
          {icon && <Icon name={icon} size={17} color={c[p.fg]} weight="semibold" />}
          <T variant="headline" color={p.fg}>
            {title}
          </T>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: 40,
        paddingHorizontal: space.lg,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? c.ink : c.borderStrong,
        backgroundColor: selected ? c.ink : pressed ? c.cardPressed : c.card,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
      })}>
      {icon && <Icon name={icon} size={14} color={selected ? c.bg : c.textMuted} weight="semibold" />}
      <T variant="subhead" weight="600" style={{ color: selected ? c.bg : c.text }}>
        {label}
      </T>
    </Pressable>
  );
}

export function ProgressBar({ value, color, height = 6, track }: { value: number; color?: string; height?: number; track?: string }) {
  const c = useColors();
  const pct = Math.max(0, Math.min(1, value));
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track ?? c.border, overflow: 'hidden' }}>
      <View style={{ width: `${pct * 100}%`, height, borderRadius: height, backgroundColor: color ?? c.primary }} />
    </View>
  );
}

export function Eyebrow({ children, color = 'textMuted' }: { children: ReactNode; color?: keyof Palette }) {
  return (
    <T variant="eyebrow" color={color} style={{ textTransform: 'uppercase' }}>
      {children}
    </T>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xxl, marginBottom: space.sm }}>
      <T variant="headline">{title}</T>
      {action}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  icon,
  iconColor,
  right,
  onPress,
  testID,
  last,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  right?: ReactNode;
  onPress?: () => void;
  testID?: string;
  last?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      disabled={!onPress}
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        { minHeight: 56, paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md },
        pressed && onPress && { opacity: 0.6 },
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
      ]}>
      {icon && (
        <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icon} size={16} color={iconColor ?? c.primary} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <T variant="callout" weight="600">
          {title}
        </T>
        {subtitle ? (
          <T variant="footnote" color="textMuted" style={{ marginTop: 2 }}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right}
      {onPress && <Icon name="chevron.right" size={13} color={c.textFaint} weight="semibold" />}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color,
  testID,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  testID?: string;
}) {
  const c = useColors();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? c.cardPressed : 'transparent',
      })}>
      <Icon name={icon} size={18} color={color ?? c.text} weight="semibold" />
    </Pressable>
  );
}

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'success' | 'danger' | 'warning' | 'primary'; icon?: IconName }) {
  const c = useColors();
  const tones = {
    neutral: { bg: c.bgGrouped, fg: c.textMuted },
    success: { bg: c.successSoft, fg: c.success },
    danger: { bg: c.dangerSoft, fg: c.danger },
    warning: { bg: c.warningSoft, fg: c.warning },
    primary: { bg: c.primarySoft, fg: c.primary },
  }[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: tones.bg,
      }}>
      {icon && <Icon name={icon} size={11} color={tones.fg} weight="bold" />}
      <T variant="caption" weight="700" style={{ color: tones.fg }}>
        {label}
      </T>
    </View>
  );
}

export function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <Eyebrow>{label}</Eyebrow>
      <T variant="stat" style={{ marginTop: space.xs }}>
        {value}
      </T>
      {sub ? (
        <T variant="footnote" color="textMuted">
          {sub}
        </T>
      ) : null}
    </Card>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.border }, style]} />;
}

export function Empty({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  const c = useColors();
  return (
    <View style={{ alignItems: 'center', paddingVertical: space.xxl, gap: space.sm }}>
      <Icon name={icon} size={28} color={c.textFaint} />
      <T variant="headline" align="center">
        {title}
      </T>
      <T variant="subhead" color="textMuted" align="center" style={{ maxWidth: 280 }}>
        {body}
      </T>
    </View>
  );
}
