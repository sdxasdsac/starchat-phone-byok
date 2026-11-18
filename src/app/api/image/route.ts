import { NextRequest } from 'next/server';
import { imageGenerationsUrl, isValidHttpUrl } from '@/lib/endpoints';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Body = {
  config?: { baseUrl?: string; apiKey?: string; model?: string };
  model?: string;
  prompt?: string;
  size?: string;
  n?: number;
};

type ImageResponse = {
  data?: { b64_json?: string; url?: string; revised_prompt?: string }[];
  error?: { message?: string } | string;
};

function explainError(json: ImageResponse | null, fallback: string): string {
  if (!json) return fallback;
  if (typeof json.error === 'string') return json.error;
  if (json.error?.message) return json.error.message;
  return fallback;
}

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
  const prompt = body.prompt?.trim() ?? '';

  if (!isValidHttpUrl(baseUrl)) {
    return Response.json({ error: 'Base URL 不合法，需要 http(s) 地址' }, { status: 400 });
  }
  if (!model) return Response.json({ error: '缺少生图模型名' }, { status: 400 });
  if (!prompt) return Response.json({ error: '缺少 prompt' }, { status: 400 });

  const url = imageGenerationsUrl(baseUrl);
  const basePayload = {
    model,
    prompt,
    size: body.size || '1024x1024',
    n: body.n ?? 1,
  };

  const call = async (extra: Record<string, unknown>) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ ...basePayload, ...extra }),
      signal: AbortSignal.timeout(120_000),
    });

  let upstream: Response;
  try {
    // 优先 b64_json；部分中转站只接受 url 或不认识 response_format，按错误信息降级重试。
    upstream = await call({ response_format: 'b64_json' });
    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      if (/response_format|b64_json|invalid.*format/i.test(detail) || upstream.status === 400) {
        upstream = await call({ response_format: 'url' });
      } else {
        return Response.json({ error: detail.slice(0, 600) || `HTTP ${upstream.status}` }, { status: upstream.status });
      }
    }
    if (!upstream.ok) {
      upstream = await call({});
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : '上游请求失败';
    return Response.json({ error: `连接生图接口失败：${message}` }, { status: 502 });
  }

  if (!upstream.ok) {
    const detail = await upstream.text().catch(() => '');
    return Response.json({ error: detail.slice(0, 600) || `HTTP ${upstream.status}` }, { status: upstream.status });
  }

  let json: ImageResponse | null = null;
  try {
    json = (await upstream.json()) as ImageResponse;
  } catch {
    return Response.json({ error: '生图接口返回的不是 JSON' }, { status: 502 });
  }

  const first = json.data?.[0];
  if (!first) {
    return Response.json({ error: explainError(json, '生图接口没有返回 data') }, { status: 502 });
  }
  if (first.b64_json) {
    return Response.json({ dataUrl: `data:image/png;base64,${first.b64_json}`, revisedPrompt: first.revised_prompt });
  }
  if (first.url) {
    return Response.json({ url: first.url, revisedPrompt: first.revised_prompt });
  }
  return Response.json({ error: '生图接口既没有 b64_json 也没有 url' }, { status: 502 });
}
