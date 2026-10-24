import { Image } from 'expo-image';
import { View } from 'react-native';

import { initials } from '@/lib/format';
import { publicImageUrl } from '@/lib/media';
import { palette, useTheme } from '@/theme';

import { Text } from './Text';

const FALLBACK_COLORS = [palette.teal600, palette.navy600, palette.ochre600, palette.teal700, palette.navy700];

function colorFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

export function Avatar({
  path,
  name,
  size = 44,
  seed,
}: {
  path?: string | null;
  name?: string | null;
  size?: number;
  seed?: string;
}) {
  const { colors } = useTheme();
  const url = publicImageUrl(path);
  const common = { width: size, height: size, borderRadius: size / 2 };
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[common, { backgroundColor: colors.surfaceAlt }]}
        contentFit="cover"
        cachePolicy="disk"
        transition={120}
        accessibilityLabel={name ? `${name}'s profile photo` : 'Profile photo'}
      />
    );
  }
  return (
    <View
      accessibilityLabel={name ? `${name}'s profile photo` : 'Profile photo'}
      style={[common, { backgroundColor: colorFor(seed ?? name ?? '?'), alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: Math.round(size * 0.38) }}>{initials(name)}</Text>
    </View>
  );
}
