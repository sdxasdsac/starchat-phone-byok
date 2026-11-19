'use client';

import { DEFAULT_SETTINGS, createDefaultPersona } from './defaults';
import type {
  Conversation,
  Group,
  MomentPost,
  Persona,
  Settings,
  XhsNote,
  XhsProfile,
} from './types';

export const STORAGE_KEYS = {
  settings: 'sp.settings.v1',
  personas: 'sp.personas.v1',
  conversations: 'sp.conversations.v1',
  moments: 'sp.moments.v1',
  xhs: 'sp.xhs.v1',
  xhsProfile: 'sp.xhsProfile.v1',
  groups: 'sp.groups.v1',
} as const;

export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // 本地存储写满时不要静默失败：抛出后由调用方提示用户导出/清理
    throw err instanceof Error ? err : new Error('本地存储写入失败');
  }
}

export function loadSettings(): Settings {
  const stored = read<Partial<Settings>>(STORAGE_KEYS.settings, {});
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    text: { ...DEFAULT_SETTINGS.text, ...(stored.text ?? {}) },
    image: { ...DEFAULT_SETTINGS.image, ...(stored.image ?? {}) },
    tts: { ...DEFAULT_SETTINGS.tts, ...(stored.tts ?? {}) },
    stt: { ...DEFAULT_SETTINGS.stt, ...(stored.stt ?? {}) },
    user: { ...DEFAULT_SETTINGS.user, ...(stored.user ?? {}) },
  };
}

export function saveSettings(settings: Settings): void {
  write(STORAGE_KEYS.settings, settings);
}

export function loadPersonas(): Persona[] {
  const stored = read<Persona[] | null>(STORAGE_KEYS.personas, null);
  if (stored && Array.isArray(stored) && stored.length > 0) return stored;
  const demo = [createDefaultPersona()];
  write(STORAGE_KEYS.personas, demo);
  return demo;
}

export function savePersonas(personas: Persona[]): void {
  write(STORAGE_KEYS.personas, personas);
}

export function loadConversations(): Conversation[] {
  return read<Conversation[]>(STORAGE_KEYS.conversations, []);
}

export function saveConversations(list: Conversation[]): void {
  write(STORAGE_KEYS.conversations, list);
}

export function loadMoments(): MomentPost[] {
  return read<MomentPost[]>(STORAGE_KEYS.moments, []);
}

export function saveMoments(list: MomentPost[]): void {
  write(STORAGE_KEYS.moments, list);
}

export function loadXhsNotes(): XhsNote[] {
  return read<XhsNote[]>(STORAGE_KEYS.xhs, []);
}

export function saveXhsNotes(list: XhsNote[]): void {
  write(STORAGE_KEYS.xhs, list);
}

export function loadXhsProfile(): XhsProfile | null {
  return read<XhsProfile | null>(STORAGE_KEYS.xhsProfile, null);
}

export function saveXhsProfile(profile: XhsProfile): void {
  write(STORAGE_KEYS.xhsProfile, profile);
}

export function loadGroups(): Group[] {
  return read<Group[]>(STORAGE_KEYS.groups, []);
}

export function saveGroups(list: Group[]): void {
  write(STORAGE_KEYS.groups, list);
}

export function exportAll(): string {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: loadSettings(),
    personas: loadPersonas(),
    conversations: loadConversations(),
    moments: loadMoments(),
    xhs: loadXhsNotes(),
    xhsProfile: loadXhsProfile(),
    groups: loadGroups(),
  };
  return JSON.stringify(data, null, 2);
}

export function importAll(json: string): void {
  const data = JSON.parse(json) as Record<string, unknown>;
  if (data.settings) write(STORAGE_KEYS.settings, data.settings);
  if (Array.isArray(data.personas)) write(STORAGE_KEYS.personas, data.personas);
  if (Array.isArray(data.conversations)) write(STORAGE_KEYS.conversations, data.conversations);
  if (Array.isArray(data.moments)) write(STORAGE_KEYS.moments, data.moments);
  if (Array.isArray(data.xhs)) write(STORAGE_KEYS.xhs, data.xhs);
  if (data.xhsProfile) write(STORAGE_KEYS.xhsProfile, data.xhsProfile);
  if (Array.isArray(data.groups)) write(STORAGE_KEYS.groups, data.groups);
}

export function clearAll(): void {
  Object.values(STORAGE_KEYS).forEach((key) => window.localStorage.removeItem(key));
}
