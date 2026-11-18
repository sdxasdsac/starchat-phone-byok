// 统一的接口地址拼装：客户端与服务端共用，避免两边规则不一致。

export function normalizeBaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/chat\/completions$/i, '')
    .replace(/\/images\/(?:generations|edits)$/i, '')
    .replace(/\/images$/i, '')
    .replace(/\/audio\/speech$/i, '')
    .replace(/\/audio\/transcriptions$/i, '');
}

export function chatCompletionsUrl(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl);
  return `${base}/chat/completions`;
}

export function imageGenerationsUrl(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl);
  return `${base}/images/generations`;
}

export function speechUrl(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl);
  return `${base}/audio/speech`;
}

export function transcriptionUrl(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl);
  return `${base}/audio/transcriptions`;
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
