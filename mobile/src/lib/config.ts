import Constants from 'expo-constants';

/**
 * Backend URL. Order of precedence:
 *  1. EXPO_PUBLIC_API_BASE_URL (set in mobile/.env, e.g. http://192.168.1.10:8000)
 *  2. The IP of the machine running `npx expo start`, port 8000 — works for Expo Go on a phone
 *     on the same Wi-Fi and for the Android emulator, because the backend runs on that machine.
 */
function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return host ? `http://${host}:8000` : 'http://localhost:8000';
}

export const API_BASE_URL = resolveApiBaseUrl();

export const LANGUAGES: Record<string, string> = {
  en: 'English',
  hi: 'हिन्दी (Hindi)',
  ta: 'தமிழ் (Tamil)',
  te: 'తెలుగు (Telugu)',
  kn: 'ಕನ್ನಡ (Kannada)',
  ml: 'മലയാളം (Malayalam)',
  mr: 'मराठी (Marathi)',
  bn: 'বাংলা (Bengali)',
  gu: 'ગુજરાતી (Gujarati)',
  pa: 'ਪੰਜਾਬੀ (Punjabi)',
};
