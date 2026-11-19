import type { MessageKind, MessagePayload } from './types';

export interface ChatCard {
  kind: MessageKind;
  payload: MessagePayload;
  /** 原始标记，保留用于展示兜底 */
  raw: string;
}

export type ChatSegment = { type: 'text'; text: string } | { type: 'card'; card: ChatCard };

const CARD_RE = /\[(红包|转账|礼物|位置|语音通话|视频通话)[:：]([^\]\n]{0,80})\]/g;

function cardFrom(kindText: string, body: string, raw: string): ChatCard | null {
  const parts = body.split(/[:：]/).map((s) => s.trim());
  switch (kindText) {
    case '红包':
      if (!parts[0]) return null;
      return { kind: 'redpacket', payload: { amount: parts[0], note: parts[1] || '恭喜发财，大吉大利' }, raw };
    case '转账':
      if (!parts[0]) return null;
      return { kind: 'transfer', payload: { amount: parts[0], note: parts[1] || '转账' }, raw };
    case '礼物':
      if (!parts[0]) return null;
      return { kind: 'gift', payload: { name: parts[1] || parts[0], amount: parts[0] }, raw };
    case '位置':
      if (!parts[0] && !parts[1]) return null;
      return { kind: 'location', payload: { address: parts[0], name: parts[1] || parts[0] }, raw };
    case '语音通话':
    case '视频通话': {
      const missed = body.includes('未接');
      const seconds = Number((body.match(/\d+/) ?? ['0'])[0]) || 0;
      return {
        kind: 'call',
        payload: { media: kindText === '语音通话' ? 'voice' : 'video', seconds, missed },
        raw,
      };
    }
    default:
      return null;
  }
}

/** 把带 [红包:...] 等标记的文本切成文本段和卡片段 */
export function parseChatSegments(text: string): ChatSegment[] {
  const segments: ChatSegment[] = [];
  let last = 0;
  CARD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CARD_RE.exec(text))) {
    const card = cardFrom(match[1], match[2], match[0]);
    if (!card) continue;
    if (match.index > last) segments.push({ type: 'text', text: text.slice(last, match.index) });
    segments.push({ type: 'card', card });
    last = match.index + match[0].length;
  }
  if (last < text.length) segments.push({ type: 'text', text: text.slice(last) });
  return segments.filter((s) => s.type === 'card' || s.text.trim().length > 0);
}

/** 供系统提示词引用：角色可以用这些标记发送红包/转账/位置等 */
export const CHAT_CARD_GUIDE =
  '你也可以发送这些特殊消息（单独一行，不要写解释）：[红包:金额:备注]、[转账:金额:备注]、[礼物:价格:礼物名]、[位置:地点:城市]、[语音通话:秒数]/[视频通话:秒数]。只有当你真的想给对方发红包、转账、送礼、分享位置时才用。';
