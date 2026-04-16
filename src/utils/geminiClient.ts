import { httpsCallable } from 'firebase/functions';
import * as ImageManipulator from 'expo-image-manipulator';
import { functions } from '../firebase';
import { MushroomPhotoAnalysis, TrailInsightsParams, TrailInsightsResult } from '../types';

const CALLABLE_TIMEOUT_MS = 15_000;

/**
 * Compress a local image URI to JPEG base64, max 1024px wide, 70% quality.
 * Returns the base64 string (no data: prefix) or null on failure.
 */
async function compressToBase64(localUri: string): Promise<string | null> {
  try {
    const result = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 1024 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    return result.base64 ?? null;
  } catch {
    return null;
  }
}

/**
 * Send a mushroom photo to the AI for morphological analysis.
 * Returns structured trait observations or null on any failure.
 */
export async function analyzeMushroomPhoto(
  localUri: string
): Promise<MushroomPhotoAnalysis | null> {
  try {
    const base64 = await compressToBase64(localUri);
    if (!base64) return null;

    const fn = httpsCallable(functions, 'analyzeMushroomPhoto', {
      timeout: CALLABLE_TIMEOUT_MS,
    });
    const result = await fn({ imageBase64: base64, mimeType: 'image/jpeg' });
    return result.data as MushroomPhotoAnalysis;
  } catch (error) {
    console.warn('[geminiClient] analyzeMushroomPhoto failed:', error);
    return null;
  }
}

/**
 * Generate AI-enhanced trail narrative (field briefing + species spotlight).
 * Returns both strings or null on any failure.
 */
export async function generateTrailInsights(
  params: TrailInsightsParams
): Promise<TrailInsightsResult | null> {
  try {
    const fn = httpsCallable(functions, 'generateTrailInsights', {
      timeout: CALLABLE_TIMEOUT_MS,
    });
    const result = await fn(params);
    return result.data as TrailInsightsResult;
  } catch (error) {
    console.warn('[geminiClient] generateTrailInsights failed:', error);
    return null;
  }
}
