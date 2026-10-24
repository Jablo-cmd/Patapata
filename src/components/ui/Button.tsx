import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' | 'inverse';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
  testID?: string;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  accessibilityHint,
  testID,
}: ButtonProps) {
  const { colors, radii, spacing, dark } = useTheme();
  const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.danger, fg: dark ? colors.textInverse : '#FFFFFF', border: colors.danger },
    accent: { bg: colors.accent, fg: '#0B1F3A', border: colors.accent },
    // For use on dark brand surfaces regardless of colour scheme.
    inverse: { bg: 'transparent', fg: '#FFFFFF', border: 'rgba(255,255,255,0.45)' },
  };
  const p = palette[variant];
  const height = size === 'sm' ? 36 : size === 'lg' ? 52 : 46;
  const inactive = disabled || loading;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityHint={accessibilityHint}
      hitSlop={size === 'sm' ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        {
          minHeight: height,
          backgroundColor: p.bg,
          borderColor: p.border,
          borderRadius: radii.pill,
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.xl,
          opacity: inactive ? 0.55 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={p.fg} /> : null}
          <Text variant={size === 'sm' ? 'small' : 'bodyStrong'} style={{ color: p.fg, fontWeight: '700' }}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color,
  size = 22,
  badge,
  testID,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress?: () => void;
  label: string;
  color?: string;
  size?: number;
  badge?: number;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} new` : label}
      hitSlop={8}
      style={({ pressed }) => [styles.icon, { opacity: pressed ? 0.6 : 1 }]}>
      <Ionicons name={icon} size={size} color={color ?? colors.text} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
          <Text variant="caption" style={{ color: '#0B1F3A', fontWeight: '800', fontSize: 10, lineHeight: 13 }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  icon: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
