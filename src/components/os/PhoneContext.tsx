'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  Channel,
  ChatMessage,
  Conversation,
  Group,
  MomentPost,
  Persona,
  Settings,
  XhsNote,
  XhsProfile,
} from '@/lib/types';
import {
  loadConversations,
  loadGroups,
  loadMoments,
  loadPersonas,
  loadSettings,
  loadXhsNotes,
  loadXhsProfile,
  saveConversations,
  saveGroups,
  saveMoments,
  savePersonas,
  saveSettings,
  saveXhsNotes,
  saveXhsProfile,
  uid,
} from '@/lib/store';
import { createDefaultPersona, DEFAULT_SETTINGS } from '@/lib/defaults';

type Ctx = {
  ready: boolean;
  settings: Settings;
  setSettings: (next: Settings) => void;
  personas: Persona[];
  activePersona: Persona | null;
  setActivePersonaId: (id: string) => void;
  upsertPersona: (persona: Persona) => void;
  deletePersona: (id: string) => void;
  conversations: Conversation[];
  messagesOf: (channel: Channel, personaId: string) => ChatMessage[];
  appendMessage: (channel: Channel, personaId: string, message: ChatMessage) => void;
  clearConversation: (channel: Channel, personaId: string) => void;
  moments: MomentPost[];
  setMoments: (next: MomentPost[] | ((prev: MomentPost[]) => MomentPost[])) => void;
  xhs: XhsNote[];
  setXhs: (next: XhsNote[]) => void;
  xhsProfile: XhsProfile | null;
  setXhsProfile: (next: XhsProfile) => void;
  groups: Group[];
  upsertGroup: (group: Group) => void;
  deleteGroup: (id: string) => void;
};

const PhoneCtx = createContext<Ctx | null>(null);

export function usePhone(): Ctx {
  const ctx = useContext(PhoneCtx);
  if (!ctx) throw new Error('usePhone must be used inside PhoneProvider');
  return ctx;
}

export function PhoneProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [moments, setMomentsState] = useState<MomentPost[]>([]);
  const [xhs, setXhsState] = useState<XhsNote[]>([]);
  const [xhsProfile, setXhsProfileState] = useState<XhsProfile | null>(null);
  const [groups, setGroupsState] = useState<Group[]>([]);

  useEffect(() => {
    const loadedSettings = loadSettings();
    const loadedPersonas = loadPersonas();
    setSettingsState(loadedSettings);
    setPersonas(loadedPersonas);
    setConversations(loadConversations());
    setMomentsState(loadMoments());
    setXhsState(loadXhsNotes());
    setXhsProfileState(loadXhsProfile());
    setGroupsState(loadGroups());

    if (!loadedSettings.activePersonaId || !loadedPersonas.some((p) => p.id === loadedSettings.activePersonaId)) {
      const next = { ...loadedSettings, activePersonaId: loadedPersonas[0]?.id };
      setSettingsState(next);
      saveSettings(next);
    }
    setReady(true);
  }, []);

  const setSettings = useCallback((next: Settings) => {
    setSettingsState(next);
    saveSettings(next);
  }, []);

  const setActivePersonaId = useCallback(
    (id: string) => {
      setSettingsState((prev) => {
        const next = { ...prev, activePersonaId: id };
        saveSettings(next);
        return next;
      });
    },
    [],
  );

  const upsertPersona = useCallback((persona: Persona) => {
    setPersonas((prev) => {
      const exists = prev.some((p) => p.id === persona.id);
      const next = exists ? prev.map((p) => (p.id === persona.id ? persona : p)) : [persona, ...prev];
      savePersonas(next);
      return next;
    });
  }, []);

  const deletePersona = useCallback((id: string) => {
    setPersonas((prev) => {
      const next = prev.filter((p) => p.id !== id);
      savePersonas(next);
      return next;
    });
    setConversations((prev) => {
      const next = prev.filter((c) => c.personaId !== id);
      saveConversations(next);
      return next;
    });
    setMomentsState((prev) => {
      const next = prev.filter((m) => m.personaId !== id);
      saveMoments(next);
      return next;
    });
    setXhsState((prev) => {
      const next = prev.filter((n) => n.personaId !== id);
      saveXhsNotes(next);
      return next;
    });
  }, []);

  const messagesOf = useCallback(
    (channel: Channel, personaId: string) =>
      conversations.find((c) => c.channel === channel && c.personaId === personaId)?.messages ?? [],
    [conversations],
  );

  const appendMessage = useCallback((channel: Channel, personaId: string, message: ChatMessage) => {
    setConversations((prev) => {
      const index = prev.findIndex((c) => c.channel === channel && c.personaId === personaId);
      let next: Conversation[];
      if (index === -1) {
        next = [
          {
            id: uid('c_'),
            channel,
            personaId,
            messages: [message],
            updatedAt: Date.now(),
          },
          ...prev,
        ];
      } else {
        next = prev.map((c, i) =>
          i === index
            ? { ...c, messages: [...c.messages, message], updatedAt: Date.now() }
            : c,
        );
      }
      saveConversations(next);
      return next;
    });
  }, []);

  const clearConversation = useCallback((channel: Channel, personaId: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => !(c.channel === channel && c.personaId === personaId));
      saveConversations(next);
      return next;
    });
  }, []);

  const setMoments = useCallback((next: MomentPost[] | ((prev: MomentPost[]) => MomentPost[])) => {
    setMomentsState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      saveMoments(value);
      return value;
    });
  }, []);

  const setXhs = useCallback((next: XhsNote[]) => {
    setXhsState(next);
    saveXhsNotes(next);
  }, []);

  const setXhsProfile = useCallback((next: XhsProfile) => {
    setXhsProfileState(next);
    saveXhsProfile(next);
  }, []);

  const upsertGroup = useCallback((group: Group) => {
    setGroupsState((prev) => {
      const exists = prev.some((g) => g.id === group.id);
      const next = exists ? prev.map((g) => (g.id === group.id ? group : g)) : [group, ...prev];
      saveGroups(next);
      return next;
    });
  }, []);

  const deleteGroup = useCallback((id: string) => {
    setGroupsState((prev) => {
      const next = prev.filter((g) => g.id !== id);
      saveGroups(next);
      return next;
    });
    setConversations((prev) => {
      const next = prev.filter((c) => !(c.channel === 'group' && c.personaId === id));
      saveConversations(next);
      return next;
    });
  }, []);

  const activePersona = useMemo(() => {
    if (!personas.length) return null;
    return personas.find((p) => p.id === settings.activePersonaId) ?? personas[0];
  }, [personas, settings.activePersonaId]);

  // 第一次跑起来时如果用户把本地数据清空了，补一个默认角色，避免桌面点进去是空白
  useEffect(() => {
    if (!ready || personas.length > 0) return;
    const demo = createDefaultPersona();
    setPersonas([demo]);
    savePersonas([demo]);
    setActivePersonaId(demo.id);
  }, [ready, personas.length, setActivePersonaId]);

  const value: Ctx = {
    ready,
    settings,
    setSettings,
    personas,
    activePersona,
    setActivePersonaId,
    upsertPersona,
    deletePersona,
    conversations,
    messagesOf,
    appendMessage,
    clearConversation,
    moments,
    setMoments,
    xhs,
    setXhs,
    xhsProfile,
    setXhsProfile,
    groups,
    upsertGroup,
    deleteGroup,
  };

  return <PhoneCtx.Provider value={value}>{children}</PhoneCtx.Provider>;
}
