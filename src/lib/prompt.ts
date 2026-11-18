import type { ChatMessage, Channel, Persona, Settings } from './types';
import { MUFY_PRESET_SYSTEM } from './builtin-preset';
import { stickerNames } from './nannan-stickers';
import { buildWechatPreset } from './wechat-preset';

/**
 * 把角色卡字段拼成系统提示词。
 * 兼容 {{char}} / {{user}} 占位符。
 */
export function buildSystemPrompt(persona: Persona, settings: Settings): string {
  const user = settings.user;
  const replace = (text: string) =>
    text.replaceAll('{{char}}', persona.name).replaceAll('{{user}}', user.name || '我');

  const parts = [
    settings.presetEnabled ? MUFY_PRESET_SYSTEM : '',
    `你现在扮演「${persona.name}」，正在和「${user.name || '我'}」用手机聊天。`,
    persona.tagline ? `一句话定位：${persona.tagline}` : '',
    persona.description ? `【角色设定】\n${replace(persona.description)}` : '',
    persona.style ? `【说话风格】\n${replace(persona.style)}` : '',
    persona.scenario ? `【当前情境】\n${replace(persona.scenario)}` : '',
    persona.worldbook ? `【世界观 / 背景】\n${replace(persona.worldbook)}` : '',
    persona.example ? `【对话示例】\n${replace(persona.example)}` : '',
    user.bio ? `【关于${user.name || '我'}】\n${replace(user.bio)}` : '',
    persona.forbidden ? `【禁止事项】\n${replace(persona.forbidden)}` : '',
    [
      '【聊天规则】',
      '1. 像真人发微信一样自然，默认 1~3 句，不要长篇大论。',
      '2. 不要代替用户说话或行动，不要输出用户的心理活动。',
      '3. 不要每句都加括号动作；需要动作时克制使用。',
      '4. 保持角色一致，记得之前聊过的内容。',
      '5. 只输出角色要发给用户的消息本身，不要加“角色：”前缀。',
      `6. 你可以发真实表情包：单独一行写 [表情:名称]，名称只能从这些里原样选：${stickerNames().join('、')}。一条回复最多发一个，跟在你刚才那句话后面。`,
    ].join('\n'),
  ];

  return parts.filter(Boolean).join('\n\n');
}

export function toApiMessages(
  persona: Persona,
  settings: Settings,
  history: ChatMessage[],
  channel?: Channel,
) {
  const system = [buildSystemPrompt(persona, settings), channel === 'wechat' ? buildWechatPreset() : '']
    .filter(Boolean)
    .join('\n\n');
  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: system },
  ];
  // 只带最近 40 条，避免长会话把上下文撑爆
  for (const m of history.slice(-40)) {
    if (m.role === 'system') continue;
    if (!m.text.trim() && !m.imageUrl && !m.imageId) continue;
    messages.push({
      role: m.role,
      content: m.text || '（发送了一张图片）',
    });
  }
  return messages;
}

export function greetingFor(persona: Persona): string {
  if (persona.firstMes?.trim()) return persona.firstMes.trim();
  return `「${persona.name}在这里。想聊点什么？」`;
}

/** 朋友圈：让模型按角色口吻生成 3 条动态 */
export function momentsPrompt(persona: Persona, settings: Settings): string {
  return [
    `你是「${persona.name}」。${persona.description}`,
    persona.style ? `说话风格：${persona.style}` : '',
    `请以${persona.name}的口吻生成 3 条微信朋友圈，形成时间线或情绪递进。`,
    '只输出 JSON 数组，不要 markdown 代码块，不要解释。格式：',
    '[{"text":"动态正文，1~3 句，带 1~2 个 emoji","images":[{"emoji":"🌆","color":"#FFE3EC"}],"time":"今天 21:40"}]',
    'images 里 1~2 个，emoji 是配图内容，color 是浅色背景色。',
  ]
    .filter(Boolean)
    .join('\n');
}

/** 小红书：生成主页资料 + 3 篇笔记 */
export function xhsPrompt(persona: Persona): string {
  return [
    `你是「${persona.name}」。${persona.description}`,
    persona.style ? `说话风格：${persona.style}` : '',
    '请生成一个小红书博主主页资料和 3 篇笔记。只输出 JSON，不要 markdown 代码块。格式：',
    '{"profile":{"handle":"英文或数字账号","bio":"不超过18字","ip":"上海","gender":"女","age":"22岁","job":"情感博主","following":"1","fans":"5.2万","likes":"131.4万"},"notes":[{"title":"笔记标题","content":"正文，2~4 句","coverEmoji":"🌷","coverColor":"#FFD9E6","likes":"1.2万"}]}',
  ]
    .filter(Boolean)
    .join('\n');
}
