import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { View } from 'react-native';

import { Avatar, Card, Row, Text } from '@/components/ui';
import { categoryLabel } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { useCountries } from '@/lib/hooks';
import type { Meetup } from '@/lib/types';
import { useTheme } from '@/theme';

export function MeetupCard({ meetup: m }: { meetup: Meetup }) {
  const { colors } = useTheme();
  const { byCode } = useCountries();
  const cat = categoryLabel(m.category);
  const country = byCode.get(m.country_code);
  return (
    <Card onPress={() => router.push(`/meetups/${m.id}`)}>
      <View style={{ gap: 8 }}>
        <Row gap={8}>
          <Text style={{ fontSize: 22 }} accessibilityElementsHidden>
            {cat?.emoji}
          </Text>
          <Text variant="caption" color="textMuted" style={{ flex: 1 }}>
            {m.kind === 'chill' ? 'CHILL INVITE' : 'MEETUP'} · {cat?.label.toUpperCase()}
            {m.audience === 'friends' ? ' · FRIENDS' : ''}
          </Text>
          {m.status === 'cancelled' ? (
            <Text variant="caption" color="danger" style={{ fontWeight: '700' }}>
              CANCELLED
            </Text>
          ) : null}
        </Row>
        <Text variant="heading">{m.title}</Text>
        <Row gap={6}>
          <Ionicons name="location-outline" size={16} color={colors.textMuted} />
          <Text variant="small" color="textMuted">
            {m.city}
            {country ? `, ${country.flag_emoji} ${country.name}` : ''}
          </Text>
        </Row>
        {m.starts_at ? (
          <Row gap={6}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <Text variant="small" color="textMuted">
              {formatDateTime(m.starts_at)}
            </Text>
          </Row>
        ) : null}
        <Row gap={8} style={{ marginTop: 4 }}>
          <Avatar path={m.host_avatar_path} name={m.host_display_name} seed={m.host_id} size={24} />
          <Text variant="small" style={{ flex: 1 }} numberOfLines={1}>
            {m.host_display_name}
          </Text>
          <Text variant="small" color="primary" style={{ fontWeight: '700' }}>
            {m.going_count} going{m.capacity ? ` / ${m.capacity}` : ''}
          </Text>
        </Row>
      </View>
    </Card>
  );
}
