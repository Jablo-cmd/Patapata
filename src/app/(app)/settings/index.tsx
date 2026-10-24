import Constants from 'expo-constants';
import { router } from 'expo-router';

import { Banner, Card, Divider, ListRow, Screen, Stack, Text } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { confirm } from '@/lib/dialogs';

export default function Settings() {
  const { account, signOut } = useAuth();
  return (
    <Screen edges={['left', 'right', 'bottom']}>
      <Stack gap={16}>
        <Card style={{ paddingVertical: 4 }}>
          <ListRow icon="person-outline" title="Edit profile" onPress={() => router.push('/settings/profile')} />
          <Divider />
          <ListRow icon="lock-closed-outline" title="Privacy" subtitle="Who sees your profile, friends and messages" onPress={() => router.push('/settings/privacy')} />
          <Divider />
          <ListRow icon="notifications-outline" title="Notifications" onPress={() => router.push('/settings/notifications')} />
          <Divider />
          <ListRow icon="heart-outline" title="Dating" subtitle="Optional — off unless you turn it on" onPress={() => router.push('/dating/setup')} />
          <Divider />
          <ListRow icon="ban-outline" title="Blocked members" onPress={() => router.push('/settings/blocked')} />
        </Card>
        <Card style={{ paddingVertical: 4 }}>
          <ListRow icon="key-outline" title="Account & security" subtitle="Password, email, deactivate or delete" onPress={() => router.push('/settings/account')} />
          <Divider />
          <ListRow icon="shield-outline" title="Moderation & appeals" onPress={() => router.push('/settings/moderation')} />
          {account?.staff_role ? (
            <>
              <Divider />
              <ListRow icon="construct-outline" title="Moderator dashboard" subtitle={`Signed in as ${account.staff_role}`} onPress={() => router.push('/admin')} />
            </>
          ) : null}
        </Card>
        <Card style={{ paddingVertical: 4 }}>
          <ListRow icon="shield-checkmark-outline" title="Meeting people safely" onPress={() => router.push('/legal/safety')} />
          <Divider />
          <ListRow icon="people-outline" title="Community Guidelines" onPress={() => router.push('/legal/guidelines')} />
          <Divider />
          <ListRow icon="document-text-outline" title="Privacy Policy" onPress={() => router.push('/legal/privacy')} />
          <Divider />
          <ListRow icon="reader-outline" title="Terms of Use" onPress={() => router.push('/legal/terms')} />
        </Card>
        <Banner icon="gift-outline">Patapata is free for everyone — no subscriptions, no paid boosts, no paywalls.</Banner>
        <Card style={{ paddingVertical: 4 }}>
          <ListRow
            icon="log-out-outline"
            title="Sign out"
            danger
            onPress={async () => {
              if (await confirm('Sign out?', 'You can sign back in any time.', 'Sign out')) signOut();
            }}
          />
        </Card>
        <Text variant="caption" color="textMuted" align="center">
          Patapata {Constants.expoConfig?.version ?? ''} · Africa Connects Here.
        </Text>
      </Stack>
    </Screen>
  );
}
