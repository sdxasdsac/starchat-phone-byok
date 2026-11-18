/** 只朗读角色说出口的话：去掉 HTML、括号旁白、*动作*、markdown 标记。 */
export function stripForSpeech(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/（[^（）]*）/g, ' ')
    .replace(/\([^()]*\)/g, ' ')
    .replace(/\*[^*]*\*/g, ' ')
    .replace(/〔[^〔〕]*〕/g, ' ')
    .replace(/\[表情[:：][^\]]*\]/g, ' ')
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
};

export function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function extractTranscript(event: unknown): string {
  const e = event as {
    results?: { [index: number]: { [index: number]: { transcript?: string } } };
  };
  if (!e.results) return '';
  let out = '';
  for (let i = 0; i < Object.keys(e.results).length; i++) {
    const chunk = e.results[i]?.[0]?.transcript;
    if (chunk) out += chunk;
  }
  return out.trim();
}
