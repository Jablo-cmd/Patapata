import Ionicons from '@expo/vector-icons/Ionicons';
import { forwardRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

import { Text } from './Text';

export type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  secureToggle?: boolean;
  maxLengthCounter?: boolean;
};

export const TextField = forwardRef<ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  { label, error, hint, secureToggle, secureTextEntry, maxLengthCounter, style, multiline, value, maxLength, ...rest },
  ref,
) {
  const { colors, radii, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const secure = secureToggle ? hidden : secureTextEntry;

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text variant="small" color="textMuted" style={{ fontWeight: '600' }}>
          {label}
        </Text>
      ) : null}
      <View
        style={[
          styles.box,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : focused ? colors.primary : colors.border,
            borderRadius: radii.md,
            minHeight: multiline ? 96 : 48,
          },
        ]}>
        <TextInput
          ref={ref}
          value={value}
          maxLength={maxLength}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secure}
          multiline={multiline}
          accessibilityLabel={label}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            typography.body,
            styles.input,
            { color: colors.text, textAlignVertical: multiline ? 'top' : 'center' },
            style,
          ]}
          {...rest}
        />
        {secureToggle ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            style={styles.toggle}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text variant="small" color="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint || (maxLengthCounter && maxLength) ? (
        <View style={styles.footer}>
          <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
            {hint ?? ''}
          </Text>
          {maxLengthCounter && maxLength ? (
            <Text variant="caption" color="textMuted">
              {(value ?? '').length}/{maxLength}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  box: { borderWidth: 1.5, flexDirection: 'row', alignItems: 'stretch' },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, outlineStyle: 'none' } as never,
  toggle: { width: 48, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: 8 },
});
