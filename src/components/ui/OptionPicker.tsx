import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

import { IconButton } from './Button';
import { Text } from './Text';
import { TextField } from './TextField';

export type Option<T extends string = string> = { value: T; label: string; description?: string };

/** A field that opens a searchable list. Works the same on Android, iOS and web. */
export function OptionPicker<T extends string>({
  label,
  placeholder = 'Choose…',
  options,
  value,
  onChange,
  multiple,
  values,
  onChangeMultiple,
  searchable = true,
  error,
  allowClear,
}: {
  label: string;
  placeholder?: string;
  options: Option<T>[];
  value?: T | null;
  onChange?: (value: T | null) => void;
  multiple?: boolean;
  values?: T[];
  onChangeMultiple?: (values: T[]) => void;
  searchable?: boolean;
  error?: string | null;
  allowClear?: boolean;
}) {
  const { colors, radii, spacing } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const summary = multiple
    ? options.filter((o) => values?.includes(o.value)).map((o) => o.label).join(', ')
    : options.find((o) => o.value === value)?.label;

  const toggle = (v: T) => {
    if (multiple) {
      const current = values ?? [];
      onChangeMultiple?.(current.includes(v) ? current.filter((x) => x !== v) : [...current, v]);
    } else {
      onChange?.(v);
      setOpen(false);
    }
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="small" color="textMuted" style={{ fontWeight: '600' }}>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${summary || placeholder}`}
        style={{
          minHeight: 48,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : colors.border,
          borderRadius: radii.md,
          backgroundColor: colors.surface,
          paddingHorizontal: 14,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}>
        <Text color={summary ? 'text' : 'textMuted'} style={{ flex: 1 }} numberOfLines={1}>
          {summary || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {error ? (
        <Text variant="small" color="danger">
          {error}
        </Text>
      ) : null}

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm }}>
            <IconButton icon="close" label="Close" onPress={() => setOpen(false)} />
            <Text variant="heading" style={{ flex: 1 }}>
              {label}
            </Text>
            {allowClear && !multiple && value ? (
              <Pressable onPress={() => { onChange?.(null); setOpen(false); }} style={{ padding: 12 }} accessibilityRole="button">
                <Text color="primary" variant="bodyStrong">Clear</Text>
              </Pressable>
            ) : null}
            {multiple ? (
              <Pressable onPress={() => setOpen(false)} style={{ padding: 12 }} accessibilityRole="button">
                <Text color="primary" variant="bodyStrong">Done</Text>
              </Pressable>
            ) : null}
          </View>
          {searchable ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
              <TextField placeholder="Search" value={query} onChangeText={setQuery} autoCorrect={false} />
            </View>
          ) : null}
          <FlatList
            data={filtered}
            keyExtractor={(o) => o.value}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={25}
            renderItem={({ item }) => {
              const selected = multiple ? values?.includes(item.value) : item.value === value;
              return (
                <Pressable
                  onPress={() => toggle(item.value)}
                  accessibilityRole={multiple ? 'checkbox' : 'radio'}
                  accessibilityState={{ checked: Boolean(selected) }}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: spacing.lg,
                    minHeight: 52,
                    gap: 12,
                    opacity: pressed ? 0.7 : 1,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  })}>
                  <View style={{ flex: 1 }}>
                    <Text>{item.label}</Text>
                    {item.description ? (
                      <Text variant="small" color="textMuted">
                        {item.description}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
