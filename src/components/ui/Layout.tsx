import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { Button } from './Button';
import { Text } from './Text';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Page container: safe area, background, centred max width, optional scroll. */
export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top', 'left', 'right'],
  refreshing,
  onRefresh,
  keyboard = false,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboard?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors, spacing, layout } = useTheme();
  const inner = [
    { width: '100%' as const, maxWidth: layout.maxContentWidth, alignSelf: 'center' as const },
    padded && { padding: spacing.lg },
    contentStyle,
  ];
  const body = scroll ? (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[{ paddingBottom: spacing.xxxl }, inner]}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined
      }>
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, inner]}>{children}</View>
  );
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void }) {
  const { colors, radii, spacing } = useTheme();
  const cardStyle = [
    { backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
    style,
  ];
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [cardStyle, pressed && { opacity: 0.9 }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={cardStyle}>{children}</View>;
}

export function Stack({ gap = 12, children, style }: { gap?: number; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Row({
  gap = 8,
  children,
  style,
  wrap,
  align = 'center',
}: {
  gap?: number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  wrap?: boolean;
  align?: 'center' | 'flex-start' | 'flex-end';
}) {
  return <View style={[{ flexDirection: 'row', alignItems: align, gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
      <Text variant="heading" accessibilityRole="header">
        {title}
      </Text>
      {action}
    </Row>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
}) {
  const { colors, radii } = useTheme();
  const content = (
    <>
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.onPrimary : colors.onPrimarySoft} /> : null}
      <Text variant="small" style={{ color: selected ? colors.onPrimary : colors.onPrimarySoft, fontWeight: '600' }}>
        {label}
      </Text>
    </>
  );
  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 12,
    minHeight: 32,
    borderRadius: radii.pill,
    backgroundColor: selected ? colors.primary : colors.primarySoft,
  };
  if (!onPress) return <View style={style}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: Boolean(selected) }}
      hitSlop={4}
      style={({ pressed }) => [style, pressed && { opacity: 0.8 }]}>
      {content}
    </Pressable>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  onPress,
  right,
  danger,
  testID,
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  danger?: boolean;
  testID?: string;
}) {
  const { colors, spacing } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, minHeight: 52 },
        pressed && { opacity: 0.7 },
      ]}>
      {icon ? <Ionicons name={icon} size={22} color={danger ? colors.danger : colors.primary} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" color={danger ? 'danger' : 'text'}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" color="textMuted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <ListRow
      title={title}
      subtitle={subtitle}
      right={
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityLabel={title}
          trackColor={{ true: colors.primary, false: colors.border }}
          thumbColor="#FFFFFF"
        />
      }
    />
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors, radii } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radii.pill, padding: 3 }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={{
              flex: 1,
              minHeight: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radii.pill,
              backgroundColor: selected ? colors.surface : 'transparent',
            }}>
            <Text variant="small" style={{ fontWeight: selected ? '700' : '500' }} color={selected ? 'text' : 'textMuted'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.primary} size="large" />
      <Text variant="small" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon = 'sparkles-outline',
  title,
  message,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={28} color={colors.onPrimarySoft} />
      </View>
      <Text variant="heading" align="center">
        {title}
      </Text>
      {message ? (
        <Text variant="body" color="textMuted" align="center" style={{ maxWidth: 360 }}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={{ marginTop: 8 }} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Something went wrong"
      message={message}
      actionLabel={onRetry ? 'Try again' : undefined}
      onAction={onRetry}
    />
  );
}

export function Banner({ tone = 'info', children, icon }: { tone?: 'info' | 'warning' | 'danger'; children: ReactNode; icon?: IconName }) {
  const { colors, radii } = useTheme();
  const bg = tone === 'info' ? colors.primarySoft : tone === 'warning' ? colors.accentSoft : colors.surfaceAlt;
  const fg = tone === 'danger' ? colors.danger : tone === 'info' ? colors.onPrimarySoft : colors.text;
  return (
    <View
      accessibilityRole="alert"
      style={{ flexDirection: 'row', gap: 10, padding: 12, borderRadius: radii.md, backgroundColor: bg, alignItems: 'flex-start' }}>
      <Ionicons
        name={icon ?? (tone === 'info' ? 'information-circle-outline' : 'alert-circle-outline')}
        size={20}
        color={fg}
      />
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <Text variant="small" style={{ color: fg }}>{children}</Text> : children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
});

export function Checkbox({
  checked,
  onChange,
  children,
  testID,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start', minHeight: 44, paddingVertical: 4 }}>
      <Ionicons name={checked ? 'checkbox' : 'square-outline'} size={24} color={checked ? colors.primary : colors.textMuted} />
      <View style={{ flex: 1, paddingTop: 2 }}>{typeof children === 'string' ? <Text>{children}</Text> : children}</View>
    </Pressable>
  );
}
