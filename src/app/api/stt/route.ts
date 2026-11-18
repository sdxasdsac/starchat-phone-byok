import { NextRequest } from 'next/server';
import { isValidHttpUrl, transcriptionUrl } from '@/lib/endpoints';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * 语音识别透传（可选）：OpenAI 兼容 /audio/transcriptions。
 * 配置从请求头带入，不落盘。
 */
export async function POST(req: NextRequest) {
  const baseUrl = (req.headers.get('x-stt-base-url') ?? '').trim();
  const apiKey = (req.headers.get('x-stt-api-key') ?? '').trim();
  const model = (req.headers.get('x-stt-model') ?? '').trim();

  if (!isValidHttpUrl(baseUrl)) {
    return Response.json({ error: '语音识别 Base URL 不合法' }, { status: 400 });
  }
  if (!model) {
    return Response.json({ error: '缺少语音识别模型名' }, { status: 400 });
  }

  let incoming: FormData;
  try {
    incoming = await req.formData();
  } catch {
    return Response.json({ error: '没有收到音频文件' }, { status: 400 });
  }

  const file = incoming.get('file');
  if (!(file instanceof Blob)) {
    return Response.json({ error: '没有收到音频文件' }, { status: 400 });
  }

  const form = new FormData();
  form.append('file', file, 'voice.webm');
  form.append('model', model);

  try {
    const upstream = await fetch(transcriptionUrl(baseUrl), {
      method: 'POST',
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '语音识别请求失败';
    return Response.json({ error: message }, { status: 502 });
  }
}
