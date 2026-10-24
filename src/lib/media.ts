import { useQuery } from '@tanstack/react-query';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { fileId } from './ids';
import { supabase } from './supabase';

export type Bucket = 'avatars' | 'post-media' | 'message-media';

export type LocalImage = { uri: string; width: number; height: number };

/** Upload presets: small enough for constrained networks, sharp enough on phones. */
export const IMAGE_PRESETS = {
  avatar: { maxSide: 512, quality: 0.75 },
  cover: { maxSide: 1280, quality: 0.7 },
  post: { maxSide: 1280, quality: 0.7 },
  message: { maxSide: 1080, quality: 0.65 },
} as const;

export type ImagePreset = keyof typeof IMAGE_PRESETS;

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export async function pickImages(options: { multiple?: boolean; max?: number } = {}): Promise<LocalImage[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted && permission.accessPrivileges !== 'limited') {
    throw new Error('photo_permission_denied');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: options.multiple ?? false,
    selectionLimit: options.max ?? 1,
    quality: 1,
    exif: false,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

/** Resizes and re-encodes to JPEG, which also strips EXIF metadata (e.g. GPS). */
export async function compressImage(image: LocalImage, preset: ImagePreset): Promise<LocalImage> {
  const { maxSide, quality } = IMAGE_PRESETS[preset];
  const landscape = image.width >= image.height;
  const context = ImageManipulator.manipulate(image.uri, landscape ? { maxWidth: maxSide * 2 } : { maxHeight: maxSide * 2 });
  if (Math.max(image.width, image.height) > maxSide) {
    context.resize(landscape ? { width: maxSide } : { height: maxSide });
  }
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: quality, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

async function readBytes(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}

/**
 * Compresses and uploads an image into `folder` of `bucket`. Returns the
 * storage path plus dimensions. Never overwrites existing files.
 */
export async function uploadImage(
  bucket: Bucket,
  folder: string,
  image: LocalImage,
  preset: ImagePreset,
): Promise<{ path: string; width: number; height: number }> {
  const compressed = await compressImage(image, preset);
  const bytes = await readBytes(compressed.uri);
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new Error('image_too_large');
  }
  const path = `${folder}/${fileId()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
    cacheControl: '31536000',
  });
  if (error) throw error;
  return { path, width: compressed.width, height: compressed.height };
}

export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Signed URL for a private image, cached for most of its lifetime. */
export function useSignedImageUrl(bucket: Exclude<Bucket, 'avatars'>, path: string | null | undefined) {
  return useQuery({
    queryKey: ['signed-url', bucket, path],
    enabled: Boolean(path),
    staleTime: (SIGNED_URL_TTL_SECONDS - 300) * 1000,
    gcTime: SIGNED_URL_TTL_SECONDS * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path!, SIGNED_URL_TTL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
