import { Image } from 'expo-image';
import { ActivityIndicator, View } from 'react-native';

import { useSignedImageUrl } from '@/lib/media';
import type { MediaItem } from '@/lib/types';
import { useTheme } from '@/theme';

function PrivateImage({ bucket, item, aspect, rounded = 12 }: { bucket: 'post-media' | 'message-media'; item: MediaItem; aspect: number; rounded?: number }) {
  const { colors } = useTheme();
  const url = useSignedImageUrl(bucket, item.path);
  return (
    <View style={{ flex: 1, aspectRatio: aspect, borderRadius: rounded, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}>
      {url.data ? (
        <Image
          source={{ uri: url.data }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          cachePolicy="disk"
          recyclingKey={item.path}
          transition={150}
          accessibilityLabel="Photo"
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {url.isLoading ? <ActivityIndicator color={colors.textMuted} /> : null}
        </View>
      )}
    </View>
  );
}

/** 1–6 images: single image keeps its aspect ratio; more use a 2-column grid. */
export function PostImages({ media }: { media: MediaItem[] }) {
  if (!media.length) return null;
  if (media.length === 1) {
    const m = media[0];
    const aspect = m.width && m.height ? Math.min(Math.max(m.width / m.height, 0.75), 1.9) : 1.3;
    return <PrivateImage bucket="post-media" item={m} aspect={aspect} />;
  }
  const rows: MediaItem[][] = [];
  for (let i = 0; i < media.length; i += 2) rows.push(media.slice(i, i + 2));
  return (
    <View style={{ gap: 4 }}>
      {rows.map((row) => (
        <View key={row[0].path} style={{ flexDirection: 'row', gap: 4 }}>
          {row.map((m) => (
            <PrivateImage key={m.path} bucket="post-media" item={m} aspect={1} rounded={8} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function MessageImage({ path }: { path: string }) {
  return (
    <View style={{ width: 220 }}>
      <PrivateImage bucket="message-media" item={{ path, width: null, height: null }} aspect={1} />
    </View>
  );
}
