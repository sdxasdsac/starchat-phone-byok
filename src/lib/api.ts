'use client';

import {
  chatCompletionsUrl,
  imageGenerationsUrl,
  speechUrl,
  transcriptionUrl,
} from './endpoints';
import type { ImageConfig, Settings, SttConfig, TextConfig, TtsConfig } from './types';

export type ApiMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** 子路径部署（NEXT_PUBLIC_BASE_PATH=/phone）时，内部 API 也要带上前缀 */
const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');

function apiPath(path: string): string {
  return `${BASE_PATH}${path}`;
}

type StreamHandler = (delta: string, full: string) => void;

function authHeaders(apiKey: string): Record<string, string> {
  return apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {};
}

async function readError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      if (typeof json.error === 'string') return json.error;
      if (json.error?.message) return json.error.message;
      if (json.message) return json.message;
    } catch {
      /* 非 JSON 错误体 */
    }
    return text.slice(0, 300) || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

function pullDelta(payload: unknown): string {
  const obj = payload as {
    choices?: {
      delta?: { content?: string | null };
      message?: { content?: string | null };
      text?: string;
    }[];
  };
  const choice = obj.choices?.[0];
  return choice?.delta?.content ?? choice?.message?.content ?? choice?.text ?? '';
}

function pullFull(payload: unknown): string {
  const obj = payload as {
    choices?: { message?: { content?: string | null }; text?: string }[];
  };
  const choice = obj.choices?.[0];
  return choice?.message?.content ?? choice?.text ?? '';
}

/** 解析 SSE / 普通 JSON 两种上游返回，边收边回调 */
async function consumeChatResponse(res: Response, onDelta?: StreamHandler): Promise<string> {
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('text/event-stream')) {
    const json = (await res.json()) as unknown;
    const full = pullFull(json) || pullDelta(json);
    if (full && onDelta) onDelta(full, full);
    return full;
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('上游没有返回可读数据流');
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  let done = false;

  while (!done) {
    const { value, done: finished } = await reader.read();
    done = finished;
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !finished });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(':')) continue;
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const delta = pullDelta(JSON.parse(data));
        if (delta) {
          full += delta;
          onDelta?.(delta, full);
        }
      } catch {
        // 忽略心跳/非 JSON 行
      }
    }
  }

  if (!full && buffer.trim().startsWith('data:')) {
    try {
      const delta = pullDelta(JSON.parse(buffer.trim().slice(5)));
      if (delta) {
        full += delta;
        onDelta?.(delta, full);
      }
    } catch {
      /* ignore */
    }
  }

  return full;
}

export async function chatComplete(
  settings: Settings,
  messages: ApiMessage[],
  onDelta?: StreamHandler,
  signal?: AbortSignal,
): Promise<string> {
  const cfg: TextConfig = settings.text;
  if (!cfg.baseUrl.trim() || !cfg.model.trim()) {
    throw new Error('还没有配置文字模型：请到「设置 → 文字 API」填写 Base URL 和模型名');
  }

  const body = {
    model: cfg.model.trim(),
    messages,
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens,
    stream: true,
  };

  let res: Response;
  if (settings.apiMode === 'direct') {
    res = await fetch(chatCompletionsUrl(cfg.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(cfg.apiKey),
      },
      body: JSON.stringify(body),
      signal,
    });
  } else {
    res = await fetch(apiPath('/api/llm'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: cfg, ...body }),
      signal,
    });
  }

  if (!res.ok) throw new Error(await readError(res));
  return consumeChatResponse(res, onDelta);
}

export async function generateImage(
  settings: Settings,
  prompt: string,
  size?: string,
): Promise<{ dataUrl?: string; url?: string }> {
  const cfg: ImageConfig = settings.image;
  if (!cfg.baseUrl.trim() || !cfg.model.trim()) {
    throw new Error('还没有配置生图模型：请到「设置 → 图像 API」填写 Base URL 和模型名');
  }
  const body = {
    model: cfg.model.trim(),
    prompt,
    size: size || cfg.size || '1024x1024',
    n: 1,
  };

  let res: Response;
  if (settings.apiMode === 'direct') {
    res = await fetch(imageGenerationsUrl(cfg.baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(cfg.apiKey),
      },
      body: JSON.stringify({ ...body, response_format: 'b64_json' }),
    });
  } else {
    res = await fetch(apiPath('/api/image'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: cfg, ...body }),
    });
  }
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as {
    dataUrl?: string;
    url?: string;
    error?: string;
    data?: { b64_json?: string; url?: string }[];
  };
  if (json.error) throw new Error(json.error);
  if (json.dataUrl || json.url) return { dataUrl: json.dataUrl, url: json.url };
  const first = json.data?.[0];
  if (first?.b64_json) return { dataUrl: `data:image/png;base64,${first.b64_json}` };
  if (first?.url) return { url: first.url };
  throw new Error('生图接口没有返回图片');
}

export async function synthesizeSpeech(settings: Settings, text: string): Promise<Blob> {
  const cfg: TtsConfig = settings.tts;
  if (cfg.provider === 'browser') {
    throw new Error('BROWSER_TTS');
  }
  const res = await fetch(apiPath('/api/tts'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config: cfg, text }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.blob();
}

/** 语音识别：OpenAI 兼容 /audio/transcriptions（可选功能） */
export async function transcribe(
  settings: Settings,
  audio: Blob,
): Promise<string> {
  const cfg: SttConfig = settings.stt;
  if (!cfg.baseUrl.trim() || !cfg.model.trim()) {
    throw new Error('还没有配置语音识别：请到「设置 → 语音」填写识别接口');
  }
  const form = new FormData();
  form.append('file', audio, 'voice.webm');
  form.append('model', cfg.model.trim());

  let res: Response;
  if (settings.apiMode === 'direct') {
    res = await fetch(transcriptionUrl(cfg.baseUrl), {
      method: 'POST',
      headers: authHeaders(cfg.apiKey),
      body: form,
    });
  } else {
    res = await fetch(apiPath('/api/stt'), {
      method: 'POST',
      headers: {
        'x-stt-base-url': cfg.baseUrl,
        'x-stt-api-key': cfg.apiKey,
        'x-stt-model': cfg.model,
      },
      body: form,
    });
  }
  if (!res.ok) throw new Error(await readError(res));
  const json = (await res.json()) as { text?: string };
  return json.text ?? '';
}

/** 设置页的连接测试：发一条最短的对话 */
export async function testTextApi(cfg: TextConfig, mode: 'proxy' | 'direct'): Promise<string> {
  const settings = {
    text: cfg,
    apiMode: mode,
  } as Settings;
  const text = await chatComplete(settings, [{ role: 'user', content: '只回复：ok' }]);
  return text || '(空回复，但连接成功)';
}

export function browserSpeak(
  text: string,
  opts?: { rate?: number; pitch?: number; onEnd?: () => void },
): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    throw new Error('当前浏览器不支持系统朗读');
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'zh-CN';
  utter.rate = opts?.rate ?? 1;
  utter.pitch = opts?.pitch ?? 1;
  utter.onend = () => opts?.onEnd?.();
  utter.onerror = () => opts?.onEnd?.();
  window.speechSynthesis.speak(utter);
}

export { speechUrl };
