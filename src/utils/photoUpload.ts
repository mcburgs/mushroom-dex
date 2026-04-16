import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { storage, auth } from '../firebase';

/**
 * Compress a local image and upload it to Firebase Storage.
 * Returns the public download URL.
 *
 * Path: users/{uid}/finds/{mushroomId}/{timestamp}.jpg
 */
export async function uploadFindPhoto(
  uid: string,
  mushroomId: string,
  localUri: string,
): Promise<string> {
  // Compress: max 1200px longest edge, 60% JPEG quality
  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 1200 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
  );

  const response = await fetch(manipulated.uri);
  const blob = await response.blob();

  const filename = `${Date.now()}.jpg`;
  const storageRef = ref(storage, `users/${uid}/finds/${mushroomId}/${filename}`);

  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

/**
 * Returns true if the path looks like a local file URI (not yet uploaded).
 */
export function isLocalUri(path: string): boolean {
  return path.startsWith('file://') || path.startsWith('content://') || path.startsWith('/');
}

/**
 * Process an array of photo paths: upload any local URIs to Firebase Storage,
 * return an array of remote download URLs.
 *
 * If any individual upload fails, it is skipped (logged, not thrown).
 * This ensures the find save is never blocked by a photo upload failure.
 */
export async function processPhotosForUpload(
  uid: string,
  mushroomId: string,
  photoPaths: string[],
): Promise<string[]> {
  const results: string[] = [];

  for (const path of photoPaths) {
    if (!isLocalUri(path)) {
      // Already a remote URL — keep as-is
      results.push(path);
      continue;
    }
    try {
      const url = await uploadFindPhoto(uid, mushroomId, path);
      results.push(url);
    } catch (error) {
      console.warn('[photoUpload] Failed to upload photo, skipping:', error);
    }
  }

  return results;
}
