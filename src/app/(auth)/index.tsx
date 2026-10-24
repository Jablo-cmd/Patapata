import { Link, router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Button, Text } from '@/components/ui';
import { SECONDARY_MESSAGE, TAGLINE } from '@/lib/constants';
import { palette } from '@/theme';

export default function Welcome() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.inner}>
        <View style={styles.hero}>
          <Brand size={34} />
          <Text variant="display" style={styles.tagline}>
            {TAGLINE}
          </Text>
          <Text style={styles.secondary}>{SECONDARY_MESSAGE}</Text>
          <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no">
            {[palette.teal400, palette.ochre500, palette.teal300, palette.ochre600, palette.teal600].map((c, i) => (
              <View key={c} style={[styles.dot, { backgroundColor: c, opacity: 1 - i * 0.12 }]} />
            ))}
          </View>
          <Text style={styles.copy}>
            Make friends, share your life, meet up and — if you want — date, with people across the continent. Free for
            everyone. No subscriptions, no paywalls.
          </Text>
        </View>

        <View style={styles.actions}>
          <Button title="Create a free account" variant="accent" size="lg" fullWidth onPress={() => router.push('/sign-up')} testID="welcome-sign-up" />
          <Button
            title="I already have an account"
            variant="inverse"
            size="lg"
            fullWidth
            onPress={() => router.push('/sign-in')}
            testID="welcome-sign-in"
          />
          <Text variant="caption" style={styles.legal} align="center">
            For adults aged 18+. By continuing you agree to our{' '}
            <Link href="/legal/terms" style={styles.link}>
              Terms
            </Link>
            ,{' '}
            <Link href="/legal/guidelines" style={styles.link}>
              Community Guidelines
            </Link>{' '}
            and{' '}
            <Link href="/legal/privacy" style={styles.link}>
              Privacy Policy
            </Link>
            .
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.navy800 },
  inner: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center', padding: 24, justifyContent: 'space-between' },
  hero: { gap: 16, marginTop: 32 },
  tagline: { color: '#FFFFFF', fontSize: 40, lineHeight: 46, marginTop: 24 },
  secondary: { color: palette.teal300, fontSize: 18, lineHeight: 24, fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  copy: { color: '#C9D6E6', fontSize: 16, lineHeight: 24 },
  actions: { gap: 12, marginBottom: 8 },
  legal: { color: '#A7B8CC', marginTop: 8 },
  link: { color: '#FFFFFF', textDecorationLine: 'underline' },
});
