import { clsx, type ClassValue } from 'clsx';
import Constants from 'expo-constants';

/** className combinator. Deliberately no tailwind-merge — the token set is
 * small and closed, so conflicting utility collisions are rare and easy to
 * spot in review. */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

/**
 * Resolves the base URL for Expo Router API routes across dev/native/web.
 * See https://ai-sdk.dev/docs/getting-started/expo
 */
export function generateAPIUrl(relativePath: string) {
  const path = relativePath.startsWith('/') ? relativePath : `/${relativePath}`;

  if (process.env.NODE_ENV === 'development') {
    const origin = Constants.experienceUrl?.replace('exp://', 'http://');
    if (origin) return origin.concat(path);
  }

  const base = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!base) {
    // Web builds are same-origin; native release builds need the env var set.
    return path;
  }
  return base.replace(/\/$/, '').concat(path);
}

export function formatClockTime(date: Date) {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
