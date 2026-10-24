import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, Stack as RouterStack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { PostCard } from '@/components/PostCard';
import { Banner, Button, Chip, LoadingState, Row, Screen, Stack, Text, TextField } from '@/components/ui';
import { createPost, getPost, updatePost } from '@/lib/api';
import { useUserId } from '@/lib/auth';
import { AUDIENCES } from '@/lib/constants';
import { friendlyError } from '@/lib/errors';
import { uuid } from '@/lib/ids';
import { pickImages, uploadImage, type LocalImage } from '@/lib/media';
import type { FeedPost, PostAudience } from '@/lib/types';
import { useTheme } from '@/theme';

const MAX_IMAGES = 6;

type Uploaded = { path: string; width: number; height: number };

export default function Compose() {
  const { edit: editId, share: shareId } = useLocalSearchParams<{ edit?: string; share?: string }>();
  const editing = useQuery({ queryKey: ['post', editId], queryFn: () => getPost(editId!), enabled: Boolean(editId) });
  const sharing = useQuery({ queryKey: ['post', shareId], queryFn: () => getPost(shareId!), enabled: Boolean(shareId) });
  if ((editId && editing.isLoading) || (shareId && sharing.isLoading)) return <LoadingState />;
  return (
    <ComposeForm
      editId={editId}
      shareId={shareId}
      sharing={sharing.data ?? null}
      initialBody={editing.data?.body ?? ''}
      initialAudience={editing.data?.audience ?? 'friends'}
    />
  );
}

function ComposeForm({
  editId,
  shareId,
  sharing,
  initialBody,
  initialAudience,
}: {
  editId?: string;
  shareId?: string;
  sharing: FeedPost | null;
  initialBody: string;
  initialAudience: PostAudience;
}) {
  const me = useUserId();
  const queryClient = useQueryClient();
  const { colors, radii } = useTheme();
  const [body, setBody] = useState(initialBody);
  const [audience, setAudience] = useState<PostAudience>(initialAudience);
  const [images, setImages] = useState<LocalImage[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // One id per composer session: retries and double taps can't create duplicates.
  const [requestId] = useState(uuid);
  // Uploads survive a failed submit, so retrying doesn't upload photos twice.
  const uploads = useRef(new Map<string, Uploaded>());

  async function addImages() {
    setError(null);
    try {
      const picked = await pickImages({ multiple: true, max: MAX_IMAGES - images.length });
      setImages((cur) => [...cur, ...picked].slice(0, MAX_IMAGES));
    } catch (e) {
      setError((e as Error).message === 'photo_permission_denied' ? 'Allow photo access in your settings to add pictures.' : friendlyError(e));
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (editId) {
        await updatePost(editId, { body: body.trim(), audience });
      } else {
        const media: Uploaded[] = [];
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          let uploaded = uploads.current.get(img.uri);
          if (!uploaded) {
            setProgress(`Uploading photo ${i + 1} of ${images.length}…`);
            uploaded = await uploadImage('post-media', me, img, 'post');
            uploads.current.set(img.uri, uploaded);
          }
          media.push(uploaded);
        }
        setProgress('Posting…');
        await createPost({ body, audience, media, sharedPostId: shareId, clientRequestId: requestId });
      }
      await queryClient.invalidateQueries({ queryKey: ['feed'] });
      if (editId) queryClient.invalidateQueries({ queryKey: ['post', editId] });
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const canPost = body.trim().length > 0 || images.length > 0 || Boolean(shareId);

  return (
    <Screen keyboard edges={['left', 'right', 'bottom']}>
      <RouterStack.Screen options={{ title: editId ? 'Edit post' : shareId ? 'Share post' : 'Create post' }} />
      <Stack gap={16}>
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <TextField
          placeholder={shareId ? 'Say something about this (optional)' : 'What’s on your mind? Use @username to mention someone.'}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={5000}
          maxLengthCounter
          autoFocus
          style={{ minHeight: 120 }}
          testID="compose-body"
        />

        <View style={{ gap: 8 }}>
          <Text variant="small" color="textMuted" style={{ fontWeight: '600' }}>
            Who can see this?
          </Text>
          <Row wrap gap={8}>
            {AUDIENCES.map((a) => (
              <Chip key={a.value} label={a.label} icon={a.icon} selected={audience === a.value} onPress={() => setAudience(a.value)} />
            ))}
          </Row>
          <Text variant="caption" color="textMuted">
            {AUDIENCES.find((a) => a.value === audience)?.description}
            {audience !== 'public' ? ' · Only public posts can be shared by others.' : ''}
          </Text>
        </View>

        {!editId && !shareId ? (
          <View style={{ gap: 8 }}>
            <Row wrap gap={8}>
              {images.map((img, i) => (
                <View key={img.uri} style={{ width: 96, height: 96, borderRadius: radii.md, overflow: 'hidden' }}>
                  <Image source={{ uri: img.uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" accessibilityLabel={`Selected photo ${i + 1}`} />
                  <Pressable
                    onPress={() => setImages((cur) => cur.filter((x) => x.uri !== img.uri))}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove photo ${i + 1}`}
                    style={{ position: 'absolute', top: 4, right: 4, backgroundColor: colors.overlay, borderRadius: 14, padding: 4 }}>
                    <Ionicons name="close" size={16} color="#FFFFFF" />
                  </Pressable>
                </View>
              ))}
            </Row>
            {images.length < MAX_IMAGES ? (
              <Button title={images.length ? 'Add more photos' : 'Add photos'} icon="images-outline" variant="secondary" onPress={addImages} />
            ) : null}
            <Text variant="caption" color="textMuted">
              Up to {MAX_IMAGES} photos. We shrink them before upload to save your data, and remove location metadata.
            </Text>
          </View>
        ) : null}

        {editId ? (
          <Text variant="caption" color="textMuted">
            You can edit the text and audience. To change photos, delete the post and create a new one.
          </Text>
        ) : null}

        {sharing ? (
          <View style={{ opacity: 0.95 }}>
            <PostCard post={sharing} detail />
          </View>
        ) : null}

        {progress ? (
          <Text variant="small" color="textMuted" accessibilityLiveRegion="polite">
            {progress}
          </Text>
        ) : null}
        <Button
          title={editId ? 'Save changes' : shareId ? 'Share' : 'Post'}
          size="lg"
          onPress={submit}
          loading={busy}
          disabled={!canPost}
          fullWidth
          testID="compose-submit"
        />
      </Stack>
    </Screen>
  );
}
