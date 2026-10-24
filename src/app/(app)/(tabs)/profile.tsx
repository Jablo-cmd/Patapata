import { View } from 'react-native';

import { AppHeader } from '@/components/AppHeader';
import { ProfileScreen } from '@/components/ProfileView';
import { IconButton } from '@/components/ui';
import { useUserId } from '@/lib/auth';
import { router } from 'expo-router';

export default function MyProfile() {
  const userId = useUserId();
  return (
    <View style={{ flex: 1 }}>
      <AppHeader title="Profile" right={<IconButton icon="settings-outline" label="Settings" onPress={() => router.push('/settings')} />} />
      <ProfileScreen userId={userId} />
    </View>
  );
}
