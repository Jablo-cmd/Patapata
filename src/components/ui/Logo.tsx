import { View } from 'react-native';

import { palette } from '@/theme';

import { Text } from './Text';

/**
 * The Patapata mark drawn with plain views (no SVG dependency): a lowercase
 * "p" whose bowl is a speech bubble, with a warm accent dot.
 * Mirrors scripts/generate-brand-assets.py.
 */
export function LogoMark({ size = 40, onDark = true }: { size?: number; onDark?: boolean }) {
  const u = size / 640;
  const teal = palette.teal400;
  const hole = onDark ? palette.navy800 : '#FFFFFF';
  const box = (l: number, t: number, w: number, h: number, extra: object = {}) => ({
    position: 'absolute' as const,
    left: l * u,
    top: t * u,
    width: w * u,
    height: h * u,
    ...extra,
  });
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no">
      <View style={box(110, 260, 120, 290, { backgroundColor: teal, borderBottomLeftRadius: 60 * u, borderBottomRightRadius: 60 * u })} />
      <View style={box(110, 70, 410, 380, { backgroundColor: teal, borderRadius: 205 * u })} />
      <View style={box(430, 340, 90, 90, { backgroundColor: teal, transform: [{ rotate: '35deg' }], borderBottomRightRadius: 8 * u })} />
      <View style={box(240, 190, 170, 150, { backgroundColor: hole, borderRadius: 85 * u })} />
      <View style={box(490, 0, 130, 130, { backgroundColor: palette.ochre500, borderRadius: 65 * u })} />
    </View>
  );
}

export function Wordmark({ size = 28, color }: { size?: number; color?: string }) {
  return (
    <Text
      accessibilityRole="header"
      style={{ fontSize: size, lineHeight: size * 1.15, fontWeight: '800', letterSpacing: -0.5, color: color ?? palette.teal400 }}>
      patapata
    </Text>
  );
}

export function Brand({ size = 28, onDark = true }: { size?: number; onDark?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.3 }} accessibilityLabel="Patapata">
      <LogoMark size={size * 1.15} onDark={onDark} />
      <Wordmark size={size} color={onDark ? '#FFFFFF' : palette.navy800} />
    </View>
  );
}
