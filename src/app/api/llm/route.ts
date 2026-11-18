import { NextRequest } from 'next/server';
import { chatCompletionsUrl, isValidHttpUrl } from '@/lib/endpoints';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  config?: { baseUrl?: string; apiKey?: string; model?: string };
  model?: string;
  messages?: unknown;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
};

/**
 * 文字模型透传：用户浏览器 → 用户自己的 Vercel 函数 → 第三方 LLM。
 * Key 只在本次请求里使用，不写日志、不落盘。
 */
export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return Response.json({ error: '请求体不是合法 JSON' }, { status: 400 });
  }

  const baseUrl = body.config?.baseUrl?.trim() ?? '';
  const apiKey = body.config?.apiKey?.trim() ?? '';
  const model = (body.model || body.config?.model || '').trim();

  if (!isValidHttpUrl(baseUrl)) {
    return Response.json({ error: 'Base URL 不合法，需要 http(s) 地址' }, { status: 400 });
  }
  if (!model) {
    return Response.json({ error: '缺少模型名' }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: '缺少 messages' }, { status: 400 });
  }

  const payload = {
    model,
    messages: body.messages,
    temperature: body.temperature ?? 0.9,
    max_tokens: body.max_tokens ?? 1200,
    stream: body.stream !== false,
  };

  let upstream: Response;
  try {
    upstream = await fetch(chatCompletionsUrl(baseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '上游请求失败';
    return Response.json({ error: `连接上游失败：${message}` }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = (await upstream.text().catch(() => '')).slice(0, 600);
    return new Response(detail || `上游 HTTP ${upstream.status}`, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'text/plain; charset=utf-8' },
    });
  }

  if (payload.stream) {
    return new Response(upstream.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    },
  });
}
