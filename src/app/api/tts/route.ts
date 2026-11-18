import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { isValidHttpUrl, speechUrl } from '@/lib/endpoints';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  config?: {
    provider?: 'volc' | 'minimax' | 'openai' | 'browser';
    apiKey?: string;
    voiceId?: string;
    speed?: number;
    pitch?: number;
    groupId?: string;
    model?: string;
    baseUrl?: string;
  };
  text?: string;
};

const MAX_TEXT = 600;

function clampRate(speed: number): number {
  // 火山 speech_rate 范围 [-50, 100]，1.0 对应 0
  return Math.max(-50, Math.min(100, Math.round((speed - 1) * 100)));
}

function clampPitch(pitch: number): number {
  return Math.max(-12, Math.min(12, Math.round(pitch)));
}

async function volcTts(opts: {
  apiKey: string;
  text: string;
  speaker: string;
  speed: number;
  pitch: number;
}): Promise<Buffer> {
  const resp = await fetch('https://openspeech.bytedance.com/api/v3/tts/unidirectional', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': opts.apiKey,
      'X-Api-Resource-Id': 'seed-tts-2.0',
      'X-Api-Request-Id': randomUUID(),
    },
    body: JSON.stringify({
      user: { uid: 'starchat-phone-byok' },
      req_params: {
        text: opts.text,
        speaker: opts.speaker,
        audio_params: {
          format: 'mp3',
          sample_rate: 24000,
          speech_rate: clampRate(opts.speed),
        },
        ...(opts.pitch !== 0
          ? { additions: JSON.stringify({ post_process: { pitch: clampPitch(opts.pitch) } }) }
          : {}),
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!resp.ok) {
    const detail = (await resp.text().catch(() => '')).slice(0, 400);
    throw new Error(`火山 TTS HTTP ${resp.status}：${detail}`);
  }

  const raw = await resp.text();
  const chunks: Buffer[] = [];
  let upstreamError = '';
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const obj = JSON.parse(trimmed) as { code?: number; message?: string; data?: string };
      if (obj.code !== undefined && obj.code !== 0 && obj.code !== 20000000) {
        upstreamError = obj.message || `code ${obj.code}`;
        break;
      }
      if (obj.data) chunks.push(Buffer.from(obj.data, 'base64'));
    } catch {
      // 心跳/非 JSON 行
    }
  }
  if (upstreamError) throw new Error(`火山 TTS：${upstreamError}`);
  const audio = Buffer.concat(chunks);
  if (audio.length === 0) throw new Error('火山 TTS 没有返回音频');
  return audio;
}

async function minimaxTts(opts: {
  apiKey: string;
  groupId: string;
  text: string;
  voiceId: string;
  model: string;
  speed: number;
  pitch: number;
  baseUrl: string;
}): Promise<Buffer> {
  const base = (opts.baseUrl || 'https://api.minimax.chat/v1').replace(/\/+$/, '');
  const url = `${base}/t2a_v2?GroupId=${encodeURIComponent(opts.groupId)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.apiKey}`,
    },
    body: JSON.stringify({
      model: opts.model || 'speech-02-hd',
      text: opts.text,
      stream: false,
      voice_setting: {
        voice_id: opts.voiceId || 'female-shaonv',
        speed: opts.speed,
        vol: 1,
        pitch: clampPitch(opts.pitch),
      },
      audio_setting: {
        sample_rate: 32000,
        bitrate: 128000,
        format: 'mp3',
        channel: 1,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!resp.ok) {
    const detail = (await resp.text().catch(() => '')).slice(0, 400);
    throw new Error(`MiniMax TTS HTTP ${resp.status}：${detail}`);
  }

  const json = (await resp.json()) as {
    data?: { audio?: string };
    base_resp?: { status_code?: number; status_msg?: string };
  };
  if (json.base_resp?.status_code && json.base_resp.status_code !== 0) {
    throw new Error(`MiniMax TTS：${json.base_resp.status_msg || json.base_resp.status_code}`);
  }
  const hex = json.data?.audio;
  if (!hex) throw new Error('MiniMax TTS 没有返回音频');
  return Buffer.from(hex, 'hex');
}

async function openaiTts(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
  voice: string;
  text: string;
  speed: number;
}): Promise<Buffer> {
  if (!isValidHttpUrl(opts.baseUrl)) throw new Error('OpenAI 语音 Base URL 不合法');
  const resp = await fetch(speechUrl(opts.baseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.apiKey ? { Authorization: `Bearer ${opts.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: opts.model || 'tts-1',
      input: opts.text,
      voice: opts.voice || 'alloy',
      speed: opts.speed,
      response_format: 'mp3',
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!resp.ok) {
    const detail = (await resp.text().catch(() => '')).slice(0, 400);
    throw new Error(`OpenAI TTS HTTP ${resp.status}：${detail}`);
  }
  return Buffer.from(await resp.arrayBuffer());
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const cfg = body.config ?? {};
  const text = (body.text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  if (!text) return Response.json({ error: '缺少要朗读的文字' }, { status: 400 });
  if (cfg.provider === 'browser') {
    return Response.json({ error: 'browser 模式由前端直接朗读，不需要调用此接口' }, { status: 400 });
  }
  if (!cfg.apiKey?.trim()) {
    return Response.json({ error: '还没有填写语音 API Key' }, { status: 400 });
  }

  try {
    let audio: Buffer;
    if (cfg.provider === 'volc') {
      audio = await volcTts({
        apiKey: cfg.apiKey.trim(),
        text,
        speaker: cfg.voiceId?.trim() || 'zh_female_xiaohe_uranus_bigtts',
        speed: cfg.speed ?? 1,
        pitch: cfg.pitch ?? 0,
      });
    } else if (cfg.provider === 'minimax') {
      if (!cfg.groupId?.trim()) {
        return Response.json({ error: 'MiniMax 需要填写 GroupId' }, { status: 400 });
      }
      audio = await minimaxTts({
        apiKey: cfg.apiKey.trim(),
        groupId: cfg.groupId.trim(),
        text,
        voiceId: cfg.voiceId?.trim() || 'female-shaonv',
        model: cfg.model?.trim() || 'speech-02-hd',
        speed: cfg.speed ?? 1,
        pitch: cfg.pitch ?? 0,
        baseUrl: cfg.baseUrl || 'https://api.minimax.chat/v1',
      });
    } else if (cfg.provider === 'openai') {
      audio = await openaiTts({
        baseUrl: cfg.baseUrl?.trim() || 'https://api.openai.com/v1',
        apiKey: cfg.apiKey.trim(),
        model: cfg.model?.trim() || 'tts-1',
        voice: cfg.voiceId?.trim() || 'alloy',
        text,
        speed: cfg.speed ?? 1,
      });
    } else {
      return Response.json({ error: '未知的语音服务商' }, { status: 400 });
    }

    return new Response(new Uint8Array(audio), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '语音合成失败';
    return Response.json({ error: message }, { status: 502 });
  }
}
