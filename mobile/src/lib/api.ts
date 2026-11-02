import { API_BASE_URL } from './config';
import { getProfile } from './session';
import type { Dashboard, DiseaseResult, RecommendResult } from './types';

export class ApiError extends Error {}

const TIMEOUT_MS = 90_000;

const unreachable = () => new ApiError(`Cannot reach the server at ${API_BASE_URL}. Is the backend running?`);
const timedOut = () => new ApiError('The server took too long to answer. Please try again.');

function parseReply<T>(status: number, text: string): T {
  const ok = status >= 200 && status < 300;
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // Non-JSON body, e.g. a plain "Internal Server Error" from a crashed request
    throw new ApiError(ok ? 'The server sent an unreadable reply.' : `Server error (${status}). Please try again.`);
  }
  if (!ok) {
    throw new ApiError(typeof data?.detail === 'string' ? data.detail : `Server error (${status})`);
  }
  return data as T;
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, signal: controller.signal });
  } catch (e) {
    throw controller.signal.aborted ? timedOut() : e instanceof TypeError ? unreachable() : e;
  } finally {
    clearTimeout(timer);
  }
  return parseReply<T>(res.status, await res.text());
}

/**
 * Multipart upload of local files. Uses XMLHttpRequest on purpose: Expo SDK 58 installs
 * `expo/fetch` as the global fetch, and it rejects React Native's `{ uri, name, type }`
 * file parts ("Unsupported FormDataPart implementation"). RN's XHR still streams them natively.
 */
function upload<T>(path: string, form: FormData, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}${path}`);
    xhr.timeout = timeoutMs;
    xhr.onload = () => {
      try {
        resolve(parseReply<T>(xhr.status, xhr.responseText));
      } catch (e) {
        reject(e);
      }
    };
    xhr.onerror = () => reject(unreachable());
    xhr.ontimeout = () => reject(timedOut());
    xhr.send(form);
  });
}

const postJson = <T>(path: string, body: unknown) =>
  request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** React Native's FormData accepts {uri, name, type} objects for local files. */
function fileField(uri: string, name: string, type: string) {
  return { uri, name, type } as unknown as Blob;
}

const profile = () => {
  const p = getProfile();
  return { phone: p?.phone ?? 'guest', language: p?.language ?? 'en' };
};

export const api = {
  registerFarmer: () => {
    const p = getProfile();
    return postJson('/api/farmers', p);
  },

  chat: (message: string) =>
    postJson<{ reply_text: string; language: string; source_type: string }>('/api/chat', {
      message,
      ...profile(),
    }),

  voice: (audioUri: string) => {
    const form = new FormData();
    const { phone, language } = profile();
    form.append('audio', fileField(audioUri, 'question.m4a', 'audio/m4a'));
    form.append('phone', phone);
    form.append('language', language);
    return upload<{ user_text: string; reply_text: string; reply_audio_url: string; source_type: string }>(
      '/api/voice',
      form,
      180_000,
    );
  },

  detectDisease: (images: { uri: string; mimeType?: string }[], question: string) => {
    const form = new FormData();
    const { phone, language } = profile();
    images.forEach((img, i) => form.append('images', fileField(img.uri, `leaf_${i}.jpg`, img.mimeType ?? 'image/jpeg')));
    form.append('user_query', question);
    form.append('phone', phone);
    form.append('language', language);
    return upload<{ results: DiseaseResult[] }>('/api/disease/detect', form, 180_000);
  },

  recommendCrop: (inputs: Record<string, number | string>) =>
    postJson<RecommendResult>('/api/crop/recommend', { ...inputs, ...profile() }),

  dashboard: () => request<Dashboard>(`/api/dashboard/${encodeURIComponent(profile().phone)}`),
};
