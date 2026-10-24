import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/ui';
import { useTheme } from '@/theme';

export type MenuAction = {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  destructive?: boolean;
};

/** Bottom sheet of actions (edit, delete, report, block…). */
export function ActionMenu({ visible, onClose, actions, title }: { visible: boolean; onClose: () => void; actions: MenuAction[]; title?: string }) {
  const { colors, radii, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={Platform.OS === 'web' ? 'none' : 'fade'} onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={onClose} accessibilityLabel="Close menu">
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            paddingBottom: insets.bottom + spacing.md,
            paddingTop: spacing.sm,
            width: '100%',
            maxWidth: 680,
            alignSelf: 'center',
          }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 8 }} />
          {title ? (
            <Text variant="small" color="textMuted" style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.sm }}>
              {title}
            </Text>
          ) : null}
          {actions.map((a) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                a.onPress();
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 14,
                minHeight: 52,
                paddingHorizontal: spacing.xl,
                opacity: pressed ? 0.6 : 1,
              })}>
              <Ionicons name={a.icon} size={22} color={a.destructive ? colors.danger : colors.text} />
              <Text variant="bodyStrong" color={a.destructive ? 'danger' : 'text'}>
                {a.label}
              </Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
