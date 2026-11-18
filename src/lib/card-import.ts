import type { Persona } from './types';

export interface ParsedCard {
  draft: Partial<Persona>;
  /** 卡片自带立绘（dataURL），由界面压缩后再存 */
  avatarSource?: string;
}

function base64ToText(b64: string): string {
  const binary = atob(b64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** 从 PNG 角色卡的 tEXt 块里取 chara / ccv3 JSON */
function extractPngCard(buffer: ArrayBuffer): string | null {
  const view = new DataView(buffer);
  let offset = 8; // PNG signature
  while (offset + 8 <= view.byteLength) {
    const length = view.getUint32(offset);
    const type = new TextDecoder('ascii').decode(new Uint8Array(buffer, offset + 4, 4));
    const dataStart = offset + 8;
    if (dataStart + length > view.byteLength) break;
    if (type === 'tEXt') {
      const data = new Uint8Array(buffer, dataStart, length);
      let sep = -1;
      for (let i = 0; i < data.length; i++) {
        if (data[i] === 0) {
          sep = i;
          break;
        }
      }
      if (sep > 0) {
        const keyword = new TextDecoder('latin1').decode(data.slice(0, sep));
        if (keyword === 'chara' || keyword === 'ccv3') {
          const text = new TextDecoder('latin1').decode(data.slice(sep + 1));
          try {
            return base64ToText(text);
          } catch {
            return null;
          }
        }
      }
    }
    offset = dataStart + length + 4; // skip CRC
  }
  return null;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function fromCardJson(json: unknown): ParsedCard {
  const root = (json ?? {}) as Record<string, unknown>;
  const data = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;

  const name = pickString(data, ['name', 'char_name', 'nickname']);
  const description = pickString(data, ['description', 'char_persona', 'persona', '设定']);
  const personality = pickString(data, ['personality']);
  const scenario = pickString(data, ['scenario', 'world', '背景']);
  const firstMes = pickString(data, ['first_mes', 'char_greeting', 'greeting', 'firstMessage']);
  const example = pickString(data, ['mes_example', 'example_dialogue', 'example']);
  const style = pickString(data, ['style', 'speech_style', '语气']);
  const forbidden = pickString(data, ['forbidden', '禁忌']);

  let worldbook = '';
  const book = data.character_book as { entries?: { content?: string; keys?: string[] }[] } | undefined;
  if (book?.entries?.length) {
    worldbook = book.entries
      .map((entry) => (entry.content ? `【${(entry.keys ?? []).join('、') || '设定'}】${entry.content}` : ''))
      .filter(Boolean)
      .join('\n');
  }

  const descriptionParts = [description, personality ? `性格：${personality}` : ''].filter(Boolean);

  return {
    draft: {
      name: name || '未命名角色',
      tagline: personality.slice(0, 24),
      description: descriptionParts.join('\n'),
      style,
      scenario,
      firstMes,
      example,
      worldbook,
      forbidden,
    },
  };
}

const FIELD_MAP: { keys: string[]; field: keyof Persona }[] = [
  { keys: ['名字', '姓名', '角色名', '名称', 'name'], field: 'name' },
  { keys: ['人设', '设定', '角色设定', 'description'], field: 'description' },
  { keys: ['说话风格', '语气', '口癖', 'style'], field: 'style' },
  { keys: ['场景', '背景', '当前情境', 'scenario'], field: 'scenario' },
  { keys: ['开场白', '第一句', 'greeting'], field: 'firstMes' },
  { keys: ['示例对话', '对话示例', 'example'], field: 'example' },
  { keys: ['世界书', '世界观', 'worldbook'], field: 'worldbook' },
  { keys: ['禁忌', '禁止', 'forbidden'], field: 'forbidden' },
  { keys: ['一句话', '简介', 'tagline'], field: 'tagline' },
];

function fromPlainText(text: string, fallbackName: string): ParsedCard {
  const draft: Partial<Persona> = {};
  const lines = text.split(/\r?\n/);
  let matched = 0;
  let current: keyof Persona | null = null;
  const buckets: Record<string, string[]> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) buckets[String(current)].push('');
      continue;
    }
    let hit: { field: keyof Persona; rest: string } | null = null;
    for (const item of FIELD_MAP) {
      for (const key of item.keys) {
        const re = new RegExp(`^${key}\\s*[：:]\\s*(.*)$`, 'i');
        const m = re.exec(trimmed);
        if (m) {
          hit = { field: item.field, rest: m[1] };
          break;
        }
      }
      if (hit) break;
    }
    if (hit) {
      matched += 1;
      current = hit.field;
      buckets[String(current)] = buckets[String(current)] ?? [];
      if (hit.rest.trim()) buckets[String(current)].push(hit.rest.trim());
    } else if (current) {
      buckets[String(current)].push(trimmed);
    }
  }

  if (matched === 0) {
    return {
      draft: {
        name: fallbackName || '未命名角色',
        description: text.trim(),
      },
    };
  }

  for (const [field, value] of Object.entries(buckets)) {
    const joined = value.join('\n').trim();
    if (joined) (draft as Record<string, string>)[field] = joined;
  }
  if (!draft.name) draft.name = fallbackName || '未命名角色';
  return { draft };
}

export async function parseCardFile(file: File): Promise<ParsedCard> {
  const lower = file.name.toLowerCase();
  const fallbackName = file.name.replace(/\.[^.]+$/, '');

  if (lower.endsWith('.png')) {
    const buffer = await file.arrayBuffer();
    const text = extractPngCard(buffer);
    if (!text) throw new Error('这张 PNG 里没有找到角色卡数据（需要 chara / ccv3 块）');
    const parsed = fromCardJson(JSON.parse(text));
    if (!parsed.draft.avatar) parsed.draft.avatar = undefined;
    const avatarSource = `data:image/png;base64,${await toBase64(buffer)}`;
    return { draft: parsed.draft, avatarSource };
  }

  const text = await file.text();
  if (lower.endsWith('.json')) {
    return fromCardJson(JSON.parse(text));
  }
  return fromPlainText(text, fallbackName);
}

async function toBase64(buffer: ArrayBuffer): Promise<string> {
  const blob = new Blob([buffer]);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败'));
    reader.readAsDataURL(blob);
  });
}
